import { Router } from "express";
import { v4 as uuid } from "uuid";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import {
  ModeloSesion,
  ModeloUsuario,
  ModeloTipoSesion
} from "../modelos/index.js";
import { esRolFotografo } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import {
  convertirTextoADate,
  formatearFechaCorta
} from "../servicios/tiempo.js";
import {
  asegurarDentroDisponibilidad,
  buscarConflictoSesion,
  aSesionPublica
} from "../servicios/sesiones.js";
import {
  obtenerPoliticaCancelacionActiva,
  construirInstantaneaPolitica,
  POLITICA_CANCELACION_POR_DEFECTO,
  evaluarVentanaPolitica
} from "../servicios/politicas.js";
import { normalizarNombreTipoSesion, limpiarTexto } from "../servicios/cadenas.js";
import { agregarEntradaHistorial } from "../servicios/historial.js";
import { enviarNotificacionUsuario } from "../servicios/notificaciones.js";
import {
  CLAVES_PLANTILLAS,
  renderizarPlantillaNotificacion
} from "../servicios/plantillas.js";
import { correoHabilitado, enviarCorreo } from "../servicios/correo.js";
import {
  registrarEventoCronologia,
  TIPOS_EVENTO_CRONOLOGIA,
  construirEventosCronologia
} from "../servicios/cronologia.js";
import { aUsuarioPublico } from "../servicios/usuarios.js";

const router = Router();

router.get("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  const { from, to, clientId, type, status, photographerId } = req.query ?? {};

  // Aqui delimito el alcance de la consulta para no mezclar sesiones ajenas.
  const filtro = {};
  if (esRolFotografo(actor.role)) {
    let fotografoConsulta = actor.id;
    if (actor.role === "photographer-admin" && typeof photographerId === "string" && photographerId.trim()) {
      fotografoConsulta = photographerId.trim();
    }
    if (actor.role !== "photographer-admin" && fotografoConsulta !== actor.id) {
      await registrarPermisoDenegado(actor, "sessions:list", "Intento de consultar sesiones de otro fotografo.", {
        requestedPhotographerId: fotografoConsulta
      });
      return res.status(403).json({ success: false, error: "Permisos insuficientes." });
    }
    filtro.photographerId = fotografoConsulta;
  } else if (actor.role === "client") {
    filtro.clientId = actor.id;
  } else {
    await registrarPermisoDenegado(actor, "sessions:list", "Rol sin permisos para consultar sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  if (typeof clientId === "string" && clientId.trim()) {
    filtro.clientId = clientId.trim();
  }
  if (
    typeof status === "string" &&
    ["scheduled", "confirmed", "client-confirmed", "completed", "cancelled"].includes(status.trim())
  ) {
    filtro.status = status.trim();
  }
  if (typeof type === "string" && type.trim()) {
    filtro.type = { $regex: new RegExp(type.trim(), "i") };
  }

  const rangoFechas = {};
  if (typeof from === "string" && from.trim()) {
    const desde = convertirTextoADate(from);
    if (!desde) {
      return res.status(400).json({ success: false, error: "Parametro 'from' invalido." });
    }
    rangoFechas.$gte = desde;
  }
  if (typeof to === "string" && to.trim()) {
    const hasta = convertirTextoADate(to);
    if (!hasta) {
      return res.status(400).json({ success: false, error: "Parametro 'to' invalido." });
    }
    hasta.setHours(23, 59, 59, 999);
    rangoFechas.$lte = hasta;
  }
  if (Object.keys(rangoFechas).length > 0) {
    filtro.start = rangoFechas;
  }

  const sesiones = await ModeloSesion.find(filtro).sort({ start: 1 });
  const idsRelacionados = new Set();
  for (const sesion of sesiones) {
    idsRelacionados.add(sesion.photographerId);
    idsRelacionados.add(sesion.clientId);
  }
  const usuariosRelacionados = await ModeloUsuario.find({ id: { $in: Array.from(idsRelacionados) } }).select({
    id: 1,
    name: 1,
    email: 1,
    role: 1
  });
  const mapaUsuarios = new Map(usuariosRelacionados.map((usuario) => [usuario.id, usuario]));

  const payload = sesiones.map((sesion) =>
    aSesionPublica(sesion, {
      photographer: mapaUsuarios.has(sesion.photographerId)
        ? {
            id: sesion.photographerId,
            name: mapaUsuarios.get(sesion.photographerId).name,
            email: mapaUsuarios.get(sesion.photographerId).email
          }
        : undefined,
      client: mapaUsuarios.has(sesion.clientId)
        ? {
            id: sesion.clientId,
            name: mapaUsuarios.get(sesion.clientId).name,
            email: mapaUsuarios.get(sesion.clientId).email
          }
        : undefined
    })
  );

  res.json({ success: true, sessions: payload });
});

