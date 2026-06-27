import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIdentifier, rateLimit } from "@/lib/rate-limiter";
import crypto from "crypto";
import { logger } from "@/lib/logger";

const resetPasswordSchema = z
  .object({
    token: z.string().min(64, "Token inválido").max(64, "Token inválido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/,
        "La contraseña debe incluir mayúsculas, minúsculas, números y al menos un carácter especial",
      ),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 intentos por IP cada 15 minutos
    const identifier = getClientIdentifier(request);
    const limitCheck = await rateLimit({
      identifier,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!limitCheck.success) {
      return NextResponse.json(
        {
          error: "Demasiados intentos. Por favor, espera 15 minutos.",
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

    const body = await request.json();
    const validation = resetPasswordSchema.safeParse(body);

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

    const { token, password } = validation.data;

    // Hashear el token recibido para comparar con el hash guardado en BD
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Buscar usuario por hash del token
    const user = await db.user.findUnique({
      where: { resetPasswordToken: tokenHash },
      select: {
        id: true,
        email: true,
        isBlocked: true,
        isActive: true,
        resetPasswordExpires: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Token inválido o expirado" },
        { status: 400 },
      );
    }

    // Validar que el token no haya expirado
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      // Limpiar token expirado
      await db.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });
      return NextResponse.json(
        { error: "Token expirado. Solicita un nuevo restablecimiento." },
        { status: 400 },
      );
    }

    // No permitir si está bloqueado o inactivo
    if (user.isBlocked || !user.isActive) {
      return NextResponse.json(
        { error: "No se puede restablecer la contraseña de esta cuenta." },
        { status: 403 },
      );
    }

    // Hashear nueva contraseña (mismos 12 rounds que en registro)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Actualizar contraseña y limpiar token (en transacción)
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          updatedAt: new Date(),
        },
      });

      // Invalidar todas las sesiones existentes (obligar a re-login)
      await tx.session.deleteMany({
        where: { userId: user.id },
      });
    });

    return NextResponse.json({
      message: "Contraseña actualizada exitosamente",
    });
  } catch (error) {
    logger.error({ err: error }, "Error en reset-password");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

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
