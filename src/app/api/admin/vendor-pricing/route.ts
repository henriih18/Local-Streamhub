import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const pricing = await db.vendorPricing.findMany({
      include: {
        streamingAccount: {
          select: {
            id: true,
            name: true,
            price: true,
            type: true,
            duration: true,
            screens: true,
          },
        },
      },
    });

    return NextResponse.json(pricing);
  } catch (error) {
    logger.error({ err: error }, "Error al obtener precios de vendedor");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});
export const PUT = requireAdmin(async (request: NextRequest, user) => {
  try {
    const limitCheck = await rateLimit({
      identifier: `admin:${user.id}:${request.url}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limitCheck.success) {
      return NextResponse.json(
        {
          error: "Demasiadas solicitudes. Espera un momento.",
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

    const vendorPricingSchema = z.object({
      pricing: z.record(
        z.string().uuid("ID de cuenta inválido"),
        z.object({
          vendorPrice: z
            .number()
            .min(0, "El precio no puede ser negativo")
            .max(1000000, "Precio máximo excedido"),
        }),
      ),
    });

    const body = await request.json();
    const validation = vendorPricingSchema.safeParse(body);

    if (!validation.success) {
      const allErrors = validation.error.issues.map((issue) => ({
        field: String(issue.path[0]),
        message: issue.message,
      }));
      return NextResponse.json(
        { error: "Datos inválidos", details: allErrors },
        { status: 400 },
      );
    }

    const { pricing } = validation.data;

    for (const [accountId, config] of Object.entries(pricing)) {
      const { vendorPrice } = config;
      await db.vendorPricing.upsert({
        where: { streamingAccountId: accountId },
        update: {
          vendorPrice: vendorPrice || 0,
          updatedAt: new Date(),
        },
        create: {
          streamingAccountId: accountId,
          vendorPrice: vendorPrice || 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Precios de vendedor actualizados correctamente",
    });
  } catch (error) {
    logger.error({ err: error }, "Error al guardar precios de vendedor");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});
