import { Router } from "express";
import path from "path";
import { v4 as uuid } from "uuid";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { subidaGaleria, MAX_ARCHIVOS_POR_SUBIDA } from "../middlewares/subidasGaleria.js";
import {
  ModeloGaleria,
  ModeloSesion,
  ModeloUsuario
} from "../modelos/index.js";
import { esRolFotografo } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import {
  aGaleriaPublica,
  construirListadoGalerias,
  CONJUNTO_ESTADO_GALERIA,
  ETIQUETAS_ESTADO_GALERIA,
  VALORES_ESTADO_GALERIA,
  clientePuedeAccederGaleria
} from "../servicios/galerias.js";
import { limpiarTexto } from "../servicios/cadenas.js";
import { agregarEntradaHistorialGaleria } from "../servicios/historial.js";
import {
  TIPOS_EVENTO_CRONOLOGIA,
  registrarEventoCronologia
} from "../servicios/cronologia.js";
import { enviarNotificacionUsuario } from "../servicios/notificaciones.js";
import { rutasServidor } from "../configuracion/rutas.js";

const router = Router();

router.get("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  const { status, clientId, sessionId, photographerId } = req.query ?? {};

  const filtro = {};
  if (actor.role === "photographer-admin") {
    if (typeof photographerId === "string" && photographerId.trim()) {
      filtro.photographerId = photographerId.trim();
    }
  } else if (esRolFotografo(actor.role)) {
    filtro.photographerId = actor.id;
  } else if (actor.role === "client") {
    filtro.clientId = actor.id;
  } else {
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  if (typeof clientId === "string" && clientId.trim()) {
    const objetivo = clientId.trim();
    if (actor.role === "client" && objetivo !== actor.id) {
      await registrarPermisoDenegado(actor, "galleries:list", "Cliente intento consultar galerias ajenas.", {
        clientId: objetivo
      });
      return res.status(403).json({ success: false, error: "No puedes consultar esas galerias." });
    }
    filtro.clientId = objetivo;
  }

  if (typeof sessionId === "string" && sessionId.trim()) {
    filtro.sessionId = sessionId.trim();
  }

  if (typeof status === "string" && status.trim()) {
    const normalizado = status.trim().toLowerCase();
    if (!CONJUNTO_ESTADO_GALERIA.has(normalizado)) {
      return res.status(400).json({ success: false, error: "Estado de galeria desconocido." });
    }
    filtro.status = normalizado;
  }

  const galerias = await ModeloGaleria.find(filtro).sort({ updatedAt: -1, createdAt: -1 });
  const payload = await construirListadoGalerias(galerias);

  const totales = { total: galerias.length };
  for (const valor of VALORES_ESTADO_GALERIA) {
    totales[valor] = 0;
  }
  for (const galeria of galerias) {
    if (totales[galeria.status] !== undefined) {
      totales[galeria.status] += 1;
    }
  }

  res.json({ success: true, galleries: payload, totals: totales });
});

router.get("/:id", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  const galeria = await ModeloGaleria.findOne({ id: req.params.id });
  if (!galeria) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  if (actor.role === "photographer-admin") {
    // acceso permitido
  } else if (esRolFotografo(actor.role)) {
    if (galeria.photographerId !== actor.id) {
      await registrarPermisoDenegado(actor, "galleries:view", "Fotografo intento acceder a galeria ajena.", {
        galleryId: galeria.id,
        ownerId: galeria.photographerId
      });
      return res.status(403).json({ success: false, error: "No puedes ver esa galeria." });
    }
  } else if (actor.role === "client") {
    if (galeria.clientId !== actor.id) {
      await registrarPermisoDenegado(actor, "galleries:view", "Cliente intento acceder a galeria ajena.", {
        galleryId: galeria.id
      });
      return res.status(403).json({ success: false, error: "No puedes ver esa galeria." });
    }
    if (!clientePuedeAccederGaleria(galeria)) {
      return res.status(403).json({ success: false, error: "El material aun esta en revision." });
    }
  } else {
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const [payload] = await construirListadoGalerias([galeria]);
  res.json({ success: true, gallery: payload ?? aGaleriaPublica(galeria) });
});

