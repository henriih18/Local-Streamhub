import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { userCache } from "@/lib/cache";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const cacheKey = "admin:stats:complete";

    // Si se solicita refresh forzado, eliminar el caché
    if (forceRefresh) {
      userCache.delete(cacheKey);
    }

    let cachedStats = userCache.get(cacheKey) as any;

    if (cachedStats && !forceRefresh) {
      return NextResponse.json(cachedStats);
    }

    const now = new Date();

    // === Consultas optimizadas ===
    // En lugar de traer TODAS las filas a RAM, usamos agregaciones SQL
    // pero MANTENIENDO los mismos números que el código anterior.

    const [
      totalUsers,
      totalOrders,
      creditsAggregate,
      // Usuarios con al menos 1 orden (cualquier estado, igual que antes)
      usersWithOrders,
      // Órdenes con su streamingAccount (para salesByType y topProducts)
      ordersWithAccount,
      // Últimas 5 órdenes para actividad reciente
      recentOrders,
    ] = await Promise.all([
      // 1. Total usuarios (SELECT COUNT) — antes: allUsers.length
      db.user.count(),

      // 2. Total órdenes (SELECT COUNT) — antes: allOrders.length
      db.order.count(),

      // 3. Suma total de créditos (SELECT SUM) — antes: reduce en JS
      db.user.aggregate({
        _sum: { credits: true },
      }),

      // 4. Usuarios activos = usuarios con al menos 1 orden
      //    ANTES: allUsers.filter(u => allOrders.some(o => o.user.email === u.email))
      //    Usamos groupBy en Order para obtener distinct userIds
      //    NO filtramos por status (igual que el original)
      db.order.groupBy({
        by: ["userId"],
        _count: { userId: true },
      }),

      // 5. Órdenes con streamingAccount para salesByType y topProducts
      //    Traemos solo los campos necesarios (no email, no id, no createdAt)
      //    Incluimos órdenes SIN streamingAccount (null) para mantener "OTHER"
      db.order.findMany({
        select: {
          totalPrice: true,
          streamingAccount: {
            select: { name: true, type: true },
          },
        },
      }),

      // 6. Últimas 5 órdenes (solo 5, no todas) para actividad reciente
      db.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          streamingAccount: { select: { name: true } },
        },
      }),
    ]);

    // === Ventas por tipo (procesado en memoria, igual que antes) ===
    const salesByTypeMap = new Map<
      string,
      { count: number; revenue: number }
    >();

    ordersWithAccount.forEach((order: any) => {
      const type = order.streamingAccount?.type || "OTHER"; // ← igual que antes
      const current = salesByTypeMap.get(type) || { count: 0, revenue: 0 };
      salesByTypeMap.set(type, {
        count: current.count + 1,
        revenue: current.revenue + order.totalPrice,
      });
    });

    const salesByType = Array.from(salesByTypeMap.entries()).map(
      ([type, data]) => ({
        type,
        count: data.count,
        revenue: data.revenue,
      }),
    );

    // === Top productos (procesado en memoria, igual que antes) ===
    const productMap = new Map<
      string,
      { name: string; type: string; sales: number; revenue: number }
    >();

    ordersWithAccount.forEach((order: any) => {
      const name = order.streamingAccount?.name || "Unknown"; // ← igual que antes
      const type = order.streamingAccount?.type || "Unknown"; // ← igual que antes
      const current = productMap.get(name) || {
        name,
        type,
        sales: 0,
        revenue: 0,
      };
      productMap.set(name, {
        ...current,
        sales: current.sales + 1,
        revenue: current.revenue + order.totalPrice,
      });
    });

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    // === Actividad reciente (solo 5 órdenes) ===
    const recentActivity: Array<{
      type: string;
      description: string;
      time: string;
      icon: string;
    }> = recentOrders.map((order: any) => {
      const orderDate = new Date(order.createdAt);
      const diffMs = now.getTime() - orderDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let timeString = "";
      if (diffMins < 1) timeString = "Justo ahora";
      else if (diffMins < 60) timeString = `Hace ${diffMins} min`;
      else if (diffHours < 24) timeString = `Hace ${diffHours} h`;
      else timeString = `Hace ${diffDays} días`;

      return {
        type: "order",
        description: `Nuevo pedido: ${order.streamingAccount?.name || "Producto"}`,
        time: timeString,
        icon: "ShoppingCart",
      };
    });

    // === Métricas finales (mismos números que antes) ===
    const totalCredits = creditsAggregate._sum.credits || 0;
    // activeUsers = cantidad de usuarios con al menos 1 orden (igual que antes)
    const activeUsers = usersWithOrders.length;
    const conversionRate =
      totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    const stats = {
      totalUsers,
      totalOrders,
      salesByType,
      recentActivity,
      topProducts,
      conversionRate,
      activeUsers,
      totalCredits,
    };

    // Cache por 5 minutos
    userCache.set(cacheKey, stats, 5 * 60 * 1000);

    return NextResponse.json(stats);
  } catch (error) {
    logger.error({ err: error }, "Error al obtener estadísticas");
    return NextResponse.json(
      { error: "Error al obtener estadísticas" },
      { status: 500 },
    );
  }
});
