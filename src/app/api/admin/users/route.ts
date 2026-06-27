import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseSafeInt } from "@/lib/parse-safe";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);

    const topBuyers = parseSafeInt(searchParams.get("topBuyers"), 0, 1, 100);
    const topVendors = parseSafeInt(searchParams.get("topVendors"), 0, 1, 100);

    // Si no se piden tops, retornar array vacío o error
    if (topBuyers === 0 && topVendors === 0) {
      return NextResponse.json({ topBuyers: [], topVendors: [] });
    }

    const [topBuyersList, topVendorsList] = await Promise.all([
      topBuyers > 0
        ? db.user.findMany({
            where: { role: "USER" },
            select: {
              id: true,
              email: true,
              fullName: true,
              totalSpent: true,
              _count: { select: { orders: true } },
            },
            orderBy: { orders: { _count: "desc" } },
            take: topBuyers,
          })
        : [],
      topVendors > 0
        ? db.user.findMany({
            where: { role: "VENDEDOR" },
            select: {
              id: true,
              email: true,
              fullName: true,
              totalSpent: true,
              _count: { select: { orders: true } },
            },
            orderBy: { orders: { _count: "desc" } },
            take: topVendors,
          })
        : [],
    ]);

    return NextResponse.json({
      topBuyers: topBuyersList.map((u) => ({
        ...u,
        name: u.fullName,
        orderCount: u._count.orders,
      })),
      topVendors: topVendorsList.map((u) => ({
        ...u,
        name: u.fullName,
        orderCount: u._count.orders,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Error al recuperar top usuarios");
    return NextResponse.json(
      { error: "Error al recuperar usuarios" },
      { status: 500 },
    );
  }
});