router.post("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "galleries:create", "Rol sin permisos para crear galerias.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "Selecciona la sesion a vincular." });
  }

  const sesion = await ModeloSesion.findOne({ id: sessionId });
  if (!sesion) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }

  if (actor.role !== "photographer-admin" && sesion.photographerId !== actor.id) {
    await registrarPermisoDenegado(actor, "galleries:create", "Intento de crear galeria para sesion ajena.", {
      sessionId: sesion.id,
      ownerId: sesion.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes crear una galeria para esa sesion." });
  }

  const nombre = limpiarTexto(req.body?.name);
  if (!nombre) {
    return res.status(400).json({ success: false, error: "Ingresa el nombre de la galeria." });
  }

  const descripcion = limpiarTexto(req.body?.description);
  const ahora = new Date();
  const galeria = await ModeloGaleria.create({
    id: uuid(),
    sessionId: sesion.id,
    photographerId: sesion.photographerId,
    clientId: sesion.clientId,
    name: nombre,
    description: descripcion,
    status: "pending",
    photos: [],
    history: [
      {
        timestamp: ahora,
        type: "create",
        summary: `Galeria creada por ${actor.name ?? "sistema"}.`
      }
    ],
    createdAt: ahora,
    updatedAt: ahora
  });

  await registrarAuditoria({
    actor,
    action: "galleries:create",
    status: "success",
    message: `Galeria ${galeria.name} creada para la sesion ${sesion.id}.`,
    target: { id: galeria.id },
    metadata: { sessionId: sesion.id, clientId: sesion.clientId }
  });

  await registrarEventoCronologia({
    type: TIPOS_EVENTO_CRONOLOGIA.GALLERY_CREATED,
    session: sesion,
    actor,
    galleryId: galeria.id,
    clientId: galeria.clientId,
    photographerId: galeria.photographerId,
    title: "Galeria creada",
    description: `Se creo la galeria ${galeria.name}.`,
    payload: { galleryId: galeria.id }
  });

  const [payload] = await construirListadoGalerias([galeria]);
  res.status(201).json({ success: true, gallery: payload ?? aGaleriaPublica(galeria) });
});

