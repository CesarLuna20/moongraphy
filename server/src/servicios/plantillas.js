import { v4 as uuid } from "uuid";

import { ModeloPlantillaNotificacion } from "../modelos/index.js";

export const CLAVES_PLANTILLAS = {
  RECORDATORIO_48H: "session-reminder-48h",
  RECORDATORIO_24H: "session-reminder-24h",
  CONFIRMACION: "session-confirmation",
  CAMBIO_CANCELACION: "session-change"
};

export const PLACEHOLDERS_PERMITIDOS = [
  "{{photographerName}}",
  "{{clientName}}",
  "{{sessionDate}}",
  "{{sessionLocation}}",
  "{{sessionType}}",
  "{{sessionNotes}}"
];

const MAPA_PLACEHOLDERS = {
  "{{photographerName}}": "photographerName",
  "{{clientName}}": "clientName",
  "{{sessionDate}}": "sessionDate",
  "{{sessionLocation}}": "sessionLocation",
  "{{sessionType}}": "sessionType",
  "{{sessionNotes}}": "sessionNotes"
};

export const PLANTILLAS_PREDETERMINADAS = [
  {
    key: CLAVES_PLANTILLAS.RECORDATORIO_48H,
    name: "Recordatorio 48h",
    description: "Mensaje para recordatorio de sesion 48 horas antes.",
    body:
      "Hola {{clientName}},\n\nTe recordamos tu sesion de {{sessionType}} con {{photographerName}} el {{sessionDate}} en {{sessionLocation}}.\n\nSi necesitas reprogramar, contacta cuanto antes.",
    placeholders: PLACEHOLDERS_PERMITIDOS
  },
  {
    key: CLAVES_PLANTILLAS.RECORDATORIO_24H,
    name: "Recordatorio 24h",
    description: "Mensaje para recordatorio de sesion 24 horas antes.",
    body:
      "Hola {{clientName}},\n\nManana es tu sesion de {{sessionType}} con {{photographerName}} el {{sessionDate}} en {{sessionLocation}}.\n\nConfirma tu asistencia o avisa si surge algun cambio.",
    placeholders: PLACEHOLDERS_PERMITIDOS
  },
  {
    key: CLAVES_PLANTILLAS.CONFIRMACION,
    name: "Confirmacion de sesion",
    description: "Mensaje cuando se confirma la sesion.",
    body:
      "Hola {{clientName}},\n\nTu sesion de {{sessionType}} ha sido confirmada para el {{sessionDate}} en {{sessionLocation}}.\n\nNotas: {{sessionNotes}}",
    placeholders: PLACEHOLDERS_PERMITIDOS
  },
  {
    key: CLAVES_PLANTILLAS.CAMBIO_CANCELACION,
    name: "Cambios o cancelaciones",
    description: "Mensaje general para cambios o cancelaciones.",
    body:
      "Hola {{clientName}},\n\nHubo cambios en tu sesion de {{sessionType}} programada para el {{sessionDate}} en {{sessionLocation}}.\n\nNotas: {{sessionNotes}}",
    placeholders: PLACEHOLDERS_PERMITIDOS
  }
];

export const asegurarPlantillasPredeterminadas = async () => {
  for (const plantilla of PLANTILLAS_PREDETERMINADAS) {
    const existente = await ModeloPlantillaNotificacion.findOne({ key: plantilla.key });
    if (!existente) {
      await ModeloPlantillaNotificacion.create({
        id: uuid(),
        key: plantilla.key,
        name: plantilla.name,
        description: plantilla.description,
        defaultBody: plantilla.body,
        body: plantilla.body,
        placeholders: plantilla.placeholders,
        updatedAt: new Date()
      });
      continue;
    }
    const actualizar =
      existente.defaultBody !== plantilla.body ||
      !Array.isArray(existente.placeholders) ||
      existente.placeholders.length !== plantilla.placeholders.length;
    if (actualizar) {
      existente.defaultBody = plantilla.body;
      existente.placeholders = plantilla.placeholders;
      if (!existente.body || existente.body.trim().length === 0) {
        existente.body = plantilla.body;
      }
      existente.updatedAt = new Date();
      await existente.save();
    }
  }
};

export const validarPlaceholders = (contenido) => {
  const coincidencias = contenido.match(/\{\{[^}]+\}\}/g) ?? [];
  for (const placeholder of coincidencias) {
    if (!PLACEHOLDERS_PERMITIDOS.includes(placeholder)) {
      return {
        ok: false,
        error: `Placeholder no permitido: ${placeholder}. Usa solo ${PLACEHOLDERS_PERMITIDOS.join(", ")}`
      };
    }
  }
  if (contenido.trim().length === 0) {
    return { ok: false, error: "El contenido no puede quedar vacio." };
  }
  return { ok: true };
};

export const renderizarPlantillaNotificacion = async (clave, contexto) => {
  const plantilla =
    (await ModeloPlantillaNotificacion.findOne({ key: clave })) ??
    PLANTILLAS_PREDETERMINADAS.find((item) => item.key === clave);
  const cuerpo = plantilla?.body ?? contexto.fallback;
  if (!cuerpo) {
    return contexto.fallback ?? "";
  }
  return cuerpo.replace(/\{\{[^}]+\}\}/g, (coincidencia) => {
    const llave = MAPA_PLACEHOLDERS[coincidencia];
    if (!llave) {
      return coincidencia;
    }
    const valor = contexto[llave];
    return valor !== undefined && valor !== null ? String(valor) : coincidencia;
  });
};
