import { Router } from "express";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ModeloUsuario } from "../modelos/index.js";
import { esCorreoValido } from "../servicios/validaciones.js";
import { esRolFotografo, usuarioTienePermiso } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import { agregarEntradaHistorial } from "../servicios/historial.js";
import { aUsuarioPublico } from "../servicios/usuarios.js";

const router = Router();

router.patch("/profile", autenticarSolicitud, async (req, res) => {
  const usuario = req.authUser;
  const { name, email, avatarUrl, bio, phone, specialty, location, portfolioUrl } = req.body ?? {};

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ success: false, error: "El nombre no puede estar vacio." });
  }
  if (email !== undefined) {
    const normalizado = email.trim().toLowerCase();
    if (!esCorreoValido(normalizado)) {
      return res.status(400).json({ success: false, error: "Ingresa un correo electronico valido." });
    }
    if (normalizado !== usuario.email) {
      const existe = await ModeloUsuario.exists({ email: normalizado });
      if (existe) {
        return res
          .status(400)
          .json({ success: false, error: "Ese correo ya esta registrado en otra cuenta." });
      }
      usuario.email = normalizado;
    }
  }
  if (name !== undefined) {
    usuario.name = name.trim();
  }
  if (avatarUrl !== undefined) {
    usuario.avatarUrl = avatarUrl.trim() || undefined;
  }
  if (bio !== undefined) {
    usuario.bio = bio.trim() || undefined;
  }
  if (phone !== undefined) {
    usuario.phone = phone.trim() || undefined;
  }
  if (esRolFotografo(usuario.role)) {
    if (specialty !== undefined) {
      usuario.specialty = specialty.trim() || undefined;
    }
    if (location !== undefined) {
      usuario.location = location.trim() || undefined;
    }
    if (portfolioUrl !== undefined) {
      usuario.portfolioUrl = portfolioUrl.trim() || undefined;
    }
  }

  agregarEntradaHistorial(usuario, "profile-update", "Perfil actualizado por el usuario");
  await usuario.save();
  await registrarAuditoria({
    actor: usuario,
    action: "profile:update",
    status: "success",
    message: "Perfil actualizado correctamente"
  });

  res.json({ success: true, user: aUsuarioPublico(usuario) });
});

router.post("/users/disable", autenticarSolicitud, async (req, res) => {
  const usuario = req.authUser;
  if (!esRolFotografo(usuario.role)) {
    return res
      .status(403)
      .json({ success: false, error: "Solo los fotografos pueden deshabilitar temporalmente su cuenta." });
  }
  if (usuario.status === "inactive") {
    return res.json({ success: true, message: "La cuenta ya se encuentra deshabilitada." });
  }

  usuario.status = "inactive";
  agregarEntradaHistorial(usuario, "disable", "Cuenta deshabilitada por el usuario");
  await usuario.save();
  await registrarAuditoria({
    actor: usuario,
    action: "accounts:disable",
    status: "success",
    message: "Cuenta deshabilitada por el usuario"
  });
  res.json({ success: true, message: "Tu cuenta ha sido deshabilitada. Un administrador debera reactivarla." });
});

router.get("/users/:id/history", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  const { id } = req.params;
  if (actor.id !== id && !usuarioTienePermiso(actor, "actions:critical")) {
    await registrarPermisoDenegado(actor, "users:history", "Intento de leer historial ajeno.", { targetId: id });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const usuario = await ModeloUsuario.findOne({ id });
  if (!usuario) {
    return res.status(404).json({ success: false, error: "Usuario no encontrado." });
  }
  res.json({ success: true, history: usuario.history ?? [] });
});

export default router;
