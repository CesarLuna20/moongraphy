import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const archivoActual = fileURLToPath(import.meta.url);
const carpetaActual = path.dirname(archivoActual);
const raizServidor = path.resolve(carpetaActual, "..", "..");
const carpetaUploads = path.join(raizServidor, "uploads");

export const asegurarCarpeta = (rutaObjetivo) => {
  if (!fs.existsSync(rutaObjetivo)) {
    fs.mkdirSync(rutaObjetivo, { recursive: true });
  }
};

asegurarCarpeta(carpetaUploads);

export const rutasServidor = {
  raiz: raizServidor,
  uploads: carpetaUploads
};
