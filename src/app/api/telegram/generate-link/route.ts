import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateTempToken } from "@/lib/telegram";
import { getClientIdentifier, rateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIdentifier(req);
    const limitCheck = await rateLimit({
      identifier,
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento." },
        { status: 429 },
      );
    }

    const tempToken = generateTempToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.telegramLinkToken.create({
      data: {
        tempToken,
        state: "PENDING",
        expiresAt,
      },
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_USERNAME no está configurado" },
        { status: 500 },
      );
    }

    const deepLink = `https://t.me/${botUsername}?start=${tempToken}`;

    return NextResponse.json({
      success: true,
      deepLink,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Error al generar el enlace de Telegram");
    return NextResponse.json(
      { error: "Error al generar enlace de verificación" },
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
