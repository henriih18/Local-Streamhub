import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SaleType } from "@prisma/client";
import { encrypt } from "@/lib/crypto";
import { encryptOrderCredentials } from "@/lib/order-helper";
import { calculateExpirationDate } from "@/lib/date-utils";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
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

      // Obtener el pedido original con todos los datos necesarios
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          streamingAccount: true,
          exclusiveAccount: true,
          accountStock: true,
          accountProfile: true,
          exclusiveStock: true,
        },
      });

      if (!order) {
        return NextResponse.json(
          { error: "Pedido no encontrado" },
          { status: 404 },
        );
      }

      if (order.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Solo se pueden renovar pedidos completados" },
          { status: 400 },
        );
      }

      // Obtener precio del servicio
      const renewalPrice =
        order.streamingAccount?.price || order.exclusiveAccount?.price || 0;

      // Verificar créditos del usuario
      if (order.user.credits < renewalPrice) {
        return NextResponse.json(
          {
            error: `El usuario no tiene suficientes créditos. Necesita: $${renewalPrice.toLocaleString()}, Tiene: $${order.user.credits.toLocaleString()}`,
          },
          { status: 400 },
        );
      }

      const duration =
        order.streamingAccount?.duration ||
        order.exclusiveAccount?.duration ||
        "1 mes";

      // Calcular nueva expiración desde la fecha actual (no desde la expiración del pedido original)
      const newExpiresAt = calculateExpirationDate(duration);

      // Obtener credenciales descifradas del stock original
      let credentials: {
        email: string;
        password: string;
        profileName?: string;
        profilePin?: string;
      } = { email: "", password: "" };

      if (order.accountStock) {
        const { decryptInventoryCredentials } =
          await import("@/lib/order-helper");
        const decrypted = decryptInventoryCredentials(order.accountStock);
        credentials = {
          email: decrypted.email || "",
          password: decrypted.password || "",
        };
      } else if (order.accountProfile) {
        const { decryptInventoryCredentials } =
          await import("@/lib/order-helper");
        const decrypted = decryptInventoryCredentials(order.accountProfile);
        credentials = {
          email: decrypted.email || "",
          password: decrypted.password || "",
          profileName: decrypted.profileName || undefined,
          profilePin: decrypted.profilePin || undefined,
        };
      } else if (order.exclusiveStock) {
        const { decryptInventoryCredentials } =
          await import("@/lib/order-helper");
        const decrypted = decryptInventoryCredentials(order.exclusiveStock);
        credentials = {
          email: decrypted.email || "",
          password: decrypted.password || "",
        };
      }

      if (!credentials.email || !credentials.password) {
        return NextResponse.json(
          {
            error:
              "No se encontraron credenciales válidas en el pedido original",
          },
          { status: 400 },
        );
      }

      // Transacción: cobrar + crear nuevo pedido + actualizar pedido original
      const newOrder = await db.$transaction(async (tx) => {
        // Cobrar créditos al usuario
        const userUpdate = await tx.user.updateMany({
          where: {
            id: order.userId,
            isBlocked: false,
            credits: { gte: renewalPrice },
          },
          data: {
            credits: { decrement: renewalPrice },
            totalSpent: { increment: renewalPrice },
          },
        });

        if (userUpdate.count === 0) {
          throw new Error("INSUFFICIENT_CREDITS");
        }

        // Expirar el pedido original para que no aparezca como activo
        await tx.order.update({
          where: { id: orderId },
          data: {
            expiresAt: new Date(),
            lastRenewedAt: new Date(),
          },
        });

        // Cifrar credenciales para el nuevo pedido
        const encrypted = encryptOrderCredentials({
          accountEmail: credentials.email,
          accountPassword: credentials.password,
          profileName: credentials.profileName,
          profilePin: credentials.profilePin,
        });

        // Crear nuevo pedido (aparece en la bandeja del usuario)
        const created = await tx.order.create({
          data: {
            userId: order.userId,
            streamingAccountId: order.streamingAccountId,
            exclusiveAccountId: order.exclusiveAccountId,
            accountStockId: order.accountStockId,
            accountProfileId: order.accountProfileId,
            exclusiveStockId: order.exclusiveStockId,
            saleType: order.saleType,
            quantity: 1,
            totalPrice: renewalPrice,
            accountEmail: encrypted.accountEmail,
            accountPassword: encrypted.accountPassword,
            profileName: encrypted.profileName,
            profilePin: encrypted.profilePin,
            status: "COMPLETED",
            expiresAt: newExpiresAt,
            renewalCount: (order.renewalCount || 0) + 1,
          },
        });

        return created;
      });

      return NextResponse.json({
        success: true,
        message:
          "Cuenta renovada exitosamente. Se creó un nuevo pedido en la bandeja del usuario.",
        order: {
          id: newOrder.id,
          newExpiresAt: newOrder.expiresAt,
          renewalPrice,
        },
      });
    } catch (error: any) {
      if (error.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json(
          { error: "Créditos insuficientes" },
          { status: 400 },
        );
      }
      logger.error({ err: error }, "Error al renovar el pedido");
      return NextResponse.json(
        { error: "Error al renovar la cuenta" },
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
