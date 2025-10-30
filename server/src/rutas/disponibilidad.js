import { Router } from "express";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { esRolFotografo } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import { normalizarDisponibilidad } from "../servicios/usuarios.js";
import { agregarEntradaHistorial } from "../servicios/historial.js";

const router = Router();

router.get("/", autenticarSolicitud, async (req, res) => {
  const usuario = req.authUser;
  if (!esRolFotografo(usuario.role)) {
    await registrarPermisoDenegado(usuario, "availability:list", "Rol sin permisos para consultar disponibilidad.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  res.json({ success: true, availability: usuario.availability ?? [] });
});

router.put("/", autenticarSolicitud, async (req, res) => {
  const usuario = req.authUser;
  if (!esRolFotografo(usuario.role)) {
    await registrarPermisoDenegado(usuario, "availability:update", "Rol sin permisos para actualizar disponibilidad.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const { slots } = req.body ?? {};
  const normalizados = normalizarDisponibilidad(slots);
  if (!normalizados.ok) {
    return res.status(400).json({ success: false, error: normalizados.error });
  }
  usuario.availability = normalizados.slots;
  agregarEntradaHistorial(usuario, "availability-update", "Disponibilidad laboral actualizada");
  await usuario.save();
  await registrarAuditoria({
    actor: usuario,
    action: "availability:update",
    status: "success",
    message: "Disponibilidad actualizada",
    metadata: { slots: normalizados.slots.length }
  });
  res.json({ success: true, availability: usuario.availability });
});

export default router;
