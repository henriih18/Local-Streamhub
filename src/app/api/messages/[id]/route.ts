import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, AuthUser } from "@/lib/auth";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { logger } from "@/lib/logger";

// ── Rate limit (in-memory, 20 req/min por usuario) ──────────────────
const rlMap = new Map<string, { count: number; resetTime: number }>();
const RL_MAX = 20;
const RL_WINDOW = 60_000; // 1 minuto

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rlMap.get(userId);
  if (!entry || now > entry.resetTime) {
    rlMap.set(userId, { count: 1, resetTime: now + RL_WINDOW });
    return true;
  }
  if (entry.count >= RL_MAX) return false;
  entry.count++;
  return true;
}

// ── Helper: extraer + validar UUID del pathname ─────────────────────
function extractMessageId(request: NextRequest): string | NextResponse {
  const raw = request.nextUrl.pathname.split("/").pop()!;
  const uuidCheck = requireUUID(raw);
  if (!uuidCheck.valid) {
    return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
  }
  return raw;
}

// ── Función compartida POST / PATCH ─────────────────────────────────
async function updateMessageHandler(
  request: NextRequest,
  user: AuthUser,
  messageId: string,
) {
  try {
    const body = await request.json();
    const messageReadSchema = z.object({
      isRead: z.boolean("isRead debe ser un valor booleano"),
    });
    const validation = messageReadSchema.safeParse(body);

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

    const message = await db.message.findFirst({
      where: { id: messageId, receiverId: user.id },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Mensaje no encontrado o no tienes permiso para modificarlo" },
        { status: 404 },
      );
    }

    const updatedMessage = await db.message.update({
      where: { id: messageId },
      data: { isRead: validation.data.isRead },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Mensaje marcado como ${validation.data.isRead ? "leído" : "no leído"}`,
      data: updatedMessage,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al actualizar mensaje");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export const POST = requireAuth(
  async (request: NextRequest, user: AuthUser) => {
    // 1. Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Intenta de nuevo más tarde." },
        { status: 429 },
      );
    }
    // 2. UUID validation
    const messageId = extractMessageId(request);
    if (messageId instanceof NextResponse) return messageId;
    // 3. Lógica
    return updateMessageHandler(request, user, messageId);
  },
);

// ── PATCH ───────────────────────────────────────────────────────────
export const PATCH = requireAuth(
  async (request: NextRequest, user: AuthUser) => {
    // 1. Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Intenta de nuevo más tarde." },
        { status: 429 },
      );
    }
    // 2. UUID validation
    const messageId = extractMessageId(request);
    if (messageId instanceof NextResponse) return messageId;
    // 3. Lógica
    return updateMessageHandler(request, user, messageId);
  },
);

// ── DELETE ───────────────────────────────────────────────────────────
export const DELETE = requireAuth(
  async (request: NextRequest, user: AuthUser) => {
    // 1. Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Intenta de nuevo más tarde." },
        { status: 429 },
      );
    }
    // 2. UUID validation
    const messageId = extractMessageId(request);
    if (messageId instanceof NextResponse) return messageId;

    // 3. Lógica
    try {
      const message = await db.message.findFirst({
        where: { id: messageId, receiverId: user.id },
      });

      if (!message) {
        return NextResponse.json(
          {
            error: "Mensaje no encontrado o no tienes permiso para eliminarlo",
          },
          { status: 404 },
        );
      }

      await db.message.delete({ where: { id: messageId } });

      return NextResponse.json({
        success: true,
        message: "Mensaje eliminado exitosamente",
      });
    } catch (error) {
      logger.error({ err: error }, "Error al eliminar mensaje");
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 },
      );
    }
  },
);
