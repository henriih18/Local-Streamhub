import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { getIO } from "@/lib/socket";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
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

      const userId = params.userId;

      const uuidCheck = requireUUID(params.userId);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      const blockSchema = z.object({
        blockType: z.enum(["temporary", "permanent"], {
          message: "blockType debe ser 'temporary' o 'permanent'",
        }),
        duration: z
          .string()
          .min(1, "La duración es requerida")
          .max(1000, "Duración máxima excedida")
          .optional()
          .default("24"),
        reason: z
          .string()
          .min(1, "El motivo es requerido")
          .max(500, "Motivo demasiado largo"),
        notifyUser: z.boolean().default(false),
      });

      const body = await request.json();
      const validation = blockSchema.safeParse(body);

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

      const { blockType, duration, reason, notifyUser } = validation.data;
      const sanitizedReason = sanitizeInput(reason);

      const expiresAt =
        blockType === "temporary"
          ? new Date(Date.now() + (parseInt(duration) || 24) * 60 * 60 * 1000)
          : null;

      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: true,
          blockReason: sanitizedReason,
          blockExpiresAt: expiresAt,
          tokenVersion: { increment: 1 },
        },
      });

      userCache.delete(`user:id:${userId}`);
      userCache.delete("admin:users:list");
      if (updatedUser.email) userCache.delete(`user:${updatedUser.email}`);

      const block = await db.userBlock.create({
        data: {
          userId,
          blockType,
          duration: blockType === "temporary" ? duration : null,
          reason: sanitizedReason,
          isActive: true,
          expiresAt,
        },
      });

      if (notifyUser) {
        const io = getIO();

        let messageContent = `Tu cuenta ha sido bloqueada. Motivo: ${sanitizedReason}`;
        if (blockType === "temporary") {
          messageContent += `\n\nDesbloqueo automático: ${expiresAt!.toLocaleDateString(
            "es-CO",
          )}`;
        } else {
          messageContent +=
            "\n\nEste es un bloqueo permanente. Contacta soporte para más información.";
        }

        // Usar el mismo adminUser del requireAdmin
        await db.message.create({
          data: {
            senderId: user.id,
            receiverId: userId,
            title: "Cuenta Bloqueada",
            content: messageContent,
            type: "BLOCK_NOTICE",
          },
        });

        if (io) {
          const { broadcastUserBlocked } = await import("@/lib/socket");
          broadcastUserBlocked(io, userId, {
            reason: sanitizedReason,
            blockType,
            expiresAt,
          });
        }

        // Notificar por Telegram si el usuario está verificado
        const targetUser = await db.user.findUnique({
          where: { id: userId },
          select: { telegramChatId: true },
        });
        if (targetUser?.telegramChatId) {
          const blockInfo =
            blockType === "temporary"
              ? `\n\n⏰ Desbloqueo automático: ${expiresAt!.toLocaleDateString("es-CO")}`
              : `\n\n🔒 Este es un bloqueo permanente. Contacta soporte.`;
          sendTelegramMessage(
            targetUser.telegramChatId,
            `🚫 *CUENTA BLOQUEADA*\n\nMotivo: ${sanitizedReason}${blockInfo}`,
            { parse_mode: "Markdown" },
          );
        }
      }

      return NextResponse.json({ user: updatedUser, block });
    } catch (error) {
      logger.error({ err: error }, "Error al bloquear usuario");
      return NextResponse.json(
        { error: "Error al bloquear usuario" },
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
