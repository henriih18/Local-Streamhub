import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { encryptInventoryCredentials } from "@/lib/order-helper";
import { getIO, broadcastStockUpdate } from "@/lib/socket";
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

      const orderId = params.id;

      const uuidCheck = requireUUID(params.id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      const rehabilitateSchema = z.object({
        accountEmail: z
          .string()
          .email("Formato de email inválido")
          .max(255, "Email demasiado largo"),
        accountPassword: z
          .string()
          .min(1, "La contraseña es requerida")
          .max(200),
        profileName: z.string().max(100).nullish(),
        profilePin: z.string().max(20).nullish(),
        saleType: z.enum(["FULL", "PROFILES"]),
        streamingAccountId: z.string().min(1).optional(),
      });

      const body = await request.json();
      const validation = rehabilitateSchema.safeParse(body);

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
        accountEmail,
        accountPassword,
        profileName,
        profilePin,
        saleType,
        streamingAccountId,
      } = validation.data;

      // Mantener la validación de lógica de negocio:
      if (saleType === "PROFILES" && !profileName) {
        return NextResponse.json(
          {
            error: "Se requiere el nombre del perfil para rehabilitar perfiles",
          },
          { status: 400 },
        );
      }

      // Verificar si el pedido existe (incluir exclusiveAccountId)
      const order = await db.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return NextResponse.json(
          { error: "Pedido no encontrado" },
          { status: 404 },
        );
      }

      // Validar estado — no rehabilitar pedidos ya rehabilitados o pendientes
      if (order.status === "REHABILITATED") {
        return NextResponse.json(
          { error: "Este pedido ya fue rehabilitado" },
          { status: 400 },
        );
      }

      if (order.status === "PENDING") {
        return NextResponse.json(
          { error: "No se pueden rehabilitar pedidos pendientes" },
          { status: 400 },
        );
      }

      // Cifrar credenciales
      const encrypted = encryptInventoryCredentials({
        email: accountEmail,
        password: accountPassword,
        profileName: profileName ?? undefined,
        profilePin: profilePin ?? undefined,
      });

      // Transacción: crear stock + actualizar estado del pedido
      const updatedOrder = await db.$transaction(async (tx) => {
        // Crear stock según el tipo de venta
        if (order.exclusiveAccountId && !order.streamingAccountId) {
          // Cuenta exclusiva
          const exclusiveStock = await tx.exclusiveStock.create({
            data: {
              exclusiveAccountId: order.exclusiveAccountId,
              email: encrypted.email!,
              password: encrypted.password!,
              profileName: encrypted.profileName || null,
              pin: encrypted.profilePin || null,
              isAvailable: true,
            },
          });

          // Emitir actualización en tiempo real para exclusivos
          const io = getIO();
          if (io) {
            const updatedStocks = await tx.exclusiveStock.findMany({
              where: {
                exclusiveAccountId: order.exclusiveAccountId,
                isAvailable: true,
              },
            });
            broadcastStockUpdate(io, {
              accountId: order.exclusiveAccountId,
              accountType: "exclusive",
              type: saleType,
              newStock: updatedStocks.length,
            });
          }
        } else if (saleType === "FULL" && streamingAccountId) {
          // Cuenta completa
          await tx.accountStock.create({
            data: {
              streamingAccountId,
              email: encrypted.email!,
              password: encrypted.password!,
              isAvailable: true,
            },
          });
        } else if (saleType === "PROFILES" && streamingAccountId) {
          // Perfil
          await tx.accountProfile.create({
            data: {
              streamingAccountId,
              email: encrypted.email!,
              password: encrypted.password!,
              profileName: encrypted.profileName ?? profileName ?? "",
              profilePin: encrypted.profilePin || null,
              isAvailable: true,
            },
          });
        } else {
          throw new Error("Tipo de venta o cuenta no válida para rehabilitar");
        }

        // Marcar el pedido como rehabilitado
        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status: "REHABILITATED" },
        });

        return updated;
      });

      // Emitir actualización en tiempo real para cuentas regulares (fuera de la transacción)
      if (streamingAccountId && !order.exclusiveAccountId) {
        const io = getIO();
        if (io) {
          const updatedAccount = await db.streamingAccount.findUnique({
            where: { id: streamingAccountId },
            include: {
              accountStocks: { where: { isAvailable: true } },
              profileStocks: { where: { isAvailable: true } },
            },
          });

          const newStock =
            saleType === "PROFILES"
              ? updatedAccount?.profileStocks?.length || 0
              : updatedAccount?.accountStocks?.length || 0;

          broadcastStockUpdate(io, {
            accountId: streamingAccountId,
            accountType: "regular",
            type: saleType,
            newStock: newStock,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `${saleType === "FULL" ? "Cuenta" : saleType === "PROFILES" ? "Perfil" : "Cuenta exclusiva"} rehabilitado exitosamente y agregado al stock`,
        order: updatedOrder,
      });
    } catch (error: any) {
      logger.error({ err: error }, "Error al rehabilitar pedido");
      return NextResponse.json(
        { error: "Error al rehabilitar pedido" },
        { status: 500 },
      );
    }
  },
);

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
export function POST() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
export function DELETE() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
