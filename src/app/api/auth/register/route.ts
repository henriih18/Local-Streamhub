import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  sanitizeFullName,
  sanitizePhone,
  sanitizeUsername,
} from "@/lib/sanitize";
import { getClientIdentifier, rateLimit } from "@/lib/rate-limiter";
import crypto from "crypto";
import { logger } from "@/lib/logger";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(3, "El nombre debe tener al menos 3 caracteres")
      .max(100, "El nombre no puede exceder 100 caracteres"),
    email: z
      .string()
      .email("Email no válido")
      .max(255, "El email no puede exceder 255 caracteres"),
    phone: z
      .string()
      .min(10, "El teléfono debe tener al menos 10 dígitos")
      .max(20, "El teléfono no puede exceder 20 caracteres"),
    username: z
      .string()
      .min(3, "El usuario debe tener al menos 3 caracteres")
      .max(20, "El usuario no puede exceder 20 caracteres")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Solo se permiten letras, números y guiones bajos",
      ),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/,
        "La contraseña debe incluir mayúsculas, minúsculas, números y al menos un carácter especial",
      ),
    telegramTempToken: z.string().min(1, "Verificación de Telegram requerida"),
    acceptMarketing: z.boolean().default(false),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const limitCheck = await rateLimit({
      identifier,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!limitCheck.success) {
      const retryAfter = Math.ceil((limitCheck.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error:
            "Demasiados intentos de registro. Por favor, espera 15 minutos.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(limitCheck.resetTime).toISOString(),
          },
        },
      );
    }

    const body = await request.json();
    const validation = registerSchema.safeParse(body);

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

    const {
      fullName,
      email,
      phone,
      username,
      password,
      telegramTempToken,
      acceptMarketing,
    } = validation.data;

    const sanitizedFullName = sanitizeFullName(fullName);
    const sanitizedPhone = sanitizePhone(phone);
    const sanitizedUsername = sanitizeUsername(username);

    // ── Verificar token de Telegram ──
    const linkToken = await db.telegramLinkToken.findUnique({
      where: { tempToken: telegramTempToken },
    });

    if (!linkToken) {
      return NextResponse.json(
        { error: "Verificación de Telegram inválida", field: "phone" },
        { status: 400 },
      );
    }

    if (!linkToken.state.startsWith("LINKED_")) {
      return NextResponse.json(
        {
          error: "El teléfono aún no ha sido verificado en Telegram",
          field: "phone",
        },
        { status: 400 },
      );
    }

    if (linkToken.expiresAt < new Date()) {
      await db.telegramLinkToken.delete({ where: { id: linkToken.id } });
      return NextResponse.json(
        {
          error: "La verificación de Telegram expiró. Intenta de nuevo.",
          field: "phone",
        },
        { status: 400 },
      );
    }

    // Extraer datos del estado: LINKED_{chatId}_{phone}
    const parts = linkToken.state.split("_");
    const verifiedChatId = parts[1];
    const verifiedPhone = parts.slice(2).join("_");

    // Comparar teléfono del formulario con el de Telegram
    let normalizedForm = sanitizedPhone.replace(/[\s\-\(\)\+]/g, "");

    // Auto-prepend código de país si el usuario solo puso 10 dígitos
    if (normalizedForm.length === 10 && !normalizedForm.startsWith("57")) {
      normalizedForm = "57" + normalizedForm;
    }

    const normalizedTelegram = verifiedPhone.replace(/[\s\-\(\)\+]/g, "");

    if (normalizedForm !== normalizedTelegram) {
      await db.telegramLinkToken.delete({ where: { id: linkToken.id } });
      return NextResponse.json(
        {
          error:
            "El número ingresado no coincide con el verificado en Telegram",
          field: "phone",
        },
        { status: 400 },
      );
    }

    // Limpiar token usado
    await db.telegramLinkToken.delete({ where: { id: linkToken.id } });

    // ── Verificar unicidad ──
    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json(
        { error: "Este email ya está registrado", field: "email" },
        { status: 409 },
      );
    }

    const existingUsername = await db.user.findUnique({
      where: { username: sanitizedUsername },
    });
    if (existingUsername) {
      return NextResponse.json(
        { error: "Este nombre de usuario ya está en uso", field: "username" },
        { status: 409 },
      );
    }

    // Verificar teléfono en ambos formatos (formulario y Telegram)
    const existingPhone = await db.user.findFirst({
      where: { phone: { in: [verifiedPhone] } },
    });
    if (existingPhone) {
      return NextResponse.json(
        { error: "Este teléfono ya está registrado", field: "phone" },
        { status: 409 },
      );
    }

    // ── Crear usuario ──
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Construir teléfono final con código de país
    let finalPhone = sanitizedPhone.replace(/[\s\-\(\)\+]/g, "");
    if (finalPhone.length === 10 && !finalPhone.startsWith("57")) {
      finalPhone = "57" + finalPhone;
    }

    const newUser = await db.user.create({
      data: {
        fullName: sanitizedFullName,
        email: email.toLowerCase(),
        phone: finalPhone,
        username: sanitizedUsername,
        password: hashedPassword,
        telegramChatId: verifiedChatId,
        acceptMarketing,
        emailVerified: true,
        isActive: true,
        role: "USER",
        credits: 0,
        lastLogin: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        country: true,
        language: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Usuario creado exitosamente", user: newUser },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "Error en registro");
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Error: Uno de los campos ya está en uso" },
        { status: 409 },
      );
    }
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
export function DELETE() {
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

export function PATCH() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
