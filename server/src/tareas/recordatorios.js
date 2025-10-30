import { ModeloSesion, ModeloUsuario } from "../modelos/index.js";
import { fusionarPreferenciasNotificacion, enviarNotificacionUsuario } from "../servicios/notificaciones.js";
import { CLAVES_PLANTILLAS, renderizarPlantillaNotificacion } from "../servicios/plantillas.js";
import { registrarAuditoria } from "../servicios/auditoria.js";
import { formatearFechaCorta } from "../servicios/tiempo.js";

const INTERVALO_REVISION_MS = 15 * 60 * 1000;
const ESTADOS_ACTIVOS = ["scheduled", "confirmed", "client-confirmed"];

const cargarUsuarioCache = async (id, cache) => {
  if (!id) {
    return null;
  }
  if (cache.has(id)) {
    return cache.get(id);
  }
  const usuario = await ModeloUsuario.findOne({ id });
  cache.set(id, usuario ?? null);
  return usuario ?? null;
};

export const ejecutarBarridoRecordatorios = async () => {
  const ahora = new Date();
  const sesiones = await ModeloSesion.find({
    status: { $in: ESTADOS_ACTIVOS },
    start: { $gt: ahora }
  });

  const cacheFotografos = new Map();
  const cacheClientes = new Map();

  for (const sesion of sesiones) {
    const diferenciaMs = sesion.start.getTime() - ahora.getTime();
    if (diferenciaMs <= 0) {
      continue;
    }
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
    let modificada = false;

    const fotografo = await cargarUsuarioCache(sesion.photographerId, cacheFotografos);
    const cliente = await cargarUsuarioCache(sesion.clientId, cacheClientes);
    if (!fotografo || !cliente) {
      continue;
    }
    const preferenciasFotografo = fusionarPreferenciasNotificacion(fotografo.notificationPreferences);

    if (!sesion.reminder48Sent && diferenciaHoras <= 48 && diferenciaHoras > 24) {
      if (preferenciasFotografo.reminder48h) {
        const contexto48 = {
          clientName: cliente.name,
          photographerName: fotografo.name,
          sessionDate: formatearFechaCorta(sesion.start),
          sessionLocation: sesion.location,
          sessionType: sesion.type,
          sessionNotes: sesion.notes ?? "-",
          fallback: `Recordatorio: tu sesion con ${fotografo.name} es el ${formatearFechaCorta(
            sesion.start
          )} en ${sesion.location}.`
        };
        const mensaje48 = await renderizarPlantillaNotificacion(
          CLAVES_PLANTILLAS.RECORDATORIO_48H,
          contexto48
        );
        const resultado = await enviarNotificacionUsuario({
          usuario: cliente,
          type: "session-reminder-48h",
          title: "Recordatorio de sesion (48h)",
          message: mensaje48,
          sessionId: sesion.id,
          metadata: { reminderHours: 48 }
        });
        await registrarAuditoria({
          actor: fotografo,
          action: "sessions:reminder-48h",
          status: resultado.delivered ? "success" : "error",
          message: resultado.delivered
            ? `Recordatorio 48h enviado para la sesion ${sesion.id}.`
            : `Recordatorio 48h no entregado (${resultado.reason ?? "motivo desconocido"}).`,
          target: { id: sesion.id },
          metadata: { reminderHours: 48 }
        });
        sesion.reminder48Sent = true;
        modificada = true;
      }
    }

    if (!sesion.reminder24Sent && diferenciaHoras <= 24) {
      if (preferenciasFotografo.reminder24h) {
        const contexto24 = {
          clientName: cliente.name,
          photographerName: fotografo.name,
          sessionDate: formatearFechaCorta(sesion.start),
          sessionLocation: sesion.location,
          sessionType: sesion.type,
          sessionNotes: sesion.notes ?? "-",
          fallback: `Tu sesion con ${fotografo.name} es el ${formatearFechaCorta(
            sesion.start
          )}. Confirma tu asistencia desde esta alerta.`
        };
        const mensaje24 = await renderizarPlantillaNotificacion(
          CLAVES_PLANTILLAS.RECORDATORIO_24H,
          contexto24
        );
        const resultado = await enviarNotificacionUsuario({
          usuario: cliente,
          type: "session-reminder-24h",
          title: "Recordatorio de sesion (24h)",
          message: mensaje24,
          sessionId: sesion.id,
          metadata: { reminderHours: 24 }
        });
        await registrarAuditoria({
          actor: fotografo,
          action: "sessions:reminder-24h",
          status: resultado.delivered ? "success" : "error",
          message: resultado.delivered
            ? `Recordatorio 24h enviado para la sesion ${sesion.id}.`
            : `Recordatorio 24h no entregado (${resultado.reason ?? "motivo desconocido"}).`,
          target: { id: sesion.id },
          metadata: { reminderHours: 24 }
        });
        sesion.reminder24Sent = true;
        modificada = true;
      }
    }

    if (modificada) {
      sesion.updatedAt = new Date();
      await sesion.save();
    }
  }
};

export const iniciarProgramadorRecordatorios = () => {
  const ejecutar = () =>
    ejecutarBarridoRecordatorios().catch((error) => {
      console.error("[recordatorios] Error ejecutando recordatorios", error);
    });
  ejecutar();
  setInterval(ejecutar, INTERVALO_REVISION_MS);
};
