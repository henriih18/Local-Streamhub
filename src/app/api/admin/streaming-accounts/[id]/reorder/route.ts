import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const PUT = requireAdmin(
  async (
    request: NextRequest,
    _user,
    { params }: { params: { id: string } },
  ) => {
    try {
      const limitCheck = await rateLimit({
        identifier: `admin:${_user.id}:${request.url}`,
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

      const uuidCheck = requireUUID(params.id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      const reorderSchema = z.object({
        order: z
          .number()
          .int("Orden debe ser un entero")
          .min(0, "Orden no puede ser negativo")
          .max(10000, "Orden demasiado grande"),
      });

      const body = await request.json();
      const validation = reorderSchema.safeParse(body);

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

      const { order } = validation.data;

      await db.streamingAccount.update({
        where: { id: params.id },
        data: { order },
      });

      // Invalidar caché
      userCache.delete("admin:streaming-accounts:list");

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, "Error al reordenar");
      return NextResponse.json(
        { error: "Error al reordenar" },
        { status: 500 },
      );
    }
  },
);
