import { Router } from "express";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ModeloUsuario, ModeloSesion, ModeloEventoCronologia } from "../modelos/index.js";
import { esRolFotografo } from "../servicios/permisos.js";
import { registrarPermisoDenegado } from "../servicios/auditoria.js";
import { construirEventosCronologia } from "../servicios/cronologia.js";

const router = Router();

router.get("/clients/:id", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  const cliente = await ModeloUsuario.findOne({ id: req.params.id, role: "client" });
  if (!cliente) {
    return res.status(404).json({ success: false, error: "Cliente no encontrado." });
  }
  if (actor.role === "client" && actor.id !== cliente.id) {
    await registrarPermisoDenegado(actor, "timeline:client", "Cliente intento consultar historial ajeno.", {
      clientId: cliente.id
    });
    return res.status(403).json({ success: false, error: "No puedes consultar ese historial." });
  }
  if (esRolFotografo(actor.role) && actor.role !== "photographer-admin") {
    if (cliente.ownerId && cliente.ownerId !== actor.id) {
      const relacion = await ModeloSesion.exists({ clientId: cliente.id, photographerId: actor.id });
      if (!relacion) {
        await registrarPermisoDenegado(actor, "timeline:client", "Intento de consultar historial de cliente ajeno.", {
          clientId: cliente.id,
          ownerId: cliente.ownerId
        });
        return res.status(403).json({ success: false, error: "No puedes consultar ese historial." });
      }
    }
  } else if (!esRolFotografo(actor.role) && actor.role !== "client") {
    await registrarPermisoDenegado(actor, "timeline:client", "Rol sin permisos para consultar historial.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const eventos = await ModeloEventoCronologia.find({ clientId: cliente.id })
    .sort({ createdAt: -1 })
    .limit(200);
  const payload = await construirEventosCronologia(eventos);
  res.json({ success: true, events: payload });
});

router.get("/sessions/:id", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  const sesion = await ModeloSesion.findOne({ id: req.params.id });
  if (!sesion) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }
  if (actor.role === "client" && sesion.clientId !== actor.id) {
    await registrarPermisoDenegado(actor, "timeline:session", "Cliente intento consultar historial de otra sesion.", {
      sessionId: sesion.id,
      clientId: sesion.clientId
    });
    return res.status(403).json({ success: false, error: "No puedes consultar ese historial." });
  }
  if (esRolFotografo(actor.role) && actor.role !== "photographer-admin" && sesion.photographerId !== actor.id) {
    await registrarPermisoDenegado(actor, "timeline:session", "Fotografo intento consultar sesion ajena.", {
      sessionId: sesion.id,
      ownerId: sesion.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes consultar ese historial." });
  }
  if (!esRolFotografo(actor.role) && actor.role !== "client") {
    await registrarPermisoDenegado(actor, "timeline:session", "Rol sin permisos para consultar historial.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const eventos = await ModeloEventoCronologia.find({ sessionId: sesion.id })
    .sort({ createdAt: -1 })
    .limit(200);
  const payload = await construirEventosCronologia(eventos);
  res.json({ success: true, events: payload });
});

export default router;
