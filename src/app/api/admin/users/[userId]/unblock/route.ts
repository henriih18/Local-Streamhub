import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { getIO } from "@/lib/socket";
import { sendTelegramMessage } from "@/lib/telegram";
import { logger } from "@/lib/logger";

export const POST = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { userId: string } },
  ) => {
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

      const uuidCheck = requireUUID(params.userId);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }
      const userId = params.userId;

      const unblockSchema = z.object({
        reason: z
          .string()
          .min(1, "El motivo es requerido")
          .max(500, "Motivo demasiado largo"),
        notifyUser: z.boolean().default(false),
      });

      const body = await request.json();
      const validation = unblockSchema.safeParse(body);

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

      const { reason, notifyUser } = validation.data;

      // Actualizar el estado de desbloqueo del usuario
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: false,
          blockReason: null,
          blockExpiresAt: null,
        },
      });

      // Desactivar todos los bloqueos activos para este usuario
      await db.userBlock.updateMany({
        where: {
          userId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Enviar mensaje interno usando el admin autenticado que ejecuta la acción
      if (notifyUser) {
        await db.message.create({
          data: {
            senderId: user.id,
            receiverId: userId,
            title: "Cuenta Desbloqueada",
            content: `Tu cuenta ha sido desbloqueada. Motivo: ${sanitizeInput(reason)}\n\nYa puedes acceder normalmente a la plataforma.`,
            type: "UNBLOCK_NOTICE",
          },
        });

        // Notificar en tiempo real por WebSocket
        const io = getIO();
        if (io) {
          io.to(`user:${userId}`).emit("notification", {
            type: "UNBLOCK_NOTICE",
            title: "Cuenta Desbloqueada",
            message: `Tu cuenta ha sido desbloqueada. Motivo: ${reason}`,
          });
        }

        // Notificar por Telegram si el usuario está verificado
        const targetUser = await db.user.findUnique({
          where: { id: userId },
          select: { telegramChatId: true },
        });
        if (targetUser?.telegramChatId) {
          sendTelegramMessage(
            targetUser.telegramChatId,
            `✅ *CUENTA DESBLOQUEADA*\n\nTu cuenta ha sido desbloqueada.\nMotivo: ${reason}\n\nYa puedes acceder normalmente a la plataforma.`,
            { parse_mode: "Markdown" },
          );
        }
      }

      return NextResponse.json(updatedUser);
    } catch (error) {
      logger.error({ err: error }, "Error al desbloquear usuario");
      return NextResponse.json(
        { error: "Error al desbloquear usuario" },
        { status: 500 },
      );
    }
  },
);

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
