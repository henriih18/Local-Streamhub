import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIdentifier, rateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 20 peticiones por minuto por IP
    const identifier = getClientIdentifier(req);
    const limitCheck = await rateLimit({
      identifier,
      limit: 12,
      windowMs: 60 * 1000,
    });

    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const tempToken: string = body.tempToken;

    if (!tempToken) {
      return NextResponse.json(
        { error: "tempToken es requerido" },
        { status: 400 },
      );
    }

    const linkToken = await db.telegramLinkToken.findUnique({
      where: { tempToken },
    });

    if (!linkToken) {
      return NextResponse.json({
        status: "NOT_FOUND",
      });
    }

    if (linkToken.expiresAt < new Date()) {
      await db.telegramLinkToken.delete({ where: { id: linkToken.id } });
      return NextResponse.json({
        status: "EXPIRED",
      });
    }

    // SOLO devolver el estado, SIN chatId ni phone
    if (linkToken.state.startsWith("LINKED_")) {
      return NextResponse.json({
        status: "LINKED",
      });
    }

    if (linkToken.state === "WAITING_PHONE") {
      return NextResponse.json({
        status: "WAITING_PHONE",
      });
    }

    return NextResponse.json({
      status: "PENDING",
    });
  } catch (error) {
    logger.error({ err: error }, "Error al verificar el enlace de telegram");
    return NextResponse.json(
      { error: "Error al verificar estado del enlace" },
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
