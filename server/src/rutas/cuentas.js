import { Router } from "express";
import { v4 as uuid } from "uuid";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ModeloUsuario } from "../modelos/index.js";
import { esCorreoValido } from "../servicios/validaciones.js";
import { esRolFotografo, usuarioTienePermiso } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import { generarHashContrasena } from "../servicios/seguridad.js";
import { construirDisponibilidadBase, aUsuarioPublico } from "../servicios/usuarios.js";
import { agregarEntradaHistorial } from "../servicios/historial.js";

const router = Router();

router.post("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "accounts:create")) {
    await registrarPermisoDenegado(actor, "accounts:create", "Intento de crear cuenta sin permisos.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const { name, email, password, role, specialty, location, portfolioUrl, phone, bio } = req.body ?? {};

  if (!name?.trim() || !email?.trim() || !password?.trim() || !role) {
    return res.status(400).json({ success: false, error: "Datos incompletos." });
  }

  if (role === "photographer-admin" && actor.role !== "photographer-admin") {
    await registrarPermisoDenegado(actor, "accounts:create", "Intento de crear admin sin permisos.", {
      attemptedRole: role
    });
    return res.status(403).json({
      success: false,
      error: "Solo un fotografo administrador puede crear otra cuenta administradora."
    });
  }

  if (!esCorreoValido(email)) {
    return res.status(400).json({ success: false, error: "Ingresa un correo electronico valido." });
  }
  const existe = await ModeloUsuario.exists({ email: email.trim().toLowerCase() });
  if (existe) {
    return res.status(400).json({ success: false, error: "Ya existe una cuenta con ese correo electronico." });
  }
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: "La contrasena debe tener al menos 6 caracteres."
    });
  }

  if (role === "client" && !phone?.trim()) {
    return res.status(400).json({
      success: false,
      error: "El telefono es obligatorio para clientes."
    });
  }

  if (esRolFotografo(role)) {
    if (!specialty?.trim()) {
      return res.status(400).json({ success: false, error: "Indica la especialidad fotografica." });
    }
    if (!location?.trim()) {
      return res.status(400).json({ success: false, error: "Indica la ubicacion principal." });
    }
  }

  const passwordHash = await generarHashContrasena(password.trim());
  const ahora = new Date();
  const nuevoUsuario = await ModeloUsuario.create({
    id: uuid(),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    passwordHash,
    role,
    status: "active",
    specialty: esRolFotografo(role) ? specialty?.trim() : undefined,
    location: esRolFotografo(role) ? location?.trim() : undefined,
    portfolioUrl: esRolFotografo(role) ? portfolioUrl?.trim() : undefined,
    bio: bio?.trim(),
    phone: phone?.trim(),
    ownerId: role === "client" ? actor.id : undefined,
    availability: esRolFotografo(role) ? construirDisponibilidadBase() : [],
    forcePasswordReset: true,
    history: [
      {
        timestamp: ahora,
        type: "register",
        summary:
          role === "client"
            ? "Cuenta de cliente creada por administrador"
            : "Cuenta de usuario creada por administrador"
      }
    ],
    services: [],
    createdAt: ahora,
    updatedAt: ahora
  });

  await registrarAuditoria({
    actor,
    action: "accounts:create",
    status: "success",
    message: `Cuenta ${nuevoUsuario.email} creada.`,
    target: { id: nuevoUsuario.id, email: nuevoUsuario.email },
    metadata: { role }
  });

  agregarEntradaHistorial(nuevoUsuario, "profile-update", "Cuenta creada por administrador");
  await nuevoUsuario.save();

  res.status(201).json({ success: true, user: aUsuarioPublico(nuevoUsuario) });
});

export default router;
