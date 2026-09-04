import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { decryptOrderCredentials } from "@/lib/order-helper";
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
    const search = searchParams.get("search")?.trim() || "";

    // Construir filtro WHERE
    const where: any = {};

    if (renewal === "renewed") {
      where.renewalCount = { gt: 0 };
    } else if (renewal === "not_renewed") {
      where.renewalCount = 0;
    }

    // Búsqueda por ID de compra (no encriptado en la BD)
    if (search) {
      where.id = { contains: search.toLowerCase() };
    }

    const skip = (page - 1) * limit;

    const [orders, totalOrders] = await Promise.all([
      db.order.findMany({
        where,
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
        take: limit,
      }),
      db.order.count({ where }),
    ]);

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
  } catch (error) {
    logger.error({ err: error }, "Error al recuperar los pedidos");
    return NextResponse.json(
      { error: "Error al recuperar los pedidos" },
      { status: 500 },
    );
  }
});
