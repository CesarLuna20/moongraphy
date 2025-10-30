import { v4 as uuid } from "uuid";

import { ModeloPolitica } from "../modelos/index.js";

export const POLITICA_CANCELACION_POR_DEFECTO = {
  minHoursCancel: 24,
  minHoursReschedule: 24,
  toleranceMinutes: 30
};

export const asegurarPoliticaCancelacionPredeterminada = async () => {
  const actual = await ModeloPolitica.findOne({ type: "cancellation" }).sort({ version: -1 });
  if (!actual) {
    await ModeloPolitica.create({
      id: uuid(),
      type: "cancellation",
      version: 1,
      settings: POLITICA_CANCELACION_POR_DEFECTO,
      createdAt: new Date()
    });
  }
};

export const obtenerPoliticaCancelacionActiva = async () => {
  const politica = await ModeloPolitica.findOne({ type: "cancellation" }).sort({ version: -1 });
  if (politica) {
    return politica;
  }
  await asegurarPoliticaCancelacionPredeterminada();
  return ModeloPolitica.findOne({ type: "cancellation" }).sort({ version: -1 });
};

export const construirInstantaneaPolitica = (politica) => ({
  version: politica.version,
  minHoursCancel: Number(
    politica.settings?.minHoursCancel ?? POLITICA_CANCELACION_POR_DEFECTO.minHoursCancel
  ),
  minHoursReschedule: Number(
    politica.settings?.minHoursReschedule ?? POLITICA_CANCELACION_POR_DEFECTO.minHoursReschedule
  ),
  toleranceMinutes: Number(
    politica.settings?.toleranceMinutes ?? POLITICA_CANCELACION_POR_DEFECTO.toleranceMinutes
  )
});

export const formatearDiferenciaMinutos = (minutos) => {
  if (minutos < 60) {
    return `${Math.round(minutos)} minutos`;
  }
  const horas = minutos / 60;
  if (horas < 24) {
    return `${horas.toFixed(1)} horas`;
  }
  return `${(horas / 24).toFixed(1)} dias`;
};

export const evaluarVentanaPolitica = (instantanea, inicioSesion, tipo) => {
  const ahora = new Date();
  const fechaInicio = new Date(inicioSesion);
  const diferenciaMinutos = (fechaInicio.getTime() - ahora.getTime()) / (1000 * 60);
  if (tipo === "cancel") {
    const limite = instantanea.minHoursCancel * 60 - instantanea.toleranceMinutes;
    if (diferenciaMinutos < limite) {
      return {
        allowed: false,
        message: `La politica de cancelacion requiere al menos ${formatearDiferenciaMinutos(
          instantanea.minHoursCancel * 60
        )} de anticipacion.`
      };
    }
  } else if (tipo === "reschedule") {
    const limite = instantanea.minHoursReschedule * 60 - instantanea.toleranceMinutes;
    if (diferenciaMinutos < limite) {
      return {
        allowed: false,
        message: `La politica de reprogramacion requiere al menos ${formatearDiferenciaMinutos(
          instantanea.minHoursReschedule * 60
        )} de anticipacion.`
      };
    }
  }
  return { allowed: true };
};
