import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  decryptInventoryCredentials,
  decryptOrderCredentials,
} from "@/lib/order-helper";
import { parseSafeEnum, parseSafeInt } from "@/lib/parse-safe";
import { NextRequest, NextResponse } from "next/server";

export const GET = requireAuth(async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url);
  const page = parseSafeInt(searchParams.get("page"), 1, 1, 10000);
  const limit = parseSafeInt(searchParams.get("limit"), 10, 1, 100);
  const filter = parseSafeEnum(
    searchParams.get("filter"),
    ["all", "active", "expired"],
    "all",
  );

  const validPage = Math.max(1, page);
  const validLimit = Math.min(100, Math.max(1, limit));
  const skip = (validPage - 1) * validLimit;

  let statusFilter: any = {};
  const now = new Date();

  if (filter === "active") {
    statusFilter = {
      status: "COMPLETED",
      expiresAt: { gt: now },
    };
  } else if (filter === "expired") {
    statusFilter = {
      OR: [
        { status: { in: ["CANCELLED", "EXPIRED", "REHABILITATED"] } },
        { status: "COMPLETED", expiresAt: { lte: now } },
      ],
    };
  }

  try {
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: {
          userId: user.id,
          ...statusFilter,
        },
        include: {
          accountStock: true,
          accountProfile: true,
          exclusiveStock: true,
          exclusiveAccount: true,
          streamingAccount: {
            include: {
              streamingType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: validLimit,
      }),
      db.order.count({
        where: {
          userId: user.id,
          ...statusFilter,
        },
      }),
    ]);

    const decryptedOrders = orders.map((order) => {
      const isExpired =
        order.status !== "COMPLETED" || new Date(order.expiresAt) <= now;

      // Si está vencido, no devolver credenciales
      if (isExpired) {
        return {
          ...order,
          accountEmail: undefined,
          accountPassword: undefined,
          profileName: undefined,
          profilePin: undefined,
        };
      }

      // Leer credenciales de la ORDEN (fotografía congelada al momento de compra)
      const decrypted = decryptOrderCredentials(order);
      return {
        ...order,
        accountEmail: decrypted.accountEmail,
        accountPassword: decrypted.accountPassword,
        profileName: decrypted.profileName,
        profilePin: decrypted.profilePin,
      };
    });

    const totalPages = Math.ceil(total / validLimit);

    return NextResponse.json({
      orders: decryptedOrders,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages,
        hasNext: validPage < totalPages,
        hasPrev: validPage > 1,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error al obtener pedidos");
    return NextResponse.json(
      { error: "Error al obtener los pedidos" },
      { status: 500 },
    );
  }
});
