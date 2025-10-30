import { Router } from "express";
import { v4 as uuid } from "uuid";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ModeloTipoSesion } from "../modelos/index.js";
import { usuarioTienePermiso } from "../servicios/permisos.js";
import { registrarAuditoria, registrarPermisoDenegado } from "../servicios/auditoria.js";
import { normalizarNombreTipoSesion, limpiarTexto } from "../servicios/cadenas.js";
import { aTipoSesionPublico } from "../servicios/sesiones.js";

const router = Router();

router.get("/", autenticarSolicitud, async (req, res) => {
  const includeArchived = req.query?.includeArchived === "true";
  const filtro = includeArchived ? {} : { archived: false };
  const tipos = await ModeloTipoSesion.find(filtro).sort({ name: 1 });
  res.json({
    success: true,
    types: tipos.map(aTipoSesionPublico)
  });
});

router.post("/", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "actions:critical")) {
    await registrarPermisoDenegado(actor, "session-types:create", "Rol sin permisos para crear tipos de sesion.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const nombre = limpiarTexto(req.body?.name);
  if (!nombre) {
    return res.status(400).json({ success: false, error: "Ingresa el nombre del tipo de sesion." });
  }
  const descripcion = limpiarTexto(req.body?.description);
  const normalizado = normalizarNombreTipoSesion(nombre);
  const existe = await ModeloTipoSesion.findOne({ normalizedName: normalizado });
  if (existe) {
    return res.status(400).json({ success: false, error: "Ya existe un tipo de sesion con ese nombre." });
  }
  const entrada = await ModeloTipoSesion.create({
    id: uuid(),
    name: nombre,
    normalizedName: normalizado,
    description: descripcion,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  await registrarAuditoria({
    actor,
    action: "session-types:create",
    status: "success",
    message: `Tipo de sesion "${nombre}" creado.`,
    metadata: { sessionTypeId: entrada.id }
  });
  res.status(201).json({ success: true, sessionType: aTipoSesionPublico(entrada) });
});

router.patch("/:id", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "actions:critical")) {
    await registrarPermisoDenegado(actor, "session-types:update", "Rol sin permisos para editar tipos de sesion.", {
      sessionTypeId: req.params.id
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const entrada = await ModeloTipoSesion.findOne({ id: req.params.id });
  if (!entrada) {
    return res.status(404).json({ success: false, error: "Tipo de sesion no encontrado." });
  }
  const { name, description } = req.body ?? {};
  if (name !== undefined) {
    const nombreLimpio = limpiarTexto(name);
    if (!nombreLimpio) {
      return res.status(400).json({ success: false, error: "El nombre no puede quedar vacio." });
    }
    const normalizado = normalizarNombreTipoSesion(nombreLimpio);
    const existe = await ModeloTipoSesion.findOne({
      normalizedName: normalizado,
      id: { $ne: entrada.id }
    });
    if (existe) {
      return res.status(400).json({ success: false, error: "Ya existe otro tipo de sesion con ese nombre." });
    }
    entrada.name = nombreLimpio;
    entrada.normalizedName = normalizado;
  }
  if (description !== undefined) {
    entrada.description = limpiarTexto(description);
  }
  entrada.updatedAt = new Date();
  await entrada.save();
  await registrarAuditoria({
    actor,
    action: "session-types:update",
    status: "success",
    message: `Tipo de sesion ${entrada.id} actualizado.`,
    metadata: { sessionTypeId: entrada.id }
  });
  res.json({ success: true, sessionType: aTipoSesionPublico(entrada) });
});

router.delete("/:id", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "actions:critical")) {
    await registrarPermisoDenegado(actor, "session-types:archive", "Rol sin permisos para eliminar tipos de sesion.", {
      sessionTypeId: req.params.id
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const entrada = await ModeloTipoSesion.findOne({ id: req.params.id });
  if (!entrada) {
    return res.status(404).json({ success: false, error: "Tipo de sesion no encontrado." });
  }
  if (!entrada.archived) {
    entrada.archived = true;
    entrada.updatedAt = new Date();
    await entrada.save();
  }
  await registrarAuditoria({
    actor,
    action: "session-types:archive",
    status: "success",
    message: `Tipo de sesion ${entrada.id} archivado.`,
    metadata: { sessionTypeId: entrada.id }
  });
  res.json({ success: true, sessionType: aTipoSesionPublico(entrada) });
});

router.post("/:id/restore", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "actions:critical")) {
    await registrarPermisoDenegado(actor, "session-types:restore", "Rol sin permisos para restaurar tipos de sesion.", {
      sessionTypeId: req.params.id
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const entrada = await ModeloTipoSesion.findOne({ id: req.params.id });
  if (!entrada) {
    return res.status(404).json({ success: false, error: "Tipo de sesion no encontrado." });
  }
  if (entrada.archived) {
    entrada.archived = false;
    entrada.updatedAt = new Date();
    await entrada.save();
  }
  await registrarAuditoria({
    actor,
    action: "session-types:restore",
    status: "success",
    message: `Tipo de sesion ${entrada.id} restaurado.`,
    metadata: { sessionTypeId: entrada.id }
  });
  res.json({ success: true, sessionType: aTipoSesionPublico(entrada) });
});

export default router;
