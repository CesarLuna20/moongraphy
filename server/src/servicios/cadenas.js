export const limpiarTexto = (valor) => {
  if (typeof valor !== "string") {
    return undefined;
  }
  const recortado = valor.trim();
  return recortado.length > 0 ? recortado : undefined;
};

export const normalizarNombreTipoSesion = (valor) =>
  typeof valor === "string" ? valor.trim().toLowerCase() : "";
