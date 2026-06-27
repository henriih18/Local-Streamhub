import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastMessageUpdate } from "@/lib/socket";
import { requireAuth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const messageSchema = z.object({
      receiverId: z.string().min(1, "El receptor es requerido"),
      title: z
        .string()
        .min(1, "El título es requerido")
        .max(200, "Título demasiado largo"),
      content: z
        .string()
        .min(1, "El contenido es requerido")
        .max(5000, "Contenido demasiado largo"),
      type: z
        .enum([
          "GENERAL",
          "WARNING",
          "BLOCK_NOTICE",
          "UNBLOCK_NOTICE",
          "RESTRICTION_NOTICE",
          "SYSTEM_NOTIFICATION",
        ])
        .default("GENERAL"),
    });

    const body = await request.json();
    const validation = messageSchema.safeParse(body);

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

    const { receiverId, title, content, type } = validation.data;
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedContent = sanitizeInput(content);

    // Get receiver user
    const receiver = await db.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "Receptor no encontrado" },
        { status: 404 },
      );
    }

    // Crear Mensaje
    const message = await db.message.create({
      data: {
        senderId: user.id,
        receiverId,
        title: sanitizedTitle,
        content: sanitizedContent,
        type,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Obtener recuento no leído actualizado para el receptor
    const newUnreadCount = await db.message.count({
      where: {
        receiverId,
        isRead: false,
      },
    });

    // Transmitir actualización en tiempo real al receptor
    try {
      const { getIO } = await import("@/lib/socket");
      const io = getIO();
      if (io) {
        broadcastMessageUpdate(io, receiverId, newUnreadCount);
      }
    } catch (error) {
      logger.error(
        { err: error },
        "Error al transimitir actualizacion del mensaje en tiempo real",
      );
      return NextResponse.json({
        error: "Error al enviar la actualización del mensaje",
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    logger.error({ err: error }, "Error al enviar mensaje");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    // Autenticar usuario

    // Obtener mensajes recibidos
    const messages = await db.message.findMany({
      where: {
        receiverId: user.id,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Obtener recuento de no leídos
    const unreadCount = await db.message.count({
      where: {
        receiverId: user.id,
        isRead: false,
      },
    });

    return NextResponse.json({
      messages,
      unreadCount,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al obtener mensajes");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});
