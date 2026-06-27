import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput, sanitizeHtml } from "@/lib/sanitize";
import { rateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { sendTelegramMessage } from "@/lib/telegram";
import { logger } from "@/lib/logger";

export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const limitCheck = await rateLimit({
      identifier: `broadcast:${user.id}`,
      limit: 4,
      windowMs: 60 * 60 * 1000,
    });

    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Límite de mensajes masivos alcanzado. Máximo 3 por hora." },
        { status: 429 },
      );
    }

    const broadcastSchema = z.object({
      title: z
        .string()
        .min(1, "El título es requerido")
        .max(200, "Título demasiado largo"),
      content: z
        .string()
        .min(1, "El contenido es requerido")
        .max(10000, "Contenido demasiado largo"),
      type: z.enum(["GENERAL", "WARNING", "SYSTEM_NOTIFICATION"], {
        message: "Tipo debe ser GENERAL, WARNING o SYSTEM_NOTIFICATION",
      }),
      sendToTelegram: z.boolean().optional(),
    });

    const body = await request.json();
    const validation = broadcastSchema.safeParse(body);

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

    const { title, content, type, sendToTelegram } = validation.data;
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedContent = sanitizeHtml(content);

    // Consigue todos los usuarios excepto los administradores.
    const users = await db.user.findMany({
      where: {
        role: {
          in: ["USER", "VENDEDOR"],
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        telegramChatId: true,
      },
    });

    if (users.length === 0) {
      return NextResponse.json(
        {
          error: "No hay usuarios registrados para enviar mensajes",
        },
        { status: 404 },
      );
    }

    // Obtener el primer administrador como remitente
    const adminUser = await db.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true, fullName: true, email: true },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "No hay administradores disponibles para enviar mensajes" },
        { status: 404 },
      );
    }

    // Crear mensajes para todos los usuarios
    const messages = await Promise.all(
      users.map((user) =>
        db.message.create({
          data: {
            senderId: adminUser.id,
            receiverId: user.id,
            title: sanitizedTitle,
            content: sanitizedContent,
            type: type as "GENERAL" | "WARNING" | "SYSTEM_NOTIFICATION",
            isRead: false,
          },
        }),
      ),
    );

    // Enviar por Telegram si se solicitó
    let telegramSent = 0;
    let telegramFailed = 0;

    if (sendToTelegram) {
      const telegramUsers = users.filter((u) => u.telegramChatId);

      const typeEmoji =
        type === "WARNING"
          ? "⚠️"
          : type === "SYSTEM_NOTIFICATION"
            ? "🔔"
            : "📢";

      const telegramText = `${typeEmoji} *${sanitizedTitle}*\n\n${sanitizedContent}`;

      const results = await Promise.allSettled(
        telegramUsers.map((u) =>
          sendTelegramMessage(u.telegramChatId!, telegramText, {
            parse_mode: "Markdown",
          }),
        ),
      );

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value === true) {
          telegramSent++;
        } else {
          telegramFailed++;
        }
      });
    }

    return NextResponse.json({
      message: "Mensajes enviados exitosamente",
      messageCount: messages.length,
      usersCount: users.length,
      type,
      title: sanitizedTitle,
      sender: adminUser.fullName || adminUser.email,
      telegramSent: sendToTelegram ? telegramSent : 0,
      telegramFailed: sendToTelegram ? telegramFailed : 0,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al enviar el mensaje de difusión.");
    return NextResponse.json(
      { error: "Error al enviar mensajes masivos" },
      { status: 500 },
    );
  }
});
export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const totalUsers = await db.user.count({
      where: { role: "USER" },
    });

    const recentMessages = await db.message.count({
      where: {
        senderId: "system",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return NextResponse.json({
      totalUsers,
      recentBroadcastMessages: recentMessages,
      canSendBroadcast: totalUsers > 0,
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Error al obtener las estadísticas de la transmisión",
    );
    return NextResponse.json(
      { error: "Error al obtener estadísticas" },
      { status: 500 },
    );
  }
});
