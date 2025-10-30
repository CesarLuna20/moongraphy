const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.EXPO_PUBLIC_RESEND_FROM_EMAIL;

type PasswordResetEmailPayload = {
  to: string;
  temporaryPassword: string;
  userName?: string;
};

const formatPlainText = ({ userName, temporaryPassword }: PasswordResetEmailPayload) => {
  const greeting = userName ? `Hola ${userName},` : "Hola,";
  return [
    greeting,
    "",
    "Recibimos una solicitud para restablecer tu contraseña en Moongraphy.",
    "Hemos generado una contraseña temporal para que puedas acceder de nuevo a tu cuenta:",
    "",
    `Contraseña temporal: ${temporaryPassword}`,
    "",
    "Inicia sesión con este código y, por seguridad, cámbialo inmediatamente desde la aplicación.",
    "",
    "Si no solicitaste este cambio, ignora este correo.",
    "",
    "Equipo de Moongraphy"
  ].join("\n");
};

const formatHtml = ({ userName, temporaryPassword }: PasswordResetEmailPayload) => {
  const greeting = userName ? `Hola ${userName},` : "Hola,";
  return `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.6;">
      <p>${greeting}</p>
      <p>Recibimos una solicitud para restablecer tu contraseña en <strong>Moongraphy</strong>.</p>
      <p>Generamos una contraseña temporal para que puedas ingresar nuevamente:</p>
      <p style="background-color: #f4f4f4; padding: 16px; border-radius: 8px; text-align: center; font-size: 18px; letter-spacing: 0.08em;">
        <strong>${temporaryPassword}</strong>
      </p>
      <p>Inicia sesión con este código y cámbialo inmediatamente desde la aplicación para mantener tu cuenta segura.</p>
      <p>Si no solicitaste este cambio, ignora este correo.</p>
      <p style="margin-top: 32px;">Equipo de Moongraphy</p>
    </div>
  `;
};

const sendWithResend = async (payload: PasswordResetEmailPayload) => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return {
      success: false as const,
      error:
        "Servicio de correo no configurado: define EXPO_PUBLIC_RESEND_API_KEY y EXPO_PUBLIC_RESEND_FROM_EMAIL."
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [payload.to],
        subject: "Moongraphy · Recuperación de contraseña",
        text: formatPlainText(payload),
        html: formatHtml(payload)
      })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message =
        typeof errorBody?.message === "string"
          ? errorBody.message
          : `Código ${response.status}`;
      return {
        success: false as const,
        error: `No se pudo enviar el correo: ${message}`
      };
    }

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error desconocido al enviar correo."
    };
  }
};

export const emailService = {
  async sendPasswordResetEmail(payload: PasswordResetEmailPayload) {
    return sendWithResend(payload);
  }
};

export type PasswordResetEmailResult = Awaited<
  ReturnType<typeof emailService.sendPasswordResetEmail>
>;
