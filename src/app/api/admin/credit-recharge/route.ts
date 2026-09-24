import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendTelegramMessage,
  escapeMarkdown,
  sendViaRechargeBot,
  sendToRechargeGroupThread,
} from "@/lib/telegram";
import { requireAdmin } from "@/lib/auth";
import { broadcastCreditsUpdate, getIO } from "@/lib/socket";
import { rateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const limitCheck = await rateLimit({
      identifier: `admin:${user.id}:${request.url}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limitCheck.success) {
      return NextResponse.json(
        {
          error: "Demasiadas solicitudes. Espera un momento.",
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

    const creditRechargeSchema = z.object({
      userId: z.string().regex(/^c[a-z0-9]{24}$/i, "ID de usuario inválido"),
      amount: z.coerce
        .number()
        .positive("El monto debe ser positivo")
        .max(1000000, "Monto máximo 1,000,000"),
    });

    const body = await request.json();
    const validation = creditRechargeSchema.safeParse(body);

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

    const { userId, amount } = validation.data;
    const amountNumber = amount;

    // Verificar que el usuario destino existe y no esté bloqueado
    const existingUser = await db.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }
    if (existingUser.isBlocked) {
      return NextResponse.json(
        { error: "Usuario bloqueado, no se puede recargar" },
        { status: 400 },
      );
    }

    // Transacción: incrementar créditos Y crear registro de recarga atómicamente
    const [targetUser, creditRecharge] = await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { credits: { increment: amountNumber } },
        select: {
          id: true,
          fullName: true,
          email: true,
          credits: true,
          telegramChatId: true,
        },
      }),
      db.creditRecharge.create({
        data: {
          userId,
          amount: amountNumber,
          method: "Admin Manual",
          status: "COMPLETED",
        },
      }),
    ]);

    // Notificar al usuario por WebSocket
    const io = getIO();
    if (io) {
      broadcastCreditsUpdate(io, userId, targetUser.credits);
    }

    // Notificar al usuario por Telegram por el BOT DE RECARGAS
    // (si tiene thread activo con el bot de recargas)
    if (targetUser.telegramChatId) {
      try {
        const amountFormatted = amountNumber.toLocaleString("es-CO");
        const newBalance = (targetUser.credits ?? 0).toLocaleString("es-CO");
        const userName = escapeMarkdown(
          targetUser.fullName || targetUser.email,
        );

        // Buscar el thread más reciente del usuario con el bot de recargas
        const rechargeThread = await db.telegramSupportThread.findFirst({
          where: {
            userChatId: targetUser.telegramChatId,
            botType: "recharge",
          },
          orderBy: { createdAt: "desc" },
        });

        if (rechargeThread) {
          //Tiene thread con el bot de recargas → enviar por ese bot

          // 1. Mensaje al chat privado del usuario
          const userMessage =
            `✅ *Recarga procesada*\n\n` +
            `💰 Se han acreditado *${amountFormatted}* créditos a tu cuenta.\n` +
            `💼 Nuevo saldo: *${newBalance}* créditos\n\n` +
            `¡Gracias por tu confianza! 🙌`;

          await sendViaRechargeBot(rechargeThread.userChatId, userMessage, {
            parse_mode: "Markdown",
          });

          // 2. Mensaje al thread del grupo (para que el agente vea confirmación)
          const groupMessage =
            `✅ *Recarga procesada por el admin*\n\n` +
            `👤 *Cliente:* ${userName}\n` +
            `💰 *Monto:* ${amountFormatted} créditos\n` +
            `💼 *Nuevo saldo:* ${newBalance} créditos\n\n` +
            `_Recarga completada desde el panel de administración_`;

          await sendToRechargeGroupThread(
            rechargeThread.groupId,
            rechargeThread.threadId,
            groupMessage,
            { parse_mode: "Markdown" },
          );

          logger.info(
            {
              context: "credit_recharge_telegram_notify",
              userId,
              threadId: rechargeThread.threadId,
              via: "recharge_bot",
            },
            "Notificación de recarga enviada por bot de recargas",
          );
        } else {
          // No tiene thread con bot de recargas → fallback al bot principal
          const tgText =
            `💰 *Recarga de créditos recibida*\n\n` +
            `¡Hola *${userName}*!\n\n` +
            `✅ Se han acreditado *${amountFormatted}* créditos a tu cuenta.\n` +
            `💼 Nuevo saldo: *${newBalance}* créditos\n\n` +
            `¡Gracias por tu confianza\\! 🙌`;

          await sendTelegramMessage(targetUser.telegramChatId, tgText, {
            parse_mode: "Markdown",
          });

          logger.info(
            {
              context: "credit_recharge_telegram_notify",
              userId,
              via: "main_bot_fallback",
              reason: "no_recharge_thread",
            },
            "Notificación de recarga enviada por bot principal (fallback)",
          );
        }
      } catch (telegramError) {
        // Si falla Telegram, no romper el flujo de recarga
        logger.error(
          {
            err: telegramError,
            userId,
            context: "credit_recharge_telegram_notify",
          },
          "No se pudo enviar la notificación de recarga por Telegram (no bloquea la recarga)",
        );
      }
    }

    return NextResponse.json({ user: targetUser, creditRecharge });
  } catch (error) {
    logger.error({ err: error }, "Error recharging credits");
    return NextResponse.json(
      { error: "Error al recargar creditos" },
      { status: 500 },
    );
  }
});

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
