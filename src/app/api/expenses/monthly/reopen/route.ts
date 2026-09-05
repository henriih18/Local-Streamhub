import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { rateLimit, getClientIdentifier } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const POST = requireAdmin(
  async (request: NextRequest, _user, _context) => {
    try {
      // Rate limiting: 10 re-aperturas por minuto
      const limitCheck = await rateLimit({
        identifier: getClientIdentifier(request),
        limit: 10,
        windowMs: 60 * 1000,
      });
      if (!limitCheck.success) {
        return NextResponse.json(
          { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
          { status: 429 },
        );
      }

      const body = await request.json();
      const schema = z.object({
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      });
      const validation = schema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: "Datos inválidos", details: validation.error.issues },
          { status: 400 },
        );
      }

      const { year, month } = validation.data;

      const reopened = await db.monthlyProfit.update({
        where: { year_month: { year, month } },
        data: { isClosed: false },
      });

      logger.info(
        { year, month },
        `Mes ${month}/${year} reabierto`,
      );

      return NextResponse.json({
        message: `Mes ${month}/${year} reabierto correctamente`,
        record: reopened,
      });
    } catch (error) {
      logger.error({ err: error }, "Error al reabrir el mes");
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 },
      );
    }
  },
);