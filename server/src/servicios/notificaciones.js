import { v4 as uuid } from "uuid";

import { ModeloNotificacion, ModeloUsuario } from "../modelos/index.js";

export const PREFERENCIAS_NOTIFICACION_BASE = {
  pushEnabled: true,
  inAppEnabled: true,
  confirmation: true,
  reminder48h: true,
  reminder24h: true,
  changes: true
};

export const fusionarPreferenciasNotificacion = (preferencias) => ({
  ...PREFERENCIAS_NOTIFICACION_BASE,
  ...(preferencias ?? {})
});

export const aNotificacionPublica = (notificacion) => ({
  id: notificacion.id,
  type: notificacion.type,
  title: notificacion.title,
  message: notificacion.message,
  sessionId: notificacion.sessionId,
  channels: notificacion.channels,
  metadata: notificacion.metadata ?? {},
  readAt: notificacion.readAt,
  createdAt: notificacion.createdAt
});

const tipoNotificacionHabilitado = (preferencias, tipo) => {
  switch (tipo) {
    case "session-confirmed":
    case "session-client-confirmed":
    case "session-created":
      return preferencias.confirmation;
    case "session-reminder-48h":
      return preferencias.reminder48h;
    case "session-reminder-24h":
      return preferencias.reminder24h;
    case "session-updated":
    case "session-cancelled":
    case "gallery-delivered":
    case "gallery-received":
      return preferencias.changes;
    default:
      return true;
  }
};

export const enviarNotificacionUsuario = async ({ usuario, userId, type, title, message, sessionId, metadata }) => {
  const destinatario =
    usuario ??
    (await ModeloUsuario.findOne({
      id: userId
    }));
  if (!destinatario) {
    return { delivered: false, reason: "user-not-found" };
  }
  const preferencias = fusionarPreferenciasNotificacion(destinatario.notificationPreferences);
  if (!tipoNotificacionHabilitado(preferencias, type)) {
    return { delivered: false, reason: "type-disabled" };
  }
  const canales = [];
  if (preferencias.inAppEnabled) {
    canales.push("in-app");
  }
  if (preferencias.pushEnabled) {
    canales.push("push");
  }
  if (canales.length === 0) {
    return { delivered: false, reason: "channels-disabled" };
  }

  const notificacion = await ModeloNotificacion.create({
    id: uuid(),
    userId: destinatario.id,
    type,
    title,
    message,
    sessionId,
    channels: canales,
    metadata,
    createdAt: new Date()
  });

  if (canales.includes("push")) {
    console.log(`[notify][push] ${destinatario.email} -> ${title}`);
  }

  return { delivered: true, notification: aNotificacionPublica(notificacion) };
};
