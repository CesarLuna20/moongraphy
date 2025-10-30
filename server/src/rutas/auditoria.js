import { Router } from "express";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { usuarioTienePermiso } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import { ModeloAuditoria } from "../modelos/index.js";

const router = Router();

router.get("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "actions:critical")) {
    await registrarPermisoDenegado(actor, "audit:list", "Intento de consultar auditoria sin permisos.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const eventos = await ModeloAuditoria.find().sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, events: eventos });
});

router.post("/record", autenticarSolicitud, async (req, res) => {
  const { action, message, status = "denied", metadata } = req.body ?? {};
  if (!action || !message) {
    return res.status(400).json({ success: false, error: "Datos incompletos para auditoria." });
  }
  await registrarAuditoria({ actor: req.authUser, action, status, message, metadata });
  res.json({ success: true });
});

export default router;
