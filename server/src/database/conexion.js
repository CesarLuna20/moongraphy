import mongoose from "mongoose";

import { ajustesEntorno } from "../configuracion/entorno.js";

export const conectarBaseDatos = async () => {
  try {
    await mongoose.connect(ajustesEntorno.mongoUri, { autoIndex: true });
    console.log("[servidor] Conexion a MongoDB establecida");
  } catch (error) {
    console.error("[servidor] Error conectando a MongoDB", error);
    throw error;
  }
};
