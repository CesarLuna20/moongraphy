import { Router } from "express";

import saludRouter from "./salud.js";
import auditoriaRouter from "./auditoria.js";
import authRouter from "./auth.js";
import disponibilidadRouter from "./disponibilidad.js";
import notificacionesRouter from "./notificaciones.js";
import usuariosRouter from "./usuarios.js";
import sesionesRouter from "./sesiones.js";
import cronologiaRouter from "./cronologia.js";
import tiposSesionRouter from "./tiposSesion.js";
import plantillasRouter from "./plantillasNotificacion.js";
import politicasRouter from "./politicas.js";
import galeriasRouter from "./galerias.js";
import cuentasRouter from "./cuentas.js";
import clientesRouter from "./clientes.js";

const router = Router();

router.use("/health", saludRouter);
router.use("/audit", auditoriaRouter);
router.use("/auth", authRouter);
router.use("/availability", disponibilidadRouter);
router.use("/notifications", notificacionesRouter);
router.use("/", usuariosRouter);
router.use("/sessions", sesionesRouter);
router.use("/timeline", cronologiaRouter);
router.use("/session-types", tiposSesionRouter);
router.use("/notification-templates", plantillasRouter);
router.use("/policies", politicasRouter);
router.use("/galleries", galeriasRouter);
router.use("/accounts", cuentasRouter);
router.use("/clients", clientesRouter);

export default router;
