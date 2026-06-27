import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
      userId: z.string().min(1, "El ID de usuario es requerido"),
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

    return NextResponse.json({ user: targetUser, creditRecharge });
  } catch (error) {
    logger.error({err: error},"Error recharging credits");
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
