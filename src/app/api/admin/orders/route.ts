import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  decryptInventoryCredentials,
  decryptOrderCredentials,
} from "@/lib/order-helper";
import { parseSafeEnum, parseSafeInt } from "@/lib/parse-safe";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseSafeInt(searchParams.get("page"), 1, 1, 10000);
    const limit = parseSafeInt(searchParams.get("limit"), 10, 1, 100);
    const renewal = parseSafeEnum(
      searchParams.get("renewal"),
      ["all", "renewed", "not_renewed"],
      "all",
    );
    const paginated = searchParams.get("paginated") === "true";

    // Construir filtro WHERE
    const where: any = {};

    if (renewal === "renewed") {
      where.renewalCount = { gt: 0 };
    } else if (renewal === "not_renewed") {
      where.renewalCount = 0;
    }

    const skip = paginated ? (page - 1) * limit : undefined;
    const take = paginated ? limit : undefined;

    const orders = await db.order.findMany({
      where: paginated ? where : {},
      include: {
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
        streamingAccount: {
          select: {
            id: true,
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
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take,
    });

    const decryptedOrders = orders.map((order) => {
      const decrypted = decryptOrderCredentials(order);
      return {
        ...order,
        user: {
          ...order.user,
          name: order.user.fullName,
        },
        accountEmail: decrypted.accountEmail,
        accountPassword: decrypted.accountPassword,
        profileName: decrypted.profileName,
        profilePin: decrypted.profilePin,
      };
    });

    // Si es paginado, devolver total y totalPages
    if (paginated) {
      const totalOrders = await db.order.count({ where });
      const totalPages = Math.ceil(totalOrders / limit);

      return NextResponse.json({
        success: true,
        paginated: true,
        data: {
          orders: decryptedOrders,
          pagination: {
            page,
            limit,
            totalOrders,
            totalPages,
          },
        },
      });
    }

    // Si NO es paginado, mantener la respuesta original
    return NextResponse.json(decryptedOrders);
  } catch (error) {
    logger.error({ err: error }, "Error al recuperar los pedidos");
    return NextResponse.json(
      { error: "Error al recuperar los pedidos" },
      { status: 500 },
    );
  }
});
