import bcrypt from "bcryptjs";

export const generarContrasenaTemporal = () => {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789#!$@";
  return Array.from({ length: 12 })
    .map(() => alfabeto[Math.floor(Math.random() * alfabeto.length)])
    .join("");
};

export const compararContrasena = (textoPlano, hash) => bcrypt.compare(textoPlano, hash);

export const generarHashContrasena = (contrasena) => bcrypt.hash(contrasena, 10);
