import { Router } from "express";
import { v4 as uuid } from "uuid";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ModeloUsuario } from "../modelos/index.js";
import { usuarioTienePermiso } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import { esCorreoValido } from "../servicios/validaciones.js";
import { generarContrasenaTemporal, generarHashContrasena } from "../servicios/seguridad.js";
import { enviarCorreo, correoHabilitado } from "../servicios/correo.js";
import { agregarEntradaHistorial } from "../servicios/historial.js";
import { aUsuarioPublico } from "../servicios/usuarios.js";

const router = Router();

router.get("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "accounts:create")) {
    await registrarPermisoDenegado(actor, "clients:list", "Rol sin permisos para consultar clientes.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const filtro =
    actor.role === "photographer-admin" ? { role: "client" } : { role: "client", ownerId: actor.id };
  const clientes = await ModeloUsuario.find(filtro);
  res.json({ success: true, clients: clientes.map(aUsuarioPublico) });
});

router.post("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "accounts:create")) {
    await registrarPermisoDenegado(actor, "clients:create", "Rol sin permisos para crear clientes.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const { name, email, phone, bio } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ success: false, error: "Datos incompletos." });
  }
  if (!esCorreoValido(email)) {
    return res.status(400).json({ success: false, error: "Ingresa un correo electronico valido." });
  }
  const existe = await ModeloUsuario.exists({ email: email.trim().toLowerCase() });
  if (existe) {
    return res.status(400).json({ success: false, error: "Ya existe una cuenta con ese correo electronico." });
  }
  const contrasenaTemporal = generarContrasenaTemporal();
  const passwordHash = await generarHashContrasena(contrasenaTemporal);
  const ahora = new Date();
  const cliente = await ModeloUsuario.create({
    id: uuid(),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    passwordHash,
    role: "client",
    status: "active",
    phone: phone.trim(),
    bio: bio?.trim(),
    ownerId: actor.id,
    forcePasswordReset: true,
    history: [
      {
        timestamp: ahora,
        type: "register",
        summary: "Cuenta de cliente creada por administrador"
      }
    ],
    services: [],
    createdAt: ahora,
    updatedAt: ahora
  });

  let correoEnviado = false;
  let errorCorreo;
  if (correoHabilitado()) {
    const asunto = "Bienvenido a Moongraphy";
    const texto = `Hola ${cliente.name},\n\nSe creo una cuenta de cliente en Moongraphy para ti.\n\nCorreo: ${cliente.email}\nContrasena temporal: ${contrasenaTemporal}\n\nInicia sesion y cambia la contrasena cuanto antes.`;
    const html = `<p>Hola ${cliente.name},</p><p>Se creo una cuenta de cliente en <strong>Moongraphy</strong> para ti.</p><p><strong>Correo:</strong> ${cliente.email}<br/><strong>Contrasena temporal:</strong> ${contrasenaTemporal}</p><p>Inicia sesion y cambia la contrasena cuanto antes.</p>`;
    const resultado = await enviarCorreo({ to: cliente.email, subject: asunto, text: texto, html });
    if (resultado.success) {
      correoEnviado = true;
    } else {
      errorCorreo = resultado.error;
    }
  }

  await registrarAuditoria({
    actor,
    action: "clients:create",
    status: correoEnviado ? "success" : correoHabilitado() ? "error" : "success",
    message: correoEnviado
      ? `Cliente ${cliente.email} registrado y correo enviado.`
      : correoHabilitado()
      ? `Cliente ${cliente.email} registrado pero el correo fallo: ${errorCorreo ?? "Error desconocido"}.`
      : `Cliente ${cliente.email} registrado (SMTP no configurado).`,
    target: { id: cliente.id, email: cliente.email }
  });

  res.status(201).json({
    success: true,
    client: aUsuarioPublico(cliente),
    temporaryPassword: correoEnviado ? undefined : contrasenaTemporal,
    message: correoEnviado
      ? "Cliente registrado y credenciales enviadas por correo."
      : "Cliente registrado. Comparte la contrasena temporal manualmente."
  });
});

