import { ModeloSesion, ModeloUsuario } from "../modelos/index.js";
import { aResumenSesionPublica } from "./sesiones.js";
import { aUsuarioCompacto } from "./usuarios.js";

export const ETIQUETAS_ESTADO_GALERIA = {
  pending: "Pendiente",
  review: "En revision",
  delivered: "Entregado",
  received: "Recibido"
};

export const VALORES_ESTADO_GALERIA = Object.keys(ETIQUETAS_ESTADO_GALERIA);
export const CONJUNTO_ESTADO_GALERIA = new Set(VALORES_ESTADO_GALERIA);

export const aFotoPublica = (foto) => ({
  id: foto.id,
  filename: foto.filename,
  originalName: foto.originalName,
  mimeType: foto.mimeType,
  size: foto.size,
  url: foto.url,
  uploadedAt: foto.uploadedAt
});

export const aGaleriaPublica = (galeria, extras = {}) => ({
  id: galeria.id,
  sessionId: galeria.sessionId,
  photographerId: galeria.photographerId,
  clientId: galeria.clientId,
  name: galeria.name,
  description: galeria.description,
  status: galeria.status,
  statusLabel: ETIQUETAS_ESTADO_GALERIA[galeria.status] ?? galeria.status,
  photos: (galeria.photos ?? []).map((foto) => aFotoPublica(foto)),
  photoCount: galeria.photos?.length ?? 0,
  deliveredAt: galeria.deliveredAt,
  receivedAt: galeria.receivedAt,
  history: (galeria.history ?? []).map((entrada) => ({
    timestamp: entrada.timestamp,
    type: entrada.type,
    summary: entrada.summary
  })),
  createdAt: galeria.createdAt,
  updatedAt: galeria.updatedAt,
  ...extras
});

export const clientePuedeAccederGaleria = (galeria) =>
  galeria.status === "delivered" || galeria.status === "received";

export const construirListadoGalerias = async (galerias) => {
  if (!Array.isArray(galerias) || galerias.length === 0) {
    return [];
  }
  const sessionIds = [...new Set(galerias.map((galeria) => galeria.sessionId))];
  const userIds = [
    ...new Set(
      galerias.flatMap((galeria) => [galeria.photographerId, galeria.clientId]).filter((id) => !!id)
    )
  ];
  const [sesiones, usuarios] = await Promise.all([
    ModeloSesion.find({ id: { $in: sessionIds } }),
    userIds.length > 0 ? ModeloUsuario.find({ id: { $in: userIds } }) : []
  ]);
  const mapaSesiones = new Map(sesiones.map((sesion) => [sesion.id, sesion]));
  const mapaUsuarios = new Map(usuarios.map((usuario) => [usuario.id, usuario]));

  return galerias.map((galeria) =>
    aGaleriaPublica(galeria, {
      session: mapaSesiones.has(galeria.sessionId)
        ? aResumenSesionPublica(mapaSesiones.get(galeria.sessionId))
        : undefined,
      photographer: mapaUsuarios.has(galeria.photographerId)
        ? aUsuarioCompacto(mapaUsuarios.get(galeria.photographerId))
        : undefined,
      client: mapaUsuarios.has(galeria.clientId)
        ? aUsuarioCompacto(mapaUsuarios.get(galeria.clientId))
        : undefined
    })
  );
};
