import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // === Rate limit para evitar brute force de códigos ===
    const identifier = getClientIP(request);
    const limitCheck = await rateLimit({
      identifier: `referral-validate:${identifier}`,
      limit: 20,
      windowMs: 60 * 1000,
    });

    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code")?.toUpperCase().trim();

    // Validación: código válido (3-50 chars, alfanumérico + guiones)
    if (!code || code.length < 4 || code.length > 50) {
      return NextResponse.json({ valid: false });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return NextResponse.json({ valid: false });
    }

    /* // Buscar el referidor (solo devuelve username, no datos sensibles)
    const referrer = await db.user.findUnique({
      where: { referralCode: code },
      select: {
        username: true,
        id: true,
        isActive: true,
        isBlocked: true,
      },
    }); */

    // Buscar el referidor (solo devuelve fullName, no datos sensibles)
    const referrer = await db.user.findUnique({
      where: { referralCode: code },
      select: {
        fullName: true,
        id: true,
        isActive: true,
        isBlocked: true,
      },
    });

    // Solo validar si el referidor está activo y no bloqueado
    const isValid = !!referrer && referrer.isActive && !referrer.isBlocked;

    /* return NextResponse.json({
      valid: isValid,
      referrerUsername: isValid ? referrer?.username : null,
    }); */

    return NextResponse.json({
      valid: isValid,
      referrerName: isValid ? referrer?.fullName : null,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al validar código de referido");
    return NextResponse.json(
      { valid: false, error: "Error al validar código" },
      { status: 500 },
    );
  }
}
