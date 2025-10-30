import { Router } from "express";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ModeloNotificacion } from "../modelos/index.js";
import {
  fusionarPreferenciasNotificacion,
  aNotificacionPublica
} from "../servicios/notificaciones.js";
import { coaccionarBooleano } from "../servicios/validaciones.js";

const router = Router();

router.get("/", autenticarSolicitud, async (req, res) => {
  const usuario = req.authUser;
  const { unreadOnly } = req.query ?? {};
  const filtro = { userId: usuario.id };
  if (unreadOnly === "true") {
    filtro.readAt = { $exists: false };
  }
  const notificaciones = await ModeloNotificacion.find(filtro).sort({ createdAt: -1 }).limit(100);
  res.json({
    success: true,
    notifications: notificaciones.map(aNotificacionPublica)
  });
});

router.post("/read", autenticarSolicitud, async (req, res) => {
  const usuario = req.authUser;
  const { ids, readAll } = req.body ?? {};
  const filtro = { userId: usuario.id };
  if (!readAll) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Proporciona los IDs a marcar como leidos." });
    }
    filtro.id = { $in: ids };
  }
  await ModeloNotificacion.updateMany(filtro, { readAt: new Date() });
  res.json({ success: true });
});

router.put("/preferences", autenticarSolicitud, async (req, res) => {
  const usuario = req.authUser;
  const incoming = req.body ?? {};
  const actuales = fusionarPreferenciasNotificacion(usuario.notificationPreferences);
  const siguientes = {
    pushEnabled: coaccionarBooleano(incoming.pushEnabled, actuales.pushEnabled),
    inAppEnabled: coaccionarBooleano(incoming.inAppEnabled, actuales.inAppEnabled),
    confirmation: coaccionarBooleano(incoming.confirmation, actuales.confirmation),
    reminder48h: coaccionarBooleano(incoming.reminder48h, actuales.reminder48h),
    reminder24h: coaccionarBooleano(incoming.reminder24h, actuales.reminder24h),
    changes: coaccionarBooleano(incoming.changes, actuales.changes)
  };
  usuario.notificationPreferences = siguientes;
  await usuario.save();
  res.json({
    success: true,
    preferences: fusionarPreferenciasNotificacion(usuario.notificationPreferences)
  });
});

export default router;
