import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    // Autenticar usuario

    const userFull = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        credits: true,
        isBlocked: true,
        blockReason: true,
        blockExpiresAt: true,
        createdAt: true,
      },
    });

    if (!userFull) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(userFull);
  } catch (error) {
    logger.error({ err: error }, "Error al obtener los créditos del usuario");
    return NextResponse.json(
      { error: "Error al obtener los créditos del usuario" },
      { status: 500 },
    );
  }
});
