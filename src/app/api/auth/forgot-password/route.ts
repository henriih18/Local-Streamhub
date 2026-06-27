import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIdentifier, rateLimit } from "@/lib/rate-limiter";
import { sendTelegramMessage, generateTempToken } from "@/lib/telegram";
import crypto from "crypto";
import { logger } from "@/lib/logger";

const forgotPasswordSchema = z
  .object({
    email: z
      .string()
      .email("Email no válido")
      .max(255, "El email no puede exceder 255 caracteres"),
  })
  .strict();

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 intentos por IP cada 15 minutos
    const identifier = getClientIdentifier(request);
    const limitCheck = await rateLimit({
      identifier,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!limitCheck.success) {
      return NextResponse.json(
        {
          error: "Demasiados intentos. Por favor, espera 15 minutos.",
          retryAfter: Math.ceil((limitCheck.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (limitCheck.resetTime - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    const body = await request.json();
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      const allErrors = validation.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }));
      return NextResponse.json(
        { error: "Datos inválidos", details: allErrors },
        { status: 400 },
      );
    }

    const { email } = validation.data;

    // Buscar usuario por email (sin exponer si existe o no)
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        telegramChatId: true,
        isBlocked: true,
        isActive: true,
      },
    });

    // No existe, sin Telegram, bloqueado o inactivo → mismo mensaje genérico
    if (!user || !user.telegramChatId || user.isBlocked || !user.isActive) {
      return NextResponse.json({
        message:
          "Si el email está registrado y vinculado a Telegram, recibirás un mensaje con instrucciones.",
      });
    }

    // Generar token seguro (32 bytes hex = 64 caracteres)
    const token = generateTempToken();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutos

    // Guardar token en la BD
    await db.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: expiresAt,
      },
    });

    const domain = process.env.NEXT_PUBLIC_DOMAIN || "www.riyostream.com";
    const resetPageUrl = `https://${domain}/reset-password`;

    const displayName = escapeMarkdown(user.fullName || user.email);

    let message = `🔐 *Restablecimiento de contraseña*\n\n`;
    message += `Hola *${displayName}*, se solicitó un cambio de contraseña para tu cuenta.\n\n`;
    message += `1. Ve a este enlace:\n`;
    message += `[Restablecer Contraseña](${resetPageUrl})\n\n`;
    message += `2. Copia y pega este código:\n`;
    message += `_${token}_\n\n`;
    message += `⏰ Este código expira en 20 minutos.\n\n`;
    message += `⚠️ Si no solicitaste este cambio, ignora este mensaje. Tu contraseña no ha sido cambiada.`;

    const sent = await sendTelegramMessage(user.telegramChatId, message, {
      parse_mode: "Markdown",
    });

    //sendTelegramMessage devuelve false, NO lanza excepción
    if (!sent) {
      logger.error(" No se pudo enviar el mensaje por Telegram");
      await db.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });
    }

    // Siempre devolver mismo mensaje genérico (no revelar si se envió o no)
    return NextResponse.json({
      message:
        "Si el email está registrado y vinculado a Telegram, recibirás un mensaje con instrucciones.",
    });
  } catch (error) {
    logger.error({ err: error }, "Error en forgot-password");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
export function PUT() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
export function DELETE() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
