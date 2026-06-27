import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limiter";
import { sanitizeInput } from "@/lib/sanitize";

export const PUT = requireAdmin(
  async (
    request: NextRequest,
    user: any,
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
          { error: "Demasiadas solicitudes." },
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

      const updateExclusiveAccountSchema = z.object({
        title: z.string().max(100).optional(),
        description: z.string().max(1000).optional(),
        type: z.string().max(50).optional(),
        price: z.coerce.number().positive().optional(),
        duration: z.string().optional(),
        maxSlots: z.coerce.number().int().min(1).optional(),
        //credentials: z.string().optional(),
        isPublic: z.boolean().optional(),
        expiresAt: z.union([z.string(), z.date()]).optional().nullable(),
        isActive: z.boolean().optional(),
        allowedUsers: z
          .array(z.string().uuid("ID de usuario inválido"))
          .optional(),
      });

      const rawData = await request.json();
      const validation = updateExclusiveAccountSchema.safeParse(rawData);

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

      const data = validation.data;

      // Actualizar cuenta exclusiva
      const account = await db.exclusiveAccount.update({
        where: { id },
        data: {
          ...(data.title && { name: sanitizeInput(data.title) }),
          ...(data.description && {
            description: sanitizeInput(data.description),
          }),
          ...(data.type && { type: sanitizeInput(data.type) }),
          ...(data.price !== undefined && {
            price: data.price,
          }),
          ...(data.duration !== undefined && {
            duration: data.duration,
          }),
          ...(data.maxSlots !== undefined && {
            maxSlots: data.maxSlots,
          }),
          ...(data.isPublic !== undefined && {
            isPublic: Boolean(data.isPublic),
          }),
          ...(data.expiresAt !== undefined && {
            expiresAt: data.expiresAt
              ? typeof data.expiresAt === "string"
                ? new Date(data.expiresAt)
                : data.expiresAt
              : null,
          }),
          ...(data.isActive !== undefined && {
            isActive: Boolean(data.isActive),
          }),
          ...(data.allowedUsers !== undefined && {
            allowedUsers: {
              set: [],
              connect: data.allowedUsers.map((userId: string) => ({
                id: userId,
              })),
            },
          }),
        },
        include: {
          orders: {
            select: { id: true },
          },
        },
      });

      // Transformar los datos para incluir el recuento de usedSlots
      const transformedAccount = {
        ...account,
        usedSlots: account.orders.length,
      };

      // Invalidar caché cuando se actualiza cuenta exclusiva
      userCache.delete("admin:exclusive-accounts:list");

      return NextResponse.json(transformedAccount);
    } catch (error) {
      logger.error({ err: error }, "Error al actualizar la cuenta exclusiva");

      return NextResponse.json(
        { error: "Error al actualizar cuenta exclusiva" },
        { status: 500 },
      );
    }
  },
);

export const DELETE = requireAdmin(
  async (
    request: NextRequest,
    user: any,
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
          { error: "Demasiadas solicitudes." },
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

      // Comprobar si la cuenta tiene pedidos activos
      const activeOrders = await db.order.findMany({
        where: {
          exclusiveAccountId: id,
          status: "COMPLETED",
        },
      });

      if (activeOrders.length > 0) {
        return NextResponse.json(
          { error: "No se puede eliminar una cuenta con órdenes activas" },
          { status: 400 },
        );
      }

      // Eliminar cuenta exclusiva con eliminaciones en cascada
      await db.$transaction(async (tx) => {
        await tx.exclusiveStock.deleteMany({
          where: { exclusiveAccountId: id },
        });

        await tx.exclusiveAccount.delete({
          where: { id },
        });
      });

      // Invalidar caché cuando se elimina una cuenta exclusiva
      userCache.delete("admin:exclusive-accounts:list");

      return NextResponse.json({ message: "Cuenta eliminada exitosamente" });
    } catch (error) {
      logger.error({ err: error }, "Error al eliminar cuenta exclusiva");

      return NextResponse.json(
        { error: "Error al eliminar cuenta exclusiva" },
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
