import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { SignJWT } from "jose";
import { rateLimit, getClientIdentifier } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";

// Schema de validación para el login
const loginSchema = z.object({
  email: z.string().email("Email no válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("CRITICAL: JWT_SECRET no está definido");
  }

  return new TextEncoder().encode(secret);
}

export async function POST(request: NextRequest) {
  try {
    /* =======================
       RATE LIMIT (PRIMER PASO)
    ======================= */
    const ip = getClientIdentifier(request);
    const limitCheck = await rateLimit({
      identifier: ip,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!limitCheck.success) {
      const retryAfter = Math.ceil((limitCheck.resetTime - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: "Demasiados intentos. Por favor, espera 15 minutos.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(limitCheck.resetTime).toISOString(),
          },
        },
      );
    }

    /* =======================
       VALIDACIÓN DE INPUT
    ======================= */
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    const JWT_SECRET = getJwtSecret();

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

    const { email, password } = validation.data;

    // Rate limit por email
    const emailLimitCheck = await rateLimit({
      identifier: `login:${email}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });

    if (!emailLimitCheck.success) {
      return NextResponse.json(
        { error: "Demasiados intentos para este email. Intenta más tarde." },
        { status: 429 },
      );
    }

    /* =======================
       BUSCAR USUARIO
    ======================= */
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        password: true,
        role: true,
        isActive: true,
        isBlocked: true,
        blockReason: true,
        blockExpiresAt: true,
        emailVerified: true,
        lastLogin: true,
        language: true,
        country: true,
        credits: true,
        avatar: true,
        phone: true,
        createdAt: true,
        tokenVersion: true,
      },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 },
      );
    }

    /* =======================
       BLOQUEOS (UserBlock)
    ======================= */
    const userBlocks = await db.userBlock.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    let isBlocked = false;
    let blockType = "";
    let blockReason = "";
    let blockExpiresAt: Date | null = null;

    for (const block of userBlocks) {
      if (block.blockType === "permanent") {
        isBlocked = true;
        blockType = "permanente";
        blockReason = block.reason;
        break;
      }

      if (
        block.blockType === "temporary" &&
        block.expiresAt &&
        new Date() < block.expiresAt
      ) {
        isBlocked = true;
        blockType = "temporal";
        blockReason = block.reason;
        blockExpiresAt = block.expiresAt;
        break;
      }
    }

    if (user.isBlocked) {
      isBlocked = true;
      blockReason ||= user.blockReason || "Restricción de cuenta";
      blockExpiresAt ||= user.blockExpiresAt;
      blockType ||= blockExpiresAt ? "temporal" : "permanente";
    }

    if (isBlocked) {
      return NextResponse.json(
        {
          error: `Cuenta bloqueada (${blockType}). Motivo: ${blockReason}`,
          field: "email",
          blockDetails: {
            type: blockType,
            reason: blockReason,
            expiresAt: blockExpiresAt,
          },
        },
        { status: 403 },
      );
    }

    /* =======================
       VALIDACIONES FINALES
    ======================= */
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Cuenta desactivada. Contacta con soporte.", field: "email" },
        { status: 403 },
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos", field: "email" },
        { status: 401 },
      );
    }

    /* =======================
       JWT
    ======================= */

    // SignJWT de jose (es async)
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      /* .setExpirationTime("1m") // 1 minuto para pruebas */
      .sign(JWT_SECRET);

    /* =======================
       AUDITORÍA
    ======================= */
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), updatedAt: new Date() },
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      isBlocked: user.isBlocked,
      emailVerified: user.emailVerified,
      //language: user.language,
      //country: user.country,
      credits: user.credits,
      avatar: user.avatar,
      //phone: user.phone,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };

    // Calcular la fecha exacta de expiración del token
    const tokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000, // 24h en milisegundos
      /* Date.now() + 1 * 60 * 1000, */ // 1 minuto para pruebas
    ).toISOString();

    const response = NextResponse.json({
      message: "Inicio de sesión exitoso",
      user: userResponse,
      tokenExpiresAt,
    });

    response.cookies.set("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      //secure: "auto" as any,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24,
      /* maxAge: 60, // 1 minuto para pruebas*/
    });

    return response;
  } catch (error) {
    logger.error({ err: error }, "Error en login");
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
