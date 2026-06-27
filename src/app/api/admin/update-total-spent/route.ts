import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limiter";
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

    // Obtener todos los usuarios con sus pedidos.
    const users = await db.user.findMany({
      include: {
        orders: {
          select: {
            totalPrice: true,
          },
        },
      },
    });

    logger.info(`Se encontraron ${users.length} usuarios para actualizar`);

    // Actualizar el gasto total de cada usuario
    const updatePromises = users.map(async (user) => {
      const calculatedTotal = user.orders.reduce(
        (sum, order) => sum + order.totalPrice,
        0,
      );

      if (user.totalSpent !== calculatedTotal) {
        logger.info(
          `Actualizando el usuario ${user.email}: ${user.totalSpent} -> ${calculatedTotal}`,
        );

        return db.user.update({
          where: { id: user.id },
          data: { totalSpent: calculatedTotal },
        });
      }

      return null;
    });

    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter((result) => result !== null).length;

    logger.info(`Se actualizaron ${updatedCount} usuarios correctamente`);

    return NextResponse.json({
      success: true,
      message: `Se actualizó correctamente el total gastado para ${updatedCount} usuarios`,
      totalUsers: users.length,
      updatedUsers: updatedCount,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al actualizar totalSpent");
    return NextResponse.json(
      { error: "Error al actualizar el total gastado" },
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
