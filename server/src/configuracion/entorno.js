import dotenv from "dotenv";

dotenv.config();

export const ajustesEntorno = {
  puerto: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/moongraphy",
  jwtSecreto: process.env.JWT_SECRET ?? "moongraphy-secret",
  smtp: {
    host: process.env.SMTP_HOST,
    puerto: Number(process.env.SMTP_PORT ?? 465),
    usuario: process.env.SMTP_USER,
    contrasena: process.env.SMTP_PASS,
    remitente: process.env.SMTP_FROM
  }
};
