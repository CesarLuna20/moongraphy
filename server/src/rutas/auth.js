import { Router } from "express";
import jwt from "jsonwebtoken";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ajustesEntorno } from "../configuracion/entorno.js";
import { ModeloUsuario } from "../modelos/index.js";
import { aUsuarioPublico } from "../servicios/usuarios.js";
import { agregarEntradaHistorial } from "../servicios/historial.js";
import { registrarAuditoria } from "../servicios/auditoria.js";
import {
  generarContrasenaTemporal,
  generarHashContrasena,
  compararContrasena
} from "../servicios/seguridad.js";
import { enviarCorreo, correoHabilitado } from "../servicios/correo.js";
import { esContrasenaRobusta } from "../servicios/validaciones.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Credenciales invalidas." });
  }
  const usuario = await ModeloUsuario.findOne({ email: email.trim().toLowerCase() });
  if (!usuario) {
    return res.status(401).json({ success: false, error: "Credenciales invalidas." });
  }
  if (usuario.status !== "active") {
    return res.status(403).json({
      success: false,
      error: "Tu cuenta ha sido suspendida de forma indefinida. Contacta al administrador para mas informacion."
    });
  }
  const valido = await compararContrasena(password, usuario.passwordHash);
  if (!valido) {
    return res.status(401).json({ success: false, error: "Credenciales invalidas." });
  }

  usuario.lastLoginAt = new Date();
  agregarEntradaHistorial(usuario, "login", "Inicio de sesion exitoso");
  await usuario.save();

  const token = jwt.sign({ id: usuario.id, role: usuario.role }, ajustesEntorno.jwtSecreto, {
    expiresIn: "7d"
  });
  await registrarAuditoria({
    actor: usuario,
    action: "auth:login",
    status: "success",
    message: "Inicio de sesion correcto"
  });
  res.json({ success: true, token, user: aUsuarioPublico(usuario) });
});

router.get("/session", autenticarSolicitud, (req, res) => {
  const usuario = req.authUser;
  if (usuario.status !== "active") {
    return res.status(403).json({
      success: false,
      error: "Tu cuenta ha sido suspendida de forma indefinida. Contacta al administrador para mas informacion."
    });
  }
  res.json({ success: true, user: aUsuarioPublico(usuario) });
});

router.post("/logout", (_req, res) => {
  res.json({ success: true });
});

router.post("/password-reset", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ success: false, error: "Correo electronico requerido." });
  }
  const usuario = await ModeloUsuario.findOne({ email: email.trim().toLowerCase() });
  if (!usuario) {
    return res.status(404).json({ success: false, error: "No existe una cuenta con ese correo." });
  }
  const contrasenaTemporal = generarContrasenaTemporal();
  usuario.passwordHash = await generarHashContrasena(contrasenaTemporal);
  usuario.forcePasswordReset = true;
  agregarEntradaHistorial(usuario, "password-reset", "Contrasena temporal generada");
  if (usuario.status === "active") {
    agregarEntradaHistorial(usuario, "logout", "Sesiones activas invalidadas tras recuperacion");
  }
  await usuario.save();

  let correoEnviado = false;
  let errorCorreo;

  if (correoHabilitado()) {
    const asunto = "Recuperacion de contrasena";
    const texto = `Hola ${usuario.name ?? ""},\n\nSe genero una contrasena temporal para tu cuenta Moongraphy.\n\nContrasena temporal: ${contrasenaTemporal}\n\nInicia sesion con ella y cambiala de inmediato desde la aplicacion.\n\nSi no solicitaste este cambio, ignora este mensaje.`;
    const html = `<p>Hola ${usuario.name ?? ""},</p><p>Se genero una contrasena temporal para tu cuenta <strong>Moongraphy</strong>.</p><p><strong>Contrasena temporal:</strong> ${contrasenaTemporal}</p><p>Inicia sesion con ella y cambiala de inmediato desde la aplicacion.</p><p>Si no solicitaste este cambio, ignora este mensaje.</p>`;
    const resultado = await enviarCorreo({
      to: usuario.email,
      subject: asunto,
      text: texto,
      html
    });
    correoEnviado = resultado.success;
    errorCorreo = resultado.error;
  }

  await registrarAuditoria({
    actor: usuario,
    action: "auth:password-reset",
    status: correoEnviado ? "success" : correoHabilitado() ? "error" : "success",
    message: correoEnviado
      ? "Se genero una contrasena temporal y se envio por correo."
      : correoHabilitado()
      ? `Se genero una contrasena temporal pero el correo fallo: ${errorCorreo ?? "Error desconocido"}.`
      : "Se genero una contrasena temporal (SMTP no configurado)."
  });

  if (correoEnviado) {
    return res.json({
      success: true,
      message: "Hemos enviado una contrasena temporal a tu correo electronico."
    });
  }

  res.json({
    success: true,
    message: errorCorreo
      ? "No se pudo enviar el correo automaticamente. Usa la contrasena temporal mostrada y actualizala de inmediato."
      : "Se ha generado una contrasena temporal. Usa el codigo para iniciar sesion y actualizala de inmediato.",
    temporaryPassword: contrasenaTemporal
  });
});

router.post("/complete-password-change", autenticarSolicitud, async (req, res) => {
  const { newPassword } = req.body ?? {};
  if (!esContrasenaRobusta(newPassword)) {
    return res.status(400).json({
      success: false,
      error: "La nueva contrasena debe tener al menos 8 caracteres, incluir mayusculas, minusculas y numeros."
    });
  }
  const usuario = req.authUser;
  usuario.passwordHash = await generarHashContrasena(newPassword);
  usuario.forcePasswordReset = false;
  agregarEntradaHistorial(usuario, "password-change", "Contrasena actualizada por el usuario");
  await usuario.save();
  await registrarAuditoria({
    actor: usuario,
    action: "auth:password-change",
    status: "success",
    message: "Contrasena actualizada por el usuario"
  });
  res.json({ success: true });
});

router.post("/change-password", autenticarSolicitud, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return res.status(400).json({ success: false, error: "Debes indicar tu contrasena actual." });
  }
  if (!esContrasenaRobusta(newPassword)) {
    return res.status(400).json({
      success: false,
      error: "La nueva contrasena debe tener al menos 8 caracteres, incluir mayusculas, minusculas y numeros."
    });
  }
  const usuario = req.authUser;
  const valido = await compararContrasena(currentPassword, usuario.passwordHash);
  if (!valido) {
    return res.status(400).json({ success: false, error: "La contrasena actual no es correcta." });
  }
  usuario.passwordHash = await generarHashContrasena(newPassword);
  usuario.forcePasswordReset = false;
  agregarEntradaHistorial(usuario, "password-change", "Contrasena actualizada manualmente por el usuario");
  await usuario.save();
  await registrarAuditoria({
    actor: usuario,
    action: "auth:password-change",
    status: "success",
    message: "Contrasena actualizada manualmente por el usuario"
  });
  res.json({ success: true });
});

export default router;