router.patch("/:id", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "galleries:update", "Rol sin permisos para editar galerias.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const galeria = await ModeloGaleria.findOne({ id: req.params.id });
  if (!galeria) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  if (actor.role !== "photographer-admin" && galeria.photographerId !== actor.id) {
    await registrarPermisoDenegado(actor, "galleries:update", "Intento de editar galeria ajena.", {
      galleryId: galeria.id,
      ownerId: galeria.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes editar esa galeria." });
  }

  if ((galeria.photos?.length ?? 0) > 0) {
    return res
      .status(400)
      .json({ success: false, error: "No puedes editar el nombre o descripcion despues de subir fotos." });
  }

  const { name: rawName, description: rawDescription } = req.body ?? {};
  let cambio = false;

  if (rawName !== undefined) {
    const siguienteNombre = limpiarTexto(rawName);
    if (!siguienteNombre) {
      return res.status(400).json({ success: false, error: "El nombre de la galeria no puede quedar vacio." });
    }
    galeria.name = siguienteNombre;
    cambio = true;
  }

  if (rawDescription !== undefined) {
    galeria.description = limpiarTexto(rawDescription);
    cambio = true;
  }

  if (!cambio) {
    return res.status(400).json({ success: false, error: "No se recibieron cambios para actualizar." });
  }

  galeria.updatedAt = new Date();
  agregarEntradaHistorialGaleria(galeria, "update", `Galeria editada por ${actor.name ?? "sistema"}.`);
  await galeria.save();

  await registrarAuditoria({
    actor,
    action: "galleries:update",
    status: "success",
    message: `Galeria ${galeria.id} actualizada.`,
    target: { id: galeria.id }
  });

  const [payload] = await construirListadoGalerias([galeria]);
  res.json({ success: true, gallery: payload ?? aGaleriaPublica(galeria) });
});

router.post("/:id/photos", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "galleries:upload", "Rol sin permisos para subir fotos.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const galeria = await ModeloGaleria.findOne({ id: req.params.id });
  if (!galeria) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  const sesion = await ModeloSesion.findOne({ id: galeria.sessionId });

  if (actor.role !== "photographer-admin" && galeria.photographerId !== actor.id) {
    await registrarPermisoDenegado(actor, "galleries:upload", "Intento de subir fotos a galeria ajena.", {
      galleryId: galeria.id,
      ownerId: galeria.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes modificar esa galeria." });
  }

  if (galeria.status === "delivered" || galeria.status === "received") {
    return res
      .status(400)
      .json({ success: false, error: "Coloca la galeria en revision antes de subir nuevas fotos." });
  }

  const loader = subidaGaleria.array("files", MAX_ARCHIVOS_POR_SUBIDA);
  loader(req, res, async (error) => {
    if (error) {
      console.error("[galerias][upload] Error procesando imagenes", error);
      let mensaje = "No se pudieron subir las imagenes.";
      if (error.code === "LIMIT_FILE_SIZE") {
        mensaje = "Una de las imagenes supera el limite de 25MB.";
      } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
        mensaje = "Se intentaron subir demasiados archivos en una sola carga.";
      } else if (error?.code === "INVALID_FILE_TYPE") {
        mensaje = "Formato de archivo no soportado. Usa JPG o PNG.";
      }
      return res.status(400).json({ success: false, error: mensaje });
    }

    const archivos = Array.isArray(req.files) ? req.files : [];
    if (archivos.length === 0) {
      return res.status(400).json({ success: false, error: "Selecciona al menos una imagen JPG o PNG." });
    }

    const fotosNuevas = archivos.map((archivo) => {
      const rutaRelativa = path.relative(rutasServidor.uploads, archivo.path).replace(/\\/g, "/");
      return {
        id: uuid(),
        filename: path.basename(archivo.path),
        originalName: archivo.originalname ?? path.basename(archivo.path),
        mimeType: archivo.mimetype,
        size: archivo.size,
        storagePath: rutaRelativa,
        url: `/uploads/${rutaRelativa}`,
        uploadedAt: new Date()
      };
    });

    galeria.photos.push(...fotosNuevas);
    galeria.updatedAt = new Date();
    agregarEntradaHistorialGaleria(galeria, "upload", `Se cargaron ${fotosNuevas.length} fotos.`);
    await galeria.save();

    await registrarAuditoria({
      actor,
      action: "galleries:upload",
      status: "success",
      message: `Se subieron ${fotosNuevas.length} fotos a la galeria ${galeria.id}.`,
      target: { id: galeria.id },
      metadata: { photoIds: fotosNuevas.map((foto) => foto.id) }
    });

    await registrarEventoCronologia({
      type: TIPOS_EVENTO_CRONOLOGIA.GALLERY_PHOTOS_UPLOADED,
      session: sesion,
      actor,
      galleryId: galeria.id,
      clientId: galeria.clientId,
      photographerId: galeria.photographerId,
      title: `${fotosNuevas.length} fotos cargadas`,
      description: `Se agregaron ${fotosNuevas.length} foto(s) a la galeria ${galeria.name}.`,
      payload: {
        count: fotosNuevas.length,
        photoIds: fotosNuevas.map((foto) => foto.id)
      }
    });

    const [payload] = await construirListadoGalerias([galeria]);
    res.json({ success: true, gallery: payload ?? aGaleriaPublica(galeria) });
  });
});

router.patch("/:id/status", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "galleries:status", "Rol sin permisos para actualizar estado de galerias.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const galeria = await ModeloGaleria.findOne({ id: req.params.id });
  if (!galeria) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  const sesion = await ModeloSesion.findOne({ id: galeria.sessionId });

  if (actor.role !== "photographer-admin" && galeria.photographerId !== actor.id) {
    await registrarPermisoDenegado(actor, "galleries:status", "Intento de actualizar galeria ajena.", {
      galleryId: galeria.id,
      ownerId: galeria.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes actualizar esa galeria." });
  }

  const estadoSiguiente = typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";
  if (!estadoSiguiente) {
    return res.status(400).json({ success: false, error: "Indica el estado a establecer." });
  }
  if (!CONJUNTO_ESTADO_GALERIA.has(estadoSiguiente)) {
    return res.status(400).json({ success: false, error: "Estado de galeria desconocido." });
  }
  if (estadoSiguiente === "received") {
    return res.status(400).json({ success: false, error: "Solo el cliente puede confirmar la recepcion." });
  }
  if (estadoSiguiente === "delivered" && (galeria.photos?.length ?? 0) === 0) {
    return res.status(400).json({ success: false, error: "Agrega al menos una foto antes de marcar como entregada." });
  }

  if (galeria.status === estadoSiguiente) {
    const [payload] = await construirListadoGalerias([galeria]);
    return res.json({ success: true, gallery: payload ?? aGaleriaPublica(galeria) });
  }

  galeria.status = estadoSiguiente;
  const ahora = new Date();
  galeria.updatedAt = ahora;
  if (estadoSiguiente === "delivered") {
    galeria.deliveredAt = ahora;
  } else {
    galeria.deliveredAt = undefined;
    galeria.receivedAt = undefined;
  }

  agregarEntradaHistorialGaleria(
    galeria,
    "status",
    `Estado actualizado a ${ETIQUETAS_ESTADO_GALERIA[estadoSiguiente] ?? estadoSiguiente} por ${actor.name ?? "sistema"}.`
  );
  await galeria.save();

  let notificacionEnviada = false;
  let notificationError;
  if (estadoSiguiente === "delivered") {
    const cliente = await ModeloUsuario.findOne({ id: galeria.clientId });
    const sesionAsociada = await ModeloSesion.findOne({ id: galeria.sessionId });
    if (!cliente) {
      notificationError = "client-not-found";
    } else {
      const resultado = await enviarNotificacionUsuario({
        usuario: cliente,
        type: "gallery-delivered",
        title: "Tu galeria esta lista",
        message: sesionAsociada
          ? `Tus fotos de la sesion "${sesionAsociada.type}" estan listas para revisar.`
          : "Tus fotos estan listas para revisar.",
        metadata: { galleryId: galeria.id, sessionId: galeria.sessionId }
      });
      notificacionEnviada = resultado.delivered;
      notificationError = notificacionEnviada ? undefined : resultado.reason;
    }
  }

  const estadoAuditoria =
    estadoSiguiente === "delivered" && notificationError && notificationError !== "client-not-found"
      ? "error"
      : "success";

  await registrarAuditoria({
    actor,
    action: "galleries:status",
    status: estadoAuditoria,
    message: `Galeria ${galeria.id} actualizada a estado ${estadoSiguiente}.`,
    target: { id: galeria.id },
    metadata: { status: estadoSiguiente, notificationSent: notificacionEnviada, notificationError }
  });

  let tipoEvento;
  let tituloEvento;
  let descripcionEvento;
  switch (estadoSiguiente) {
    case "delivered":
      tipoEvento = TIPOS_EVENTO_CRONOLOGIA.GALLERY_DELIVERED;
      tituloEvento = "Galeria entregada";
      descripcionEvento = "Galeria marcada como entregada.";
      break;
    case "review":
      tipoEvento = TIPOS_EVENTO_CRONOLOGIA.GALLERY_REVIEW;
      tituloEvento = "Galeria en revision";
      descripcionEvento = "Galeria disponible para revision interna.";
      break;
    default:
      tipoEvento = TIPOS_EVENTO_CRONOLOGIA.GALLERY_PENDING;
      tituloEvento = "Galeria pendiente";
      descripcionEvento = "Galeria marcada como pendiente.";
      break;
  }

  await registrarEventoCronologia({
    type: tipoEvento,
    session: sesion,
    actor,
    galleryId: galeria.id,
    clientId: galeria.clientId,
    photographerId: galeria.photographerId,
    title: tituloEvento,
    description: descripcionEvento,
    payload: {
      status: estadoSiguiente,
      notificationSent: notificacionEnviada,
      notificationError
    }
  });

  const [payload] = await construirListadoGalerias([galeria]);
  res.json({
    success: true,
    gallery: payload ?? aGaleriaPublica(galeria),
    notificationSent: notificacionEnviada,
    notificationError: notificacionEnviada ? undefined : notificationError
  });
});

router.post("/:id/confirm", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (actor.role !== "client") {
    await registrarPermisoDenegado(actor, "galleries:confirm", "Solo los clientes pueden confirmar entregas.", {
      galleryId: req.params.id
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const galeria = await ModeloGaleria.findOne({ id: req.params.id });
  if (!galeria) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  if (galeria.clientId !== actor.id) {
    await registrarPermisoDenegado(actor, "galleries:confirm", "Cliente intento confirmar galeria ajena.", {
      galleryId: galeria.id
    });
    return res.status(403).json({ success: false, error: "No puedes confirmar esa galeria." });
  }

  if (galeria.status !== "delivered") {
    return res.status(400).json({ success: false, error: "Solo puedes confirmar galerias entregadas." });
  }

  if ((galeria.photos?.length ?? 0) === 0) {
    return res.status(400).json({ success: false, error: "La galeria aun no tiene fotos cargadas." });
  }

  const sesion = await ModeloSesion.findOne({ id: galeria.sessionId });

  galeria.status = "received";
  const ahora = new Date();
  galeria.receivedAt = ahora;
  galeria.updatedAt = ahora;
  agregarEntradaHistorialGaleria(galeria, "confirm", `Confirmacion de recepcion por ${actor.name ?? "cliente"}.`);
  await galeria.save();

  const fotografo = await ModeloUsuario.findOne({ id: galeria.photographerId });
  let notificationSent = false;
  let notificationError;
  if (fotografo) {
    const resultado = await enviarNotificacionUsuario({
      usuario: fotografo,
      type: "gallery-received",
      title: "Entrega confirmada",
      message: `${actor.name} confirmo la recepcion de la galeria "${galeria.name}".`,
      metadata: { galleryId: galeria.id, clientId: actor.id }
    });
    notificationSent = resultado.delivered;
    notificationError = notificationSent ? undefined : resultado.reason;
  } else {
    notificationError = "photographer-not-found";
  }

  const auditStatus = notificationSent || notificationError === "photographer-not-found" ? "success" : "error";

  await registrarAuditoria({
    actor,
    action: "galleries:confirm",
    status: auditStatus,
    message: `Cliente confirmo la recepcion de la galeria ${galeria.id}.`,
    target: { id: galeria.id, email: fotografo?.email },
    metadata: { galleryId: galeria.id, notificationSent, notificationError }
  });

  await registrarEventoCronologia({
    type: TIPOS_EVENTO_CRONOLOGIA.GALLERY_CONFIRMED,
    session: sesion,
    actor,
    galleryId: galeria.id,
    clientId: galeria.clientId,
    photographerId: galeria.photographerId,
    title: "Entrega confirmada",
    description: `El cliente confirmo la recepcion de la galeria ${galeria.name}.`,
    payload: { galleryId: galeria.id, notificationSent, notificationError }
  });

  const [payloadConfirm] = await construirListadoGalerias([galeria]);
  res.json({
    success: true,
    gallery: payloadConfirm ?? aGaleriaPublica(galeria),
    notificationSent,
    notificationError: notificationSent ? undefined : notificationError
  });
});
export default router;


