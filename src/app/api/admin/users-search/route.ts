import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseSafeEnum, parseSafeInt, parseSafeSearch } from "@/lib/parse-safe";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parámetros de paginación y filtros
    const page = parseSafeInt(searchParams.get("page"), 1, 1, 10000);
    const limit = parseSafeInt(searchParams.get("limit"), 10, 1, 100);
    const role = parseSafeEnum(
      searchParams.get("role"),
      ["ALL", "USER", "ADMIN", "VENDEDOR"],
      "ALL",
    );
    const search = parseSafeSearch(searchParams.get("search"));
    const paginated = searchParams.get("paginated") === "true";
    const status = parseSafeEnum(
      searchParams.get("status"),
      ["ALL", "ACTIVE", "BLOCKED"],
      "ALL",
    );

    // Construir filtro WHERE
    const where: any = {};
    if (role !== "ALL") {
      where.role = role;
    }
    if (status === "ACTIVE") {
      where.isBlocked = false;
    } else if (status === "BLOCKED") {
      where.isBlocked = true;
    }
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      where.OR = [
        { email: { contains: searchLower } },
        { fullName: { contains: searchLower } },
      ];
    }

    // Si es paginado: traer solo la página solicitada
    // Si NO es paginado: traer todos (para stats globales, topUsers, etc.)
    const skip = paginated ? (page - 1) * limit : undefined;
    const take = paginated ? limit : undefined;

    // Obtener usuarios
    const usersWithActionCounts = await db.user.findMany({
      where: paginated ? where : {},
      select: {
        id: true,
        email: true,
        fullName: true,
        credits: true,
        totalSpent: true,
        role: true,
        createdAt: true,
        isActive: true,
        isBlocked: true,
        blockExpiresAt: true,
        blockReason: true,
        telegramChatId: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    // Calcular actionCounts solo para los usuarios de esta consulta
    const actionCounts: Record<string, number> = {};

    const [totalOrders, totalRenewals, totalRecharges] = await Promise.all([
      db.order.groupBy({
        by: ["userId"],
        _count: true,
      }),
      db.order.groupBy({
        by: ["userId"],
        where: {
          renewalCount: {
            gt: 0,
          },
        },
        _count: true,
        _sum: {
          renewalCount: true,
        },
      }),
      db.creditRecharge.groupBy({
        by: ["userId"],
        _count: true,
      }),
    ]);

    usersWithActionCounts.forEach((user) => {
      const orderCount =
        totalOrders.find((o) => o.userId === user.id)?._count || 0;
      const renewalData = totalRenewals.find((r) => r.userId === user.id);
      const renewalCount = renewalData?._sum?.renewalCount || 0;
      const rechargeCount =
        totalRecharges.find((r) => r.userId === user.id)?._count || 0;

      actionCounts[user.id] = orderCount + renewalCount + rechargeCount;
    });

    // Si es paginado, devolver también total y totalPages
    if (paginated) {
      const totalUsers = await db.user.count({ where });
      const totalPages = Math.ceil(totalUsers / limit);

      return NextResponse.json({
        success: true,
        paginated: true,
        data: {
          users: usersWithActionCounts,
          actionCounts,
          pagination: {
            page,
            limit,
            totalUsers,
            totalPages,
          },
        },
      });
    }

    // Si NO es paginado, mantener la respuesta original
    return NextResponse.json({
      success: true,
      paginated: false,
      data: {
        users: usersWithActionCounts,
        actionCounts,
      },
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Error al obtener los usuarios con recuentos de acciones",
    );
    return NextResponse.json(
      { error: "Error al obtener los usuarios con recuentos de acciones" },
      { status: 500 },
    );
  }
});
