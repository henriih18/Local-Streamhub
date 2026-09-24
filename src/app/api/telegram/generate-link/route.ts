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

    // eliminar tokens expirados antes de crear uno nuevo
    // Esto mantiene la tabla pequeña y previene el bug de "tokens múltiples
    // para el mismo chatId" (que causaba que el frontend se quedara cargando)
    try {
      const deleted = await db.telegramLinkToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      if (deleted.count > 0) {
        logger.info(
          {
            context: "telegram_link_cleanup",
            deletedCount: deleted.count,
          },
          `Limpieza de tokens expirados: ${deleted.count} eliminados`,
        );
      }
    } catch (cleanupError) {
      // Si falla la limpieza, no bloquear la generación del nuevo token
      logger.error(
        { err: cleanupError, context: "telegram_link_cleanup" },
        "Error en limpieza de tokens expirados (no bloquea)",
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