router.patch("/:id", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "accounts:create")) {
    await registrarPermisoDenegado(actor, "clients:update", "Rol sin permisos para editar clientes.", {
      clientId: req.params.id
    });
    return res.status(403).json({ success: false, error: "No tienes permisos para actualizar clientes." });
  }
  const cliente = await ModeloUsuario.findOne({ id: req.params.id, role: "client" });
  if (!cliente) {
    return res.status(404).json({ success: false, error: "Cliente no encontrado." });
  }
  if (cliente.ownerId && actor.role !== "photographer-admin" && cliente.ownerId !== actor.id) {
    await registrarPermisoDenegado(actor, "clients:update", "Intento de editar cliente ajeno.", {
      clientId: req.params.id,
      ownerId: cliente.ownerId
    });
    return res.status(403).json({ success: false, error: "No puedes editar clientes de otro fotografo." });
  }
  const { name, email, phone, bio } = req.body ?? {};
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ success: false, error: "El nombre no puede quedar vacio." });
  }
  const correoSiguiente = email !== undefined ? email.trim().toLowerCase() : cliente.email;
  if (email !== undefined) {
    if (!esCorreoValido(correoSiguiente)) {
      return res.status(400).json({ success: false, error: "Ingresa un correo electronico valido." });
    }
    if (correoSiguiente !== cliente.email) {
      const existe = await ModeloUsuario.exists({ email: correoSiguiente });
      if (existe) {
        return res.status(400).json({ success: false, error: "Ese correo ya esta registrado en otra cuenta." });
      }
    }
  }
  if (phone !== undefined) {
    const telefono = phone.trim();
    if (!telefono) {
      return res.status(400).json({ success: false, error: "El telefono no puede quedar vacio." });
    }
    cliente.phone = telefono;
  }
  cliente.name = name !== undefined ? name.trim() : cliente.name;
  cliente.email = correoSiguiente;
  cliente.bio = bio !== undefined && bio.trim().length > 0 ? bio.trim() : bio === "" ? undefined : cliente.bio;

  agregarEntradaHistorial(cliente, "profile-update", "Datos del cliente actualizados por administrador");
  await cliente.save();
  await registrarAuditoria({
    actor,
    action: "clients:update",
    status: "success",
    message: `Cliente ${cliente.email} actualizado`,
    target: { id: cliente.id, email: cliente.email }
  });

  res.json({ success: true, client: aUsuarioPublico(cliente) });
});

router.post("/:id/disable", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "accounts:create")) {
    await registrarPermisoDenegado(actor, "clients:disable", "Rol sin permisos para deshabilitar clientes.", {
      clientId: req.params.id
    });
    return res.status(403).json({ success: false, error: "No tienes permisos para deshabilitar clientes." });
  }
  const cliente = await ModeloUsuario.findOne({ id: req.params.id, role: "client" });
  if (!cliente) {
    return res.status(404).json({ success: false, error: "Cliente no encontrado." });
  }
  if (cliente.ownerId && actor.role !== "photographer-admin" && cliente.ownerId !== actor.id) {
    await registrarPermisoDenegado(actor, "clients:disable", "Intento de deshabilitar cliente ajeno.", {
      clientId: req.params.id,
      ownerId: cliente.ownerId
    });
    return res.status(403).json({ success: false, error: "No puedes deshabilitar clientes de otro fotografo." });
  }
  if (cliente.status === "inactive") {
    return res.json({ success: true, message: "El cliente ya estaba deshabilitado." });
  }
  cliente.status = "inactive";
  agregarEntradaHistorial(cliente, "disable", "Cliente deshabilitado por administrador");
  await cliente.save();
  await registrarAuditoria({
    actor,
    action: "clients:disable",
    status: "success",
    message: `Cliente ${cliente.email} deshabilitado`,
    target: { id: cliente.id, email: cliente.email }
  });
  res.json({ success: true, message: "Cliente deshabilitado correctamente." });
});

export default router;
