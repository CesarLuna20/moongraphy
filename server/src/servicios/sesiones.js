import { ModeloSesion } from "../modelos/index.js";
import { minutosDesdeFecha, convertirHoraAMinutos } from "./tiempo.js";

export const aSesionPublica = (sesion, extras = {}) => ({
  id: sesion.id,
  photographerId: sesion.photographerId,
  clientId: sesion.clientId,
  type: sesion.type,
  sessionTypeId: sesion.sessionTypeId,
  location: sesion.location,
  notes: sesion.notes,
  start: sesion.start,
  end: sesion.end,
  status: sesion.status,
  cancellationReason: sesion.cancellationReason,
  cancelledAt: sesion.cancelledAt,
  photographerConfirmedAt: sesion.photographerConfirmedAt,
  clientConfirmedAt: sesion.clientConfirmedAt,
  reminder48Sent: sesion.reminder48Sent,
  reminder24Sent: sesion.reminder24Sent,
  createdAt: sesion.createdAt,
  updatedAt: sesion.updatedAt,
  ...extras
});

export const aResumenSesionPublica = (sesion) => ({
  id: sesion.id,
  photographerId: sesion.photographerId,
  clientId: sesion.clientId,
  type: sesion.type,
  sessionTypeId: sesion.sessionTypeId,
  location: sesion.location,
  start: sesion.start,
  end: sesion.end,
  status: sesion.status
});

export const buscarConflictoSesion = async ({ photographerId, start, end, excludeId }) => {
  const filtro = {
    photographerId,
    status: { $ne: "cancelled" },
    start: { $lt: end },
    end: { $gt: start }
  };
  if (excludeId) {
    filtro.id = { $ne: excludeId };
  }
  return ModeloSesion.findOne(filtro);
};

export const aTipoSesionPublico = (entrada) => ({
  id: entrada.id,
  name: entrada.name,
  description: entrada.description,
  archived: entrada.archived,
  createdAt: entrada.createdAt,
  updatedAt: entrada.updatedAt
});

export const asegurarDentroDisponibilidad = (usuario, inicio, fin) => {
  if (!usuario?.availability || usuario.availability.length === 0) {
    return { ok: true };
  }
  const mismoDia = inicio.toDateString() === fin.toDateString();
  if (!mismoDia) {
    return { ok: false, error: "Las sesiones deben iniciar y terminar el mismo dia." };
  }
  const dia = inicio.getDay();
  const inicioMinutos = minutosDesdeFecha(inicio);
  const finMinutos = minutosDesdeFecha(fin);
  const bloques = usuario.availability.filter((slot) => slot.dayOfWeek === dia);
  if (bloques.length === 0) {
    return { ok: false, error: "No hay disponibilidad configurada para ese dia." };
  }
  for (const bloque of bloques) {
    const bloqueInicio = convertirHoraAMinutos(bloque.startTime);
    const bloqueFin = convertirHoraAMinutos(bloque.endTime);
    if (bloqueInicio === null || bloqueFin === null) {
      continue;
    }
    if (inicioMinutos >= bloqueInicio && finMinutos <= bloqueFin) {
      return { ok: true };
    }
  }
  return { ok: false, error: "La sesion esta fuera del horario disponible configurado." };
};
