import nodemailer from "nodemailer";

import { ajustesEntorno } from "../configuracion/entorno.js";

let transportistaCorreo = null;

const prepararTransportista = () => {
  const { host, usuario, contrasena, puerto } = ajustesEntorno.smtp;
  if (!host || !usuario || !contrasena) {
    console.warn("[correo] SMTP no configurado. Los correos de recuperacion no se enviaran.");
    return;
  }
  const numeroPuerto = puerto || 465;
  transportistaCorreo = nodemailer.createTransport({
    host,
    port: numeroPuerto,
    secure: numeroPuerto === 465,
    auth: {
      user: usuario,
      pass: contrasena
    }
  });

  transportistaCorreo
    .verify()
    .then(() => console.log("[correo] SMTP listo para enviar mensajes"))
    .catch((error) => {
      console.error("[correo] No se pudo verificar la configuracion SMTP", error);
      transportistaCorreo = null;
    });
};

prepararTransportista();

export const enviarCorreo = async ({ to, subject, text, html }) => {
  if (!transportistaCorreo || !ajustesEntorno.smtp.remitente) {
    return { success: false, error: "SMTP no configurado." };
  }
  try {
    await transportistaCorreo.sendMail({
      from: ajustesEntorno.smtp.remitente,
      to,
      subject,
      text,
      html
    });
    return { success: true };
  } catch (error) {
    console.error("[correo] Error enviando correo", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido al enviar correo"
    };
  }
};

export const correoHabilitado = () => !!transportistaCorreo && !!ajustesEntorno.smtp.remitente;
