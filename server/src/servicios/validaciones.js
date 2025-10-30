export const esCorreoValido = (correo) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

export const esContrasenaRobusta = (contrasena) =>
  typeof contrasena === "string" &&
  contrasena.length >= 8 &&
  /[A-Z]/.test(contrasena) &&
  /[a-z]/.test(contrasena) &&
  /\d/.test(contrasena);

export const coaccionarBooleano = (valor, respaldo) =>
  typeof valor === "boolean" ? valor : respaldo;
