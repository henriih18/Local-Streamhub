import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
import { logger } from "@/lib/logger";

export const DELETE = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { id: string } },
  ) => {
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

      const id = params.id;

      const uuidCheck = requireUUID(params.id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      // Verificar que exista la oferta especial
      const existingOffer = await db.specialOffer.findUnique({
        where: { id },
      });

      if (!existingOffer) {
        return NextResponse.json(
          { error: "Oferta especial no encontrada" },
          { status: 404 },
        );
      }

      // Eliminar la oferta especial
      await db.specialOffer.delete({
        where: { id },
      });

      // Invalidar caché
      userCache.delete("admin:special-offers:list");

      return NextResponse.json({
        message: "Oferta especial eliminada con éxito",
      });
    } catch (error) {
      logger.error({ err: error }, "Error al eliminar oferta especial");
      return NextResponse.json(
        { error: "Error al eliminar la oferta especial" },
        { status: 500 },
      );
    }
  },
);
