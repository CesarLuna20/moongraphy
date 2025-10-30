const EXPRESION_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const convertirTextoADate = (valor) => {
  if (!valor) {
    return null;
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return null;
  }
  return fecha;
};

export const convertirHoraAMinutos = (valor) => {
  if (typeof valor !== "string") {
    return null;
  }
  const limpio = valor.trim();
  if (!EXPRESION_HORA.test(limpio)) {
    return null;
  }
  const [horas, minutos] = limpio.split(":").map((parte) => Number.parseInt(parte, 10));
  if (Number.isNaN(horas) || Number.isNaN(minutos)) {
    return null;
  }
  return horas * 60 + minutos;
};

export const minutosDesdeFecha = (fecha) => fecha.getHours() * 60 + fecha.getMinutes();

export const formatearFechaCorta = (fecha) =>
  fecha.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
