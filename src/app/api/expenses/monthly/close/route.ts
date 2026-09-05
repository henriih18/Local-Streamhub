import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { rateLimit, getClientIdentifier } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { computeAndPersistProfits } from "../../profits/_compute";

export const POST = requireAdmin(
  async (request: NextRequest, _user, _context) => {
    try {
      // Rate limiting: 10 cierres por minuto
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

      // 1. Calcular los números finales del mes y guardarlos (upsert)
      await computeAndPersistProfits(year, month);

      // 2. Marcar el mes como cerrado (congelado)
      const closed = await db.monthlyProfit.update({
        where: { year_month: { year, month } },
        data: { isClosed: true },
      });

      logger.info({ year, month }, `Mes ${month}/${year} cerrado y congelado`);

      return NextResponse.json({
        message: `Mes ${month}/${year} cerrado correctamente`,
        record: closed,
      });
    } catch (error) {
      logger.error({ err: error }, "Error al cerrar el mes");
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 },
      );
    }
  },
);
