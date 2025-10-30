import { v4 as uuid } from "uuid";

import {
  ModeloEventoCronologia,
  ModeloSesion,
  ModeloUsuario
} from "../modelos/index.js";
import { aSesionPublica } from "./sesiones.js";
import { aUsuarioPublico, aUsuarioCompacto } from "./usuarios.js";

export const TIPOS_EVENTO_CRONOLOGIA = {
  SESSION_CREATED: "session-created",
  SESSION_RESCHEDULED: "session-rescheduled",
  SESSION_CANCELLED: "session-cancelled",
  SESSION_CONFIRMED: "session-confirmed",
  SESSION_CLIENT_CONFIRMED: "session-client-confirmed",
  SESSION_UPDATED: "session-updated",
  SESSION_NOTE: "session-note",
  GALLERY_CREATED: "gallery-created",
  GALLERY_PHOTOS_UPLOADED: "gallery-photos-uploaded",
  GALLERY_DELIVERED: "gallery-delivered",
  GALLERY_REVIEW: "gallery-review",
  GALLERY_PENDING: "gallery-pending",
  GALLERY_CONFIRMED: "gallery-confirmed"
};

export const aEventoCronologiaPublico = (evento, extras = {}) => ({
  id: evento.id,
  type: evento.type,
  sessionId: evento.sessionId,
  clientId: evento.clientId,
  photographerId: evento.photographerId,
  galleryId: evento.galleryId,
  actorId: evento.actorId,
  actorEmail: evento.actorEmail,
  actorName: evento.actorName,
  title: evento.title,
  description: evento.description,
  payload: evento.payload,
  createdAt: evento.createdAt,
  ...extras
});

export const construirEventosCronologia = async (eventos) => {
  if (!Array.isArray(eventos) || eventos.length === 0) {
    return [];
  }

  const idsSesiones = [
    ...new Set(eventos.map((evento) => evento.sessionId).filter((valor) => !!valor))
  ];
  const idsClientes = [
    ...new Set(eventos.map((evento) => evento.clientId).filter((valor) => !!valor))
  ];
  const idsFotografos = [
    ...new Set(eventos.map((evento) => evento.photographerId).filter((valor) => !!valor))
  ];

  const [sesiones, clientes, fotografos] = await Promise.all([
    idsSesiones.length > 0 ? ModeloSesion.find({ id: { $in: idsSesiones } }) : [],
    idsClientes.length > 0 ? ModeloUsuario.find({ id: { $in: idsClientes } }) : [],
    idsFotografos.length > 0 ? ModeloUsuario.find({ id: { $in: idsFotografos } }) : []
  ]);

  const mapaSesiones = new Map(sesiones.map((sesion) => [sesion.id, sesion]));
  const mapaClientes = new Map(clientes.map((cliente) => [cliente.id, cliente]));
  const mapaFotografos = new Map(fotografos.map((fotografo) => [fotografo.id, fotografo]));

  return eventos.map((evento) =>
    aEventoCronologiaPublico(evento, {
      session: mapaSesiones.has(evento.sessionId)
        ? aSesionPublica(mapaSesiones.get(evento.sessionId))
        : undefined,
      client: mapaClientes.has(evento.clientId)
        ? aUsuarioPublico(mapaClientes.get(evento.clientId))
        : undefined,
      photographer: mapaFotografos.has(evento.photographerId)
        ? aUsuarioCompacto(mapaFotografos.get(evento.photographerId))
        : undefined
    })
  );
};

export const registrarEventoCronologia = async ({
  type,
  session,
  sessionId,
  clientId,
  photographerId,
  galleryId,
  actor,
  title,
  description,
  payload
}) =>
  ModeloEventoCronologia.create({
    id: uuid(),
    type,
    sessionId: session?.id ?? sessionId,
    clientId: clientId ?? session?.clientId,
    photographerId: photographerId ?? session?.photographerId,
    galleryId,
    actorId: actor?.id,
    actorEmail: actor?.email,
    actorName: actor?.name,
    title,
    description,
    payload,
    createdAt: new Date()
  });
