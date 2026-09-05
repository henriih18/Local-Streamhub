import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { rateLimit, getClientIdentifier } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";
import { computeAndPersistProfits } from "./_compute";

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    // Rate limiting: 30 peticiones por minuto por IP
    const limitCheck = await rateLimit({
      identifier: getClientIdentifier(request),
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    const result = await computeAndPersistProfits(year, month);

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ err: error }, "Error al calcular las ganancias");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});
