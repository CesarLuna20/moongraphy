import { Router } from "express";
import { v4 as uuid } from "uuid";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ModeloPlantillaNotificacion } from "../modelos/index.js";
import { usuarioTienePermiso } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import {
  PLANTILLAS_PREDETERMINADAS,
  validarPlaceholders
} from "../servicios/plantillas.js";

const router = Router();

router.get("/", autenticarSolicitud, async (req, res) => {
  if (!usuarioTienePermiso(req.authUser, "actions:critical")) {
    await registrarPermisoDenegado(req.authUser, "notification-templates:list", "Rol sin permisos para gestionar plantillas.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const plantillas = await ModeloPlantillaNotificacion.find().sort({ key: 1 });
  const mapaActual = new Map(plantillas.map((entrada) => [entrada.key, entrada]));
  const payload = PLANTILLAS_PREDETERMINADAS.map((plantilla) => {
    const actual = mapaActual.get(plantilla.key);
    return {
      key: plantilla.key,
      name: plantilla.name,
      description: plantilla.description,
      body: actual?.body ?? plantilla.body,
      defaultBody: plantilla.body,
      placeholders: plantilla.placeholders,
      updatedAt: actual?.updatedAt ?? null
    };
  });
  res.json({ success: true, templates: payload });
});

router.put("/:key", autenticarSolicitud, async (req, res) => {
  if (!usuarioTienePermiso(req.authUser, "actions:critical")) {
    await registrarPermisoDenegado(req.authUser, "notification-templates:update", "Rol sin permisos para editar plantillas.", {
      key: req.params.key
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const clave = req.params.key;
  const plantillaBase = PLANTILLAS_PREDETERMINADAS.find((item) => item.key === clave);
  if (!plantillaBase) {
    return res.status(404).json({ success: false, error: "Plantilla no reconocida." });
  }
  const cuerpo = typeof req.body?.body === "string" ? req.body.body : "";
  const validacion = validarPlaceholders(cuerpo);
  if (!validacion.ok) {
    return res.status(400).json({ success: false, error: validacion.error });
  }

  const existente =
    (await ModeloPlantillaNotificacion.findOne({ key: clave })) ??
    (await ModeloPlantillaNotificacion.create({
      id: uuid(),
      key: clave,
      name: plantillaBase.name,
      description: plantillaBase.description,
      defaultBody: plantillaBase.body,
      body: plantillaBase.body,
      placeholders: plantillaBase.placeholders,
      updatedAt: new Date()
    }));

  existente.body = cuerpo;
  existente.updatedAt = new Date();
  existente.placeholders = plantillaBase.placeholders;
  await existente.save();

  await registrarAuditoria({
    actor: req.authUser,
    action: "notification-templates:update",
    status: "success",
    message: `Plantilla ${clave} actualizada.`,
    metadata: { key: clave }
  });

  res.json({
    success: true,
    template: {
      key: clave,
      name: existente.name,
      description: existente.description,
      body: existente.body,
      defaultBody: plantillaBase.body,
      placeholders: plantillaBase.placeholders,
      updatedAt: existente.updatedAt
    }
  });
});

router.post("/:key/reset", autenticarSolicitud, async (req, res) => {
  if (!usuarioTienePermiso(req.authUser, "actions:critical")) {
    await registrarPermisoDenegado(req.authUser, "notification-templates:reset", "Rol sin permisos para restaurar plantillas.", {
      key: req.params.key
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const clave = req.params.key;
  const plantillaBase = PLANTILLAS_PREDETERMINADAS.find((item) => item.key === clave);
  if (!plantillaBase) {
    return res.status(404).json({ success: false, error: "Plantilla no reconocida." });
  }
  const existente = await ModeloPlantillaNotificacion.findOne({ key: clave });
  if (existente) {
    existente.body = plantillaBase.body;
    existente.placeholders = plantillaBase.placeholders;
    existente.updatedAt = new Date();
    await existente.save();
  } else {
    await ModeloPlantillaNotificacion.create({
      id: uuid(),
      key: clave,
      name: plantillaBase.name,
      description: plantillaBase.description,
      defaultBody: plantillaBase.body,
      body: plantillaBase.body,
      placeholders: plantillaBase.placeholders,
      updatedAt: new Date()
    });
  }

  await registrarAuditoria({
    actor: req.authUser,
    action: "notification-templates:reset",
    status: "success",
    message: `Plantilla ${clave} restaurada a sus valores por defecto.`,
    metadata: { key: clave }
  });

  res.json({
    success: true,
    template: {
      key: clave,
      name: plantillaBase.name,
      description: plantillaBase.description,
      body: plantillaBase.body,
      defaultBody: plantillaBase.body,
      placeholders: plantillaBase.placeholders,
      updatedAt: new Date()
    }
  });
});

export default router;
