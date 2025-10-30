export const agregarEntradaHistorial = (usuario, tipo, resumen) => {
  const entrada = { timestamp: new Date(), type: tipo, summary: resumen };
  usuario.history = [entrada, ...(usuario.history ?? [])].slice(0, 50);
  usuario.updatedAt = entrada.timestamp;
  return entrada;
};

export const agregarEntradaHistorialGaleria = (galeria, tipo, resumen) => {
  if (!galeria.history) {
    galeria.history = [];
  }
  galeria.history.push({
    timestamp: new Date(),
    type: tipo,
    summary: resumen
  });
  if (galeria.history.length > 200) {
    galeria.history = galeria.history.slice(-200);
  }
};