router.post("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "sessions:create", "Rol sin permisos para crear sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const { clientId, type, sessionTypeId, location, start, end, notes } = req.body ?? {};
  if (!clientId?.trim() || (!type?.trim() && !sessionTypeId) || !location?.trim() || !start || !end) {
    return res.status(400).json({ success: false, error: "Datos incompletos para crear la sesion." });
  }

  const cliente = await ModeloUsuario.findOne({ id: clientId.trim(), role: "client" });
  if (!cliente) {
    return res.status(404).json({ success: false, error: "Cliente no encontrado." });
  }
  if (actor.role !== "photographer-admin" && cliente.ownerId && cliente.ownerId !== actor.id) {
    await registrarPermisoDenegado(actor, "sessions:create", "Intento de asignar cliente ajeno.", {
      clientId: cliente.id,
      ownerId: cliente.ownerId
    });
    return res.status(403).json({ success: false, error: "No puedes asignar sesiones a ese cliente." });
  }

  const fechaInicio = convertirTextoADate(start);
  const fechaFin = convertirTextoADate(end);
  if (!fechaInicio || !fechaFin) {
    return res.status(400).json({ success: false, error: "Las fechas proporcionadas no son validas." });
  }
  if (fechaFin <= fechaInicio) {
    return res.status(400).json({ success: false, error: "La hora de fin debe ser posterior a la de inicio." });
  }

  const disponibilidad = asegurarDentroDisponibilidad(actor, fechaInicio, fechaFin);
  if (!disponibilidad.ok) {
    return res.status(409).json({ success: false, error: disponibilidad.error });
  }

  const conflicto = await buscarConflictoSesion({
    photographerId: actor.id,
    start: fechaInicio,
    end: fechaFin
  });
  if (conflicto) {
    return res.status(409).json({ success: false, error: "Ya existe una sesion programada en ese horario." });
  }

  let tipoSesion;
  if (sessionTypeId) {
    tipoSesion = await ModeloTipoSesion.findOne({ id: sessionTypeId, archived: false });
    if (!tipoSesion) {
      return res.status(400).json({ success: false, error: "Tipo de sesion no encontrado o archivado." });
    }
  } else {
    const normalizado = normalizarNombreTipoSesion(type);
    tipoSesion = await ModeloTipoSesion.findOne({ normalizedName: normalizado, archived: false });
    if (!tipoSesion) {
      return res
        .status(400)
        .json({ success: false, error: "El tipo de sesion no existe en el catalogo. Actualiza el catalogo primero." });
    }
  }

  // Congelo la politica vigente para que la sesion no cambie de reglas a mitad del ciclo.
  const politicaActiva = await obtenerPoliticaCancelacionActiva();
  const capturaPolitica = politicaActiva
    ? construirInstantaneaPolitica(politicaActiva)
    : construirInstantaneaPolitica({
        version: 1,
        settings: POLITICA_CANCELACION_POR_DEFECTO
      });

  const sesion = await ModeloSesion.create({
    id: uuid(),
    photographerId: actor.id,
    clientId: cliente.id,
    type: tipoSesion.name,
    sessionTypeId: tipoSesion.id,
    location: location.trim(),
    notes: limpiarTexto(notes),
    start: fechaInicio,
    end: fechaFin,
    status: "scheduled",
    policySnapshot: capturaPolitica,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const etiquetaMomento = formatearFechaCorta(fechaInicio);
  agregarEntradaHistorial(actor, "session-create", `Sesion programada con ${cliente.name} para ${etiquetaMomento}`);
  await actor.save();
  agregarEntradaHistorial(cliente, "session-create", `Sesion programada con ${actor.name} para ${etiquetaMomento}`);
  await cliente.save();

  let correoEnviado = false;
  let errorCorreo;
  if (correoHabilitado()) {
    const asunto = "Nueva sesion programada";
    const texto = `Hola ${cliente.name},\n\nSe ha programado una nueva sesion con ${actor.name} para ${etiquetaMomento} en ${location.trim()}.\n\nTipo de sesion: ${type.trim()}.\n\nPor favor confirma tu disponibilidad.`;
    const html = `<p>Hola ${cliente.name},</p><p>Se ha programado una nueva sesion con <strong>${actor.name}</strong>.</p><ul><li><strong>Fecha y hora:</strong> ${etiquetaMomento}</li><li><strong>Tipo:</strong> ${type.trim()}</li><li><strong>Ubicacion:</strong> ${location.trim()}</li></ul><p>Por favor confirma tu disponibilidad.</p>`;
    const resultado = await enviarCorreo({ to: cliente.email, subject: asunto, text: texto, html });
    correoEnviado = resultado.success;
    errorCorreo = resultado.success ? undefined : resultado.error;
  }

  const recordatorio = formatearFechaCorta(fechaInicio);
  const resultadoNotificacion = await enviarNotificacionUsuario({
    usuario: cliente,
    type: "session-created",
    title: "Nueva sesion programada",
    message: `Se programo una sesion con ${actor.name} para ${recordatorio} en ${location.trim()}.`,
    sessionId: sesion.id,
    metadata: { start: fechaInicio, location: location.trim(), type: type.trim() }
  });

  const notificacionEnviada = correoEnviado || resultadoNotificacion.delivered;
  const errorNotificacion = notificacionEnviada ? undefined : resultadoNotificacion.reason ?? errorCorreo;

  await registrarAuditoria({
    actor,
    action: "sessions:create",
    status: notificacionEnviada ? "success" : correoHabilitado() ? "error" : "success",
    message: notificacionEnviada
      ? `Sesion ${sesion.id} programada y notificada al cliente.`
      : correoHabilitado()
      ? `Sesion ${sesion.id} programada, pero el correo fallo: ${errorNotificacion ?? "error desconocido"}.`
      : `Sesion ${sesion.id} programada (SMTP no disponible).`,
    target: { id: sesion.id },
    metadata: { clientId: cliente.id, start: fechaInicio, end: fechaFin }
  });

  await registrarEventoCronologia({
    type: TIPOS_EVENTO_CRONOLOGIA.SESSION_CREATED,
    session: sesion,
    actor,
    title: "Sesion programada",
    description: `Sesion programada para ${formatearFechaCorta(fechaInicio)} en ${location.trim()}.`,
    payload: {
      start: fechaInicio,
      end: fechaFin,
      type: sesion.type,
      location: location.trim()
    }
  });

  res.status(201).json({
    success: true,
    session: aSesionPublica(sesion, {
      photographer: { id: actor.id, name: actor.name, email: actor.email },
      client: { id: cliente.id, name: cliente.name, email: cliente.email }
    }),
    notificationSent: notificacionEnviada,
    notificationError: notificacionEnviada ? undefined : errorNotificacion
  });
});

router.patch("/:id", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "sessions:update", "Rol sin permisos para editar sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const sesion = await ModeloSesion.findOne({ id: req.params.id });
  if (!sesion) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }

  if (sesion.photographerId !== actor.id && actor.role !== "photographer-admin") {
    await registrarPermisoDenegado(actor, "sessions:update", "Intento de editar sesion de otro fotografo.", {
      sessionId: sesion.id,
      ownerId: sesion.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes editar esa sesion." });
  }

  if (sesion.status === "cancelled") {
    return res.status(400).json({ success: false, error: "No se pueden editar sesiones canceladas." });
  }

  const cambios = req.body ?? {};
  const cliente = await ModeloUsuario.findOne({ id: sesion.clientId });
  const fotografo =
    sesion.photographerId === actor.id ? actor : (await ModeloUsuario.findOne({ id: sesion.photographerId })) ?? actor;

  const inicioAnterior = sesion.start;
  const finAnterior = sesion.end;
  const nombreTipoAnterior = sesion.type;
  const idTipoAnterior = sesion.sessionTypeId;
  const ubicacionAnterior = sesion.location;
  const notasAnteriores = sesion.notes;
  const instantaneaPolitica =
    sesion.policySnapshot ?? construirInstantaneaPolitica({ version: 1, settings: POLITICA_CANCELACION_POR_DEFECTO });

  let siguienteInicio = sesion.start;
  let siguienteFin = sesion.end;
  let cambioHorario = false;

  if (cambios.start) {
    const parseado = convertirTextoADate(cambios.start);
    if (!parseado) {
      return res.status(400).json({ success: false, error: "La nueva fecha de inicio no es valida." });
    }
    if (parseado.getTime() !== sesion.start.getTime()) {
      siguienteInicio = parseado;
      cambioHorario = true;
    }
  }
  if (cambios.end) {
    const parseado = convertirTextoADate(cambios.end);
    if (!parseado) {
      return res.status(400).json({ success: false, error: "La nueva fecha de fin no es valida." });
    }
    if (parseado.getTime() !== sesion.end.getTime()) {
      siguienteFin = parseado;
      cambioHorario = true;
    }
  }

  if (siguienteFin <= siguienteInicio) {
    return res.status(400).json({ success: false, error: "La hora de fin debe ser posterior a la de inicio." });
  }

  if (cambioHorario) {
    const verificacionPolitica = evaluarVentanaPolitica(instantaneaPolitica, inicioAnterior, "reschedule");
    if (!verificacionPolitica.allowed) {
      return res.status(409).json({ success: false, error: verificacionPolitica.message });
    }
    const disponibilidad = asegurarDentroDisponibilidad(fotografo, siguienteInicio, siguienteFin);
    if (!disponibilidad.ok) {
      return res.status(409).json({ success: false, error: disponibilidad.error });
    }
    const conflicto = await buscarConflictoSesion({
      photographerId: sesion.photographerId,
      start: siguienteInicio,
      end: siguienteFin,
      excludeId: sesion.id
    });
    if (conflicto) {
      return res.status(409).json({ success: false, error: "El nuevo horario se traslapa con otra sesion." });
    }
  }

  let nombreTipoSiguiente = sesion.type;
  let idTipoSiguiente = sesion.sessionTypeId;
  // Si me piden ajustar el tipo, valido contra el catalogo para no romper reportes.
  if (cambios.sessionTypeId || cambios.type) {
    let entradaTipo;
    if (cambios.sessionTypeId) {
      entradaTipo = await ModeloTipoSesion.findOne({ id: cambios.sessionTypeId, archived: false });
      if (!entradaTipo) {
        return res.status(400).json({ success: false, error: "Tipo de sesion no encontrado o archivado." });
      }
    } else if (cambios.type) {
      const normalizado = normalizarNombreTipoSesion(cambios.type);
      entradaTipo = await ModeloTipoSesion.findOne({ normalizedName: normalizado, archived: false });
      if (!entradaTipo) {
        return res
          .status(400)
          .json({ success: false, error: "El tipo de sesion no existe en el catalogo. Actualiza el catalogo primero." });
      }
    }
    if (entradaTipo) {
      nombreTipoSiguiente = entradaTipo.name;
      idTipoSiguiente = entradaTipo.id;
    }
  }

  let ubicacionSiguiente = sesion.location;
  if (cambios.location !== undefined) {
    const saneada = limpiarTexto(cambios.location);
    if (!saneada) {
      return res.status(400).json({ success: false, error: "La ubicacion no puede quedar vacia." });
    }
    ubicacionSiguiente = saneada;
  }

  let notasSiguientes = sesion.notes;
  if (cambios.notes !== undefined) {
    notasSiguientes = cambios.notes === "" ? undefined : limpiarTexto(cambios.notes);
  }

  sesion.start = siguienteInicio;
  sesion.end = siguienteFin;
  sesion.type = nombreTipoSiguiente;
  sesion.sessionTypeId = idTipoSiguiente;
  sesion.location = ubicacionSiguiente;
  sesion.notes = notasSiguientes;
  if (cambioHorario) {
    sesion.reminder48Sent = false;
    sesion.reminder24Sent = false;
  }
  sesion.updatedAt = new Date();
  await sesion.save();

  const detalleCambios = {};
  if (cambioHorario) {
    detalleCambios.schedule = {
      from: { start: inicioAnterior, end: finAnterior },
      to: { start: siguienteInicio, end: siguienteFin }
    };
  }
  if (nombreTipoSiguiente !== nombreTipoAnterior || idTipoSiguiente !== idTipoAnterior) {
    detalleCambios.type = { from: nombreTipoAnterior, to: nombreTipoSiguiente };
  }
  if (ubicacionSiguiente !== ubicacionAnterior) {
    detalleCambios.location = { from: ubicacionAnterior, to: ubicacionSiguiente };
  }
  const notasPrevias = notasAnteriores ?? null;
  const notasNuevas = notasSiguientes ?? null;
  if (notasPrevias !== notasNuevas) {
    detalleCambios.notes = { from: notasAnteriores, to: notasSiguientes };
  }

  const etiqueta = formatearFechaCorta(siguienteInicio);
  const resumenHistorial = cambioHorario ? `Sesion reprogramada para ${etiqueta}` : "Sesion actualizada";
  agregarEntradaHistorial(fotografo, "session-update", resumenHistorial);
  await fotografo.save();
  if (cliente) {
    agregarEntradaHistorial(cliente, "session-update", `${resumenHistorial} con ${fotografo.name}`);
    await cliente.save();
  }

  let correoEnviado = false;
  let errorCorreo;
  if (cliente && correoHabilitado()) {
    const asunto = cambioHorario ? "Sesion reprogramada" : "Actualizacion de sesion";
    const texto = cambioHorario
      ? `Hola ${cliente.name},\n\nLa sesion con ${fotografo.name} ha sido reprogramada para ${etiqueta} en ${sesion.location}.\n\nTipo: ${sesion.type}.`
      : `Hola ${cliente.name},\n\nLa sesion con ${fotografo.name} ha sido actualizada.\n\nTipo: ${sesion.type}\nUbicacion: ${sesion.location}\nFecha y hora: ${etiqueta}.`;
    const html = cambioHorario
      ? `<p>Hola ${cliente.name},</p><p>La sesion con <strong>${fotografo.name}</strong> ha sido reprogramada.</p><ul><li><strong>Nueva fecha:</strong> ${etiqueta}</li><li><strong>Tipo:</strong> ${sesion.type}</li><li><strong>Ubicacion:</strong> ${sesion.location}</li></ul>`
      : `<p>Hola ${cliente.name},</p><p>Se realizaron cambios en tu sesion con <strong>${fotografo.name}</strong>.</p><ul><li><strong>Fecha:</strong> ${etiqueta}</li><li><strong>Tipo:</strong> ${sesion.type}</li><li><strong>Ubicacion:</strong> ${sesion.location}</li></ul>`;
    const resultado = await enviarCorreo({ to: cliente.email, subject: asunto, text: texto, html });
    correoEnviado = resultado.success;
    errorCorreo = resultado.error;
  }

  const mensajeFallback = cambioHorario
    ? `La sesion con ${fotografo.name} fue reprogramada para ${etiqueta} en ${sesion.location}.`
    : `Se actualizaron detalles de la sesion con ${fotografo.name} para ${etiqueta}.`;

  const contextoNotificacion = {
    clientName: cliente?.name ?? "",
    photographerName: fotografo.name,
    sessionDate: etiqueta,
    sessionLocation: sesion.location,
    sessionType: sesion.type,
    sessionNotes: sesion.notes ?? "-",
    fallback: mensajeFallback
  };
  const cuerpoNotificacion = await renderizarPlantillaNotificacion(
    CLAVES_PLANTILLAS.CAMBIO_CANCELACION,
    contextoNotificacion
  );

  const resultadoNotificacion = cliente
    ? await enviarNotificacionUsuario({
        usuario: cliente,
        type: "session-updated",
        title: cambioHorario ? "Sesion reprogramada" : "Sesion actualizada",
        message: cuerpoNotificacion,
        sessionId: sesion.id,
        metadata: {
          start: sesion.start,
          end: sesion.end,
          scheduleChanged: cambioHorario,
          changes: detalleCambios
        }
      })
    : { delivered: false, reason: "client-not-found" };

  const notificacionEnviada = correoEnviado || resultadoNotificacion.delivered;
  const errorNotificacion = notificacionEnviada ? undefined : resultadoNotificacion.reason ?? errorCorreo;

  await registrarAuditoria({
    actor,
    action: "sessions:update",
    status: notificacionEnviada ? "success" : correoHabilitado() ? "error" : "success",
    message: notificacionEnviada
      ? `Sesion ${sesion.id} actualizada y notificada.`
      : correoHabilitado()
      ? `Sesion ${sesion.id} actualizada; el correo fallo: ${errorNotificacion ?? "error desconocido"}.`
      : `Sesion ${sesion.id} actualizada (SMTP no disponible).`,
    target: { id: sesion.id },
    metadata: {
      scheduleChanged: cambioHorario,
      start: sesion.start,
      end: sesion.end,
      changes: detalleCambios
    }
  });

  const tipoEvento = cambioHorario ? TIPOS_EVENTO_CRONOLOGIA.SESSION_RESCHEDULED : TIPOS_EVENTO_CRONOLOGIA.SESSION_UPDATED;
  const descripcionEvento = cambioHorario
    ? `Nueva fecha: ${formatearFechaCorta(sesion.start)} en ${sesion.location}.`
    : "Se actualizaron detalles de la sesion.";

  await registrarEventoCronologia({
    type: tipoEvento,
    session: sesion,
    actor,
    title: cambioHorario ? "Sesion reprogramada" : "Sesion actualizada",
    description: descripcionEvento,
    payload: { changes: detalleCambios }
  });

  res.json({
    success: true,
    session: aSesionPublica(sesion, {
      photographer: { id: fotografo.id, name: fotografo.name, email: fotografo.email },
      client: cliente
        ? { id: cliente.id, name: cliente.name, email: cliente.email }
        : undefined
    }),
    notificationSent: notificacionEnviada,
    notificationError: notificacionEnviada ? undefined : errorNotificacion
  });
});

router.post("/:id/confirm", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "sessions:confirm", "Rol sin permisos para confirmar sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const sesion = await ModeloSesion.findOne({ id: req.params.id });
  if (!sesion) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }
  if (sesion.photographerId !== actor.id && actor.role !== "photographer-admin") {
    await registrarPermisoDenegado(actor, "sessions:confirm", "Intento de confirmar sesion ajena.", {
      sessionId: sesion.id,
      ownerId: sesion.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes confirmar esa sesion." });
  }
  if (sesion.status === "cancelled") {
    return res.status(400).json({ success: false, error: "No se pueden confirmar sesiones canceladas." });
  }

  if (sesion.status === "confirmed" || sesion.status === "client-confirmed") {
    return res.json({
      success: true,
      session: aSesionPublica(sesion),
      notificationSent: false,
      notificationError: undefined,
      message: "La sesion ya estaba confirmada."
    });
  }

  sesion.status = "confirmed";
  sesion.photographerConfirmedAt = new Date();
  sesion.updatedAt = new Date();
  await sesion.save();

  const cliente = await ModeloUsuario.findOne({ id: sesion.clientId });
  const resultadoNotificacion = cliente
    ? await enviarNotificacionUsuario({
        usuario: cliente,
        type: "session-confirmed",
        title: "Sesion confirmada",
        message: await renderizarPlantillaNotificacion(CLAVES_PLANTILLAS.CONFIRMACION, {
          clientName: cliente.name,
          photographerName: actor.name,
          sessionDate: formatearFechaCorta(sesion.start),
          sessionLocation: sesion.location,
          sessionType: sesion.type,
          sessionNotes: sesion.notes ?? "-",
          fallback: `La sesion con ${actor.name} para ${formatearFechaCorta(
            sesion.start
          )} en ${sesion.location} ha sido confirmada.`
        }),
        sessionId: sesion.id,
        metadata: { start: sesion.start, location: sesion.location }
      })
    : { delivered: false, reason: "client-not-found" };

  agregarEntradaHistorial(actor, "session-confirm", "Sesion confirmada para notificar al cliente");
  await actor.save();
  if (cliente) {
    agregarEntradaHistorial(cliente, "session-confirm", `Sesion confirmada por ${actor.name}`);
    await cliente.save();
  }

  await registrarAuditoria({
    actor,
    action: "sessions:confirm",
    status: resultadoNotificacion.delivered ? "success" : "error",
    message: resultadoNotificacion.delivered
      ? `Sesion ${sesion.id} confirmada y notificada.`
      : `Sesion ${sesion.id} confirmada, pero no se pudo notificar: ${resultadoNotificacion.reason ?? "motivo desconocido"}.`,
    target: { id: sesion.id },
    metadata: {
      notified: resultadoNotificacion.delivered
    }
  });

  await registrarEventoCronologia({
    type: TIPOS_EVENTO_CRONOLOGIA.SESSION_CONFIRMED,
    session: sesion,
    actor,
    title: "Sesion confirmada",
    description: `Sesion confirmada para ${formatearFechaCorta(sesion.start)}.`,
    payload: { notificationSent: resultadoNotificacion.delivered }
  });

  res.json({
    success: true,
    session: aSesionPublica(sesion),
    notificationSent: resultadoNotificacion.delivered,
    notificationError: resultadoNotificacion.delivered ? undefined : resultadoNotificacion.reason
  });
});

router.post("/:id/client-confirm", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (actor.role !== "client") {
    await registrarPermisoDenegado(actor, "sessions:client-confirm", "Solo clientes pueden confirmar asistencia.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const sesion = await ModeloSesion.findOne({ id: req.params.id, clientId: actor.id });
  if (!sesion) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada para este cliente." });
  }
  if (sesion.status === "cancelled") {
    return res.status(400).json({ success: false, error: "La sesion fue cancelada y no puede confirmarse." });
  }

  sesion.status = "client-confirmed";
  sesion.clientConfirmedAt = new Date();
  sesion.updatedAt = new Date();
  await sesion.save();

  agregarEntradaHistorial(actor, "session-client-confirm", "Cliente confirmo asistencia a la sesion");
  await actor.save();

  const fotografo = await ModeloUsuario.findOne({ id: sesion.photographerId });
  const resultadoNotificacion = fotografo
    ? await enviarNotificacionUsuario({
        usuario: fotografo,
        type: "session-client-confirmed",
        title: "Cliente confirmo asistencia",
        message: `${actor.name} confirmo su asistencia a la sesion del ${formatearFechaCorta(sesion.start)} en ${sesion.location}.`,
        sessionId: sesion.id,
        metadata: { clientId: actor.id }
      })
    : { delivered: false, reason: "photographer-not-found" };

  await registrarAuditoria({
    actor,
    action: "sessions:client-confirm",
    status: resultadoNotificacion.delivered ? "success" : "error",
    message: resultadoNotificacion.delivered
      ? "Cliente confirmo asistencia y se notifico al fotografo."
      : "Cliente confirmo asistencia pero no se pudo notificar al fotografo.",
    target: { id: sesion.id },
    metadata: { photographerId: sesion.photographerId }
  });

  await registrarEventoCronologia({
    type: TIPOS_EVENTO_CRONOLOGIA.SESSION_CLIENT_CONFIRMED,
    session: sesion,
    actor,
    title: "Cliente confirmo asistencia",
    description: `${actor.name} confirmo su asistencia a la sesion.`,
    payload: { notificationSent: resultadoNotificacion.delivered }
  });

  res.json({
    success: true,
    session: aSesionPublica(sesion),
    notificationSent: resultadoNotificacion.delivered,
    notificationError: resultadoNotificacion.delivered ? undefined : resultadoNotificacion.reason
  });
});

router.post("/:id/cancel", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "sessions:cancel", "Rol sin permisos para cancelar sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const sesion = await ModeloSesion.findOne({ id: req.params.id });
  if (!sesion) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }

  if (sesion.photographerId !== actor.id && actor.role !== "photographer-admin") {
    await registrarPermisoDenegado(actor, "sessions:cancel", "Intento de cancelar sesion ajena.", {
      sessionId: sesion.id,
      ownerId: sesion.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes cancelar esa sesion." });
  }

  if (sesion.status === "cancelled") {
    return res.json({ success: true, session: aSesionPublica(sesion) });
  }

  const motivo = limpiarTexto(req.body?.reason);
  const instantaneaPolitica =
    sesion.policySnapshot ?? construirInstantaneaPolitica({ version: 1, settings: POLITICA_CANCELACION_POR_DEFECTO });
  // Validamos la ventana de politica antes de cancelar para evitar sorpresas de ultimos minutos.
  const verificacionPolitica = evaluarVentanaPolitica(instantaneaPolitica, sesion.start, "cancel");
  if (!verificacionPolitica.allowed) {
    return res.status(409).json({ success: false, error: verificacionPolitica.message });
  }
  const cliente = await ModeloUsuario.findOne({ id: sesion.clientId });
  const fotografo =
    sesion.photographerId === actor.id
      ? actor
      : (await ModeloUsuario.findOne({ id: sesion.photographerId })) ?? actor;

  sesion.status = "cancelled";
  sesion.cancellationReason = motivo;
  sesion.cancelledAt = new Date();
  sesion.updatedAt = new Date();
  await sesion.save();

  const resumen = `Sesion cancelada para ${formatearFechaCorta(sesion.start)}`;
  agregarEntradaHistorial(fotografo, "session-cancel", resumen);
  await fotografo.save();
  if (cliente) {
    agregarEntradaHistorial(cliente, "session-cancel", `${resumen} con ${fotografo.name}`);
    await cliente.save();
  }

  let correoEnviado = false;
  let errorCorreo;
  if (cliente && correoHabilitado()) {
    const asunto = "Sesion cancelada";
    const etiqueta = formatearFechaCorta(sesion.start);
    const texto = `Hola ${cliente.name},\n\nLa sesion con ${fotografo.name} programada para ${etiqueta} ha sido cancelada${
      motivo ? `.\n\nMotivo: ${motivo}` : "."
    }\n\nSi deseas reprogramar, contacta al fotografo.`;
    const htmlMotivo = motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : "";
    const html = `<p>Hola ${cliente.name},</p><p>La sesion con <strong>${fotografo.name}</strong> programada para ${etiqueta} ha sido cancelada.</p>${htmlMotivo}<p>Si deseas reprogramar, contacta al fotografo.</p>`;
    const resultado = await enviarCorreo({ to: cliente.email, subject: asunto, text: texto, html });
    correoEnviado = resultado.success;
    errorCorreo = resultado.error;
  }

  const etiqueta = formatearFechaCorta(sesion.start);
  const mensajeFallback = `La sesion con ${fotografo.name} para ${etiqueta} fue cancelada${
    motivo ? ` (${motivo})` : ""
  }.`;

  const cuerpoNotificacion = await renderizarPlantillaNotificacion(CLAVES_PLANTILLAS.CAMBIO_CANCELACION, {
    clientName: cliente?.name ?? "",
    photographerName: fotografo.name,
    sessionDate: etiqueta,
    sessionLocation: sesion.location,
    sessionType: sesion.type,
    sessionNotes: sesion.notes ?? "-",
    fallback: mensajeFallback
  });

  const resultadoNotificacion = cliente
    ? await enviarNotificacionUsuario({
        usuario: cliente,
        type: "session-cancelled",
        title: "Sesion cancelada",
        message: cuerpoNotificacion,
        sessionId: sesion.id,
        metadata: { reason: motivo, policyVersion: instantaneaPolitica.version }
      })
    : { delivered: false, reason: "client-not-found" };

  const notificacionEnviada = correoEnviado || resultadoNotificacion.delivered;
  const errorNotificacion = notificacionEnviada ? undefined : resultadoNotificacion.reason ?? errorCorreo;

  await registrarAuditoria({
    actor,
    action: "sessions:cancel",
    status: notificacionEnviada ? "success" : correoHabilitado() ? "error" : "success",
    message: notificacionEnviada
      ? `Sesion ${sesion.id} cancelada y notificada.`
      : correoHabilitado()
      ? `Sesion ${sesion.id} cancelada; el correo fallo: ${errorNotificacion ?? "error desconocido"}.`
      : `Sesion ${sesion.id} cancelada (SMTP no disponible).`,
    target: { id: sesion.id },
    metadata: { reason: motivo, policyVersion: instantaneaPolitica.version }
  });

  await registrarEventoCronologia({
    type: TIPOS_EVENTO_CRONOLOGIA.SESSION_CANCELLED,
    session: sesion,
    actor,
    title: "Sesion cancelada",
    description: `Sesion cancelada para ${formatearFechaCorta(sesion.start)}.`,
    payload: { reason: motivo }
  });

  res.json({
    success: true,
    session: aSesionPublica(sesion, {
      photographer: { id: fotografo.id, name: fotografo.name, email: fotografo.email },
      client: cliente ? { id: cliente.id, name: cliente.name, email: cliente.email } : undefined
    }),
    notificationSent: notificacionEnviada,
    notificationError: notificacionEnviada ? undefined : errorNotificacion
  });
});

router.post("/:id/notes", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!esRolFotografo(actor.role)) {
    await registrarPermisoDenegado(actor, "sessions:note", "Rol sin permisos para agregar notas.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const sesion = await ModeloSesion.findOne({ id: req.params.id });
  if (!sesion) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }
  if (sesion.photographerId !== actor.id && actor.role !== "photographer-admin") {
    await registrarPermisoDenegado(actor, "sessions:note", "Intento de agregar nota a sesion ajena.", {
      sessionId: sesion.id,
      ownerId: sesion.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes agregar notas a esa sesion." });
  }
  const nota = limpiarTexto(req.body?.note);
  if (!nota) {
    return res.status(400).json({ success: false, error: "La nota no puede quedar vacia." });
  }
  const eventoCreado = await registrarEventoCronologia({
    type: TIPOS_EVENTO_CRONOLOGIA.SESSION_NOTE,
    session: sesion,
    actor,
    title: "Nota agregada",
    description: nota,
    payload: { note: nota }
  });

  const cliente = await ModeloUsuario.findOne({ id: sesion.clientId });
  const fotografo =
    sesion.photographerId === actor.id
      ? actor
      : (await ModeloUsuario.findOne({ id: sesion.photographerId })) ?? actor;
  agregarEntradaHistorial(fotografo, "session-note", `Nota agregada a la sesion ${sesion.id}`);
  await fotografo.save();
  if (cliente) {
    agregarEntradaHistorial(cliente, "session-note", `Nota agregada por ${actor.name}`);
    await cliente.save();
  }

  const [evento] = await construirEventosCronologia([eventoCreado]);
  res.status(201).json({ success: true, event: evento ?? eventoCreado });
});

export default router;
