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

      const userId = params.userId;

      const uuidCheck = requireUUID(params.userId);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      const warnSchema = z.object({
        message: z
          .string()
          .min(1, "El mensaje es requerido")
          .max(1000, "Mensaje demasiado largo"),
        reason: z
          .string()
          .min(1, "La razón es requerida")
          .max(500, "Razón demasiado larga"),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
        notifyUser: z.boolean().default(false),
      });

      const body = await request.json();
      const validation = warnSchema.safeParse(body);

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

      const { message, reason, severity, notifyUser } = validation.data;
      const sanitizedMessage = sanitizeInput(message);
      const sanitizedReason = sanitizeInput(reason);

      const warning = await db.userWarning.create({
        data: {
          userId,
          message: sanitizedMessage,
          reason: sanitizedReason,
          severity,
          isActive: true,
        },
      });

      // Enviar mensaje interno usando el admin autenticado que ejecuta la acción
      if (notifyUser) {
        await db.message.create({
          data: {
            senderId: user.id,
            receiverId: userId,
            title: "Advertencia del Sistema",
            content: sanitizedMessage,
            type: "WARNING",
          },
        });
        // Notificar en tiempo real por WebSocket
        const io = getIO();
        if (io) {
          io.to(`user:${userId}`).emit("notification", {
            type: "WARNING",
            title: "Advertencia del Sistema",
            message: sanitizedMessage,
            severity,
          });
        }

        // Notificar por Telegram si el usuario está verificado
        const targetUser = await db.user.findUnique({
          where: { id: userId },
          select: { telegramChatId: true },
        });
        if (targetUser?.telegramChatId) {
          const severityLabel =
            severity === "HIGH"
              ? "🔴 Alta"
              : severity === "MEDIUM"
                ? "🟡 Media"
                : "🔵 Baja";
          sendTelegramMessage(
            targetUser.telegramChatId,
            `⚠️ *ADVERTENCIA* (${severityLabel})\n\n${sanitizedMessage}`,
            { parse_mode: "Markdown" },
          );
        }
      }

      return NextResponse.json(warning);
    } catch (error) {
      logger.error({ err: error }, "Error al crear advertencia");
      return NextResponse.json(
        { error: "Error al crear advertencia" },
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
