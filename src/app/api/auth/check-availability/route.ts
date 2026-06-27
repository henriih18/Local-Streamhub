import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { getClientIdentifier, rateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";

const checkAvailabilitySchema = z.object({
  type: z.enum(["email", "username", "phone"]),
  value: z.string().min(1, "El valor es requerido"),
});

export async function GET(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await rateLimit({
      identifier,
      limit: 13,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const value = searchParams.get("value");

    // Validar parámetros
    const validation = checkAvailabilitySchema.safeParse({ type, value });
    if (!validation.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos" },
        { status: 400 },
      );
    }

    const { type: fieldType, value: fieldValue } = validation.data;

    // Verificar disponibilidad según el tipo
    let existingUser: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
    } | null = null;
    let fieldName = "";

    if (fieldType === "email") {
      existingUser = await db.user.findUnique({
        where: { email: fieldValue.toLowerCase() },
      });
      fieldName = "email";
    } else if (fieldType === "username") {
      existingUser = await db.user.findUnique({
        where: { username: fieldValue },
      });
      fieldName = "username";
    } else if (fieldType === "phone") {
      const digits = fieldValue.replace(/[\s\-\(\)\+]/g, "");
      existingUser = await db.user.findFirst({
        where: {
          //phone: { startsWith: digits },
          phone: digits,
        },
      });
      fieldName = "phone";
    }

    // Responder según disponibilidad
    if (existingUser) {
      return NextResponse.json({
        available: false,
        message:
          fieldType === "email"
            ? "Este email ya está registrado"
            : "Este nombre de usuario ya está en uso",
        field: fieldName,
      });
    } else {
      return NextResponse.json({
        available: true,
        message:
          fieldType === "email"
            ? "Email disponible"
            : "Nombre de usuario disponible",
        field: fieldName,
      });
    }
  } catch (error) {
    logger.error({ err: error }, "Error al verificar disponibilidad");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
