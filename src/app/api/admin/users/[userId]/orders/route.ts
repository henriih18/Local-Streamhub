import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { decryptInventoryCredentials } from "@/lib/order-helper";
import { requireUUID } from "@/lib/validate-uuid";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: Promise<{ userId }> },
  ) => {
    try {
      const resolvedParams = await params;
      const userId = resolvedParams.userId;

      const uuidCheck = requireUUID(resolvedParams.userId);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      if (!userId) {
        return NextResponse.json(
          { error: "ID de usuario requerido" },
          { status: 400 },
        );
      }

      const orders = await db.order.findMany({
        where: { userId },
        include: {
          user: {
            select: { email: true, name: true },
          },
          streamingAccount: {
            select: {
              name: true,
              type: true,
              duration: true,
              quality: true,
              screens: true,
              price: true,
            },
          },
          accountProfile: true,
          accountStock: true,
          exclusiveStock: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Desencriptar las credenciales de cada orden
      const decryptedOrders = orders.map((order) => {
        let accountEmail: string | undefined;
        let accountPassword: string | undefined;
        let profileName: string | undefined;
        let profilePin: string | undefined;

        // Desencriptar credenciales de accountStock
        if (order.accountStock) {
          const decryptedStock = decryptInventoryCredentials(
            order.accountStock,
          );
          accountEmail = decryptedStock.email;
          accountPassword = decryptedStock.password;
        }

        // Desencriptar credenciales de accountProfile
        if (order.accountProfile) {
          const decryptedProfile = decryptInventoryCredentials(
            order.accountProfile,
          );
          accountEmail = decryptedProfile.email;
          accountPassword = decryptedProfile.password;
          profileName = decryptedProfile.profileName || undefined;
          profilePin = decryptedProfile.profilePin || undefined;
        }

        // Desencriptar credenciales de exclusiveStock
        if (order.exclusiveStock) {
          const decryptedExclusive = decryptInventoryCredentials(
            order.exclusiveStock,
          );
          accountEmail = decryptedExclusive.email;
          accountPassword = decryptedExclusive.password;
          profileName = decryptedExclusive.profileName || undefined;
          profilePin = decryptedExclusive.profilePin || undefined;
        }

        return {
          ...order,
          accountEmail,
          accountPassword,
          profileName,
          profilePin,
        };
      });

      return NextResponse.json(decryptedOrders);
    } catch (error) {
      logger.error({ err: error }, "Error al recuperar los pedidos de usuario");
      return NextResponse.json(
        { error: "Error al recuperar los pedidos de usuario" },
        { status: 500 },
      );
    }
  },
);
