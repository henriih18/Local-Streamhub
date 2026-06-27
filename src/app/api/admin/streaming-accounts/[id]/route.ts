import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const PUT = requireAdmin(
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

      const uuidCheck = requireUUID(id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      const updateStreamingAccountSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().min(1).max(1000).optional(),
        price: z.coerce.number().positive().optional(),
        type: z.string().min(1).max(50).optional(),
        duration: z.string().min(1).max(50).optional(),
        quality: z.string().min(1).max(20).optional(),
        screens: z.coerce.number().int().min(1).max(20).optional(),
        isActive: z.boolean().optional(),
        saleType: z.enum(["FULL", "PROFILES"]).optional(),
        maxProfiles: z.coerce.number().int().min(1).optional().nullable(),
        pricePerProfile: z.coerce.number().positive().optional().nullable(),
      });

      const body = await request.json();
      const validation = updateStreamingAccountSchema.safeParse(body);

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
        name,
        description,
        price,
        type,
        duration,
        quality,
        screens,
        isActive,
        saleType,
        maxProfiles,
        pricePerProfile,
      } = validation.data;

      const updatedAccount = await db.streamingAccount.update({
        where: { id },
        data: {
          ...(name && { name: sanitizeInput(name) }),
          ...(description && { description: sanitizeInput(description) }),
          ...(price !== undefined && { price }),
          ...(type && { type: sanitizeInput(type) }),
          ...(duration && { duration: sanitizeInput(duration) }),
          ...(quality && { quality: sanitizeInput(quality) }),
          ...(screens !== undefined && { screens }),
          ...(isActive !== undefined && { isActive }),
          ...(saleType && { saleType }),
          ...(maxProfiles !== undefined &&
            maxProfiles !== null && { maxProfiles }),
          ...(pricePerProfile !== undefined &&
            pricePerProfile !== null && {
              pricePerProfile,
            }),
        },
      });

      // Invalidar caché
      userCache.delete("admin:streaming-accounts:list");

      return NextResponse.json(updatedAccount);
    } catch (error) {
      logger.error(
        { err: error },
        "Error al actualizar la cuenta de streaming",
      );
      return NextResponse.json(
        { error: "Error al actualizar la cuenta de streaming" },
        { status: 500 },
      );
    }
  },
);

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

      const uuidCheck = requireUUID(id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      // Verificar si hay órdenes asociadas
      const associatedOrders = await db.order.findMany({
        where: { streamingAccountId: id },
      });

      if (associatedOrders.length > 0) {
        return NextResponse.json(
          {
            error:
              "No se puede eliminar esta cuenta porque tiene órdenes asociadas",
            count: associatedOrders.length,
          },
          { status: 400 },
        );
      }

      // Eliminar relaciones dependientes primero
      await db.vendorPricing.deleteMany({ where: { streamingAccountId: id } });
      await db.accountStock.deleteMany({ where: { streamingAccountId: id } });
      await db.accountProfile.deleteMany({ where: { streamingAccountId: id } });
      await db.cartItem.deleteMany({ where: { streamingAccountId: id } });
      await db.specialOffer.deleteMany({ where: { streamingAccountId: id } });

      // Eliminar la cuenta
      await db.streamingAccount.delete({ where: { id } });

      // Invalidar caché
      userCache.delete("admin:streaming-accounts:list");

      return NextResponse.json({
        message: "Cuenta de streaming eliminada correctamente",
      });
    } catch (error) {
      logger.error({ err: error }, "Error al eliminar la cuenta de streaming");
      return NextResponse.json(
        { error: "Error al eliminar la cuenta de streaming" },
        { status: 500 },
      );
    }
  },
);

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT, DELETE" } },
  );
}

export function POST() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT, DELETE" } },
  );
}
