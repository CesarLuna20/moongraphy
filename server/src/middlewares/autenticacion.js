import jwt from "jsonwebtoken";

import { ajustesEntorno } from "../configuracion/entorno.js";
import { ModeloUsuario } from "../modelos/index.js";

export const autenticarSolicitud = async (req, res, next) => {
  const encabezado = req.headers.authorization ?? "";
  const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ success: false, error: "Necesitas iniciar sesion para continuar." });
  }
  try {
    const payload = jwt.verify(token, ajustesEntorno.jwtSecreto);
    const usuario = await ModeloUsuario.findOne({ id: payload.id });
    if (!usuario) {
      return res.status(401).json({ success: false, error: "Sesion invalida. Inicia sesion nuevamente." });
    }
    req.authUser = usuario;
    next();
  } catch (error) {
    console.error("[auth] Token invalido", error);
    return res.status(401).json({ success: false, error: "Sesion invalida. Inicia sesion nuevamente." });
  }
};
