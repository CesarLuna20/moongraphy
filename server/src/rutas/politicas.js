import { Router } from "express";
import { v4 as uuid } from "uuid";

import { autenticarSolicitud } from "../middlewares/autenticacion.js";
import { ModeloPolitica } from "../modelos/index.js";
import { usuarioTienePermiso } from "../servicios/permisos.js";
import { registrarPermisoDenegado, registrarAuditoria } from "../servicios/auditoria.js";
import {
  obtenerPoliticaCancelacionActiva,
  construirInstantaneaPolitica,
  POLITICA_CANCELACION_POR_DEFECTO
} from "../servicios/politicas.js";

const router = Router();

router.get("/cancellation", autenticarSolicitud, async (_req, res) => {
  const politica = await obtenerPoliticaCancelacionActiva();
  const instantanea = construirInstantaneaPolitica(politica);
  res.json({
    success: true,
    policy: {
      version: politica.version,
      settings: instantanea,
      createdAt: politica.createdAt,
      createdBy: politica.createdBy
    }
  });
});

router.put("/cancellation", autenticarSolicitud, async (req, res) => {
  const actor = req.authUser;
  if (!usuarioTienePermiso(actor, "actions:critical")) {
    await registrarPermisoDenegado(actor, "policies:update", "Rol sin permisos para actualizar politicas.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const { minHoursCancel, minHoursReschedule, toleranceMinutes } = req.body ?? {};
  const valores = {
    minHoursCancel: Number.isFinite(minHoursCancel) ? Number(minHoursCancel) : POLITICA_CANCELACION_POR_DEFECTO.minHoursCancel,
    minHoursReschedule: Number.isFinite(minHoursReschedule)
      ? Number(minHoursReschedule)
      : POLITICA_CANCELACION_POR_DEFECTO.minHoursReschedule,
    toleranceMinutes: Number.isFinite(toleranceMinutes)
      ? Number(toleranceMinutes)
      : POLITICA_CANCELACION_POR_DEFECTO.toleranceMinutes
  };
  if (valores.minHoursCancel < 0 || valores.minHoursReschedule < 0 || valores.toleranceMinutes < 0) {
    return res.status(400).json({ success: false, error: "Los valores de la politica deben ser numeros positivos." });
  }

  const vigente = await obtenerPoliticaCancelacionActiva();
  const siguienteVersion = vigente ? vigente.version + 1 : 1;
  const politica = await ModeloPolitica.create({
    id: uuid(),
    type: "cancellation",
    version: siguienteVersion,
    settings: valores,
    createdBy: actor.id,
    createdAt: new Date()
  });

  await registrarAuditoria({
    actor,
    action: "policies:update",
    status: "success",
    message: `Politica de cancelacion version ${siguienteVersion} guardada.`,
    metadata: valores
  });

  res.json({
    success: true,
    policy: {
      version: politica.version,
      settings: construirInstantaneaPolitica(politica),
      createdAt: politica.createdAt,
      createdBy: politica.createdBy
    }
  });
});

export default router;
