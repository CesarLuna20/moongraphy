import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";

import { asegurarCarpeta, rutasServidor } from "../configuracion/rutas.js";

export const TIPOS_MIME_IMAGEN = new Set(["image/jpeg", "image/png"]);
export const EXTENSIONES_IMAGEN = new Set([".jpg", ".jpeg", ".png"]);
export const TAMANO_MAX_ARCHIVO = 25 * 1024 * 1024;
export const MAX_ARCHIVOS_POR_SUBIDA = 50;

const almacenamientoGaleria = multer.diskStorage({
  destination: (req, _file, cb) => {
    const galleryId = req.params?.id;
    if (!galleryId) {
      cb(new Error("Galeria no especificada."));
      return;
    }
    const carpetaGaleria = path.join(rutasServidor.uploads, galleryId);
    asegurarCarpeta(carpetaGaleria);
    cb(null, carpetaGaleria);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname ?? "").toLowerCase();
    const extensionSegura = EXTENSIONES_IMAGEN.has(extension) ? extension : ".jpg";
    cb(null, `${uuid()}${extensionSegura}`);
  }
});

export const subidaGaleria = multer({
  storage: almacenamientoGaleria,
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype ?? "").toLowerCase();
    const extension = path.extname(file.originalname ?? "").toLowerCase();
    if (!TIPOS_MIME_IMAGEN.has(mime) || !EXTENSIONES_IMAGEN.has(extension)) {
      const error = new Error("Formato de archivo no soportado. Usa JPG o PNG.");
      error.code = "INVALID_FILE_TYPE";
      cb(error);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: TAMANO_MAX_ARCHIVO }
});
