import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { userCache } from "@/lib/cache";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const cacheKey = "admin:stats:complete";
    let cachedStats = userCache.get(cacheKey) as any;

    if (cachedStats) {
      return NextResponse.json(cachedStats);
    }

    const now = new Date();

    // Obtener datos base
    const [allOrders, allUsers, allAccounts] = await Promise.all([
      db.order.findMany({
        select: {
          id: true,
          totalPrice: true,
          createdAt: true,
          user: {
            select: {
              email: true,
            },
          },
          streamingAccount: {
            select: {
              name: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.user.findMany({
        select: {
          id: true,
          email: true,
          fullName: true,
          credits: true,
          totalSpent: true,
          role: true,
          createdAt: true,
        },
      }),
      db.streamingAccount.findMany({
        select: {
          id: true,
          name: true,
          type: true,
        },
      }),
    ]);

    // Estadísticas básicas
    const totalRevenue = allOrders.reduce(
      (sum: number, order: any) => sum + order.totalPrice,
      0,
    );
    const totalUsers = allUsers.length;
    const totalOrders = allOrders.length;

    // Ventas por tipo
    const salesByTypeMap = new Map<
      string,
      { count: number; revenue: number }
    >();
    allOrders.forEach((order: any) => {
      const type = order.streamingAccount?.type || "OTHER";
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

    // Revenue por mes (últimos 6 meses)
    const revenueByMonth: Array<{
      month: string;
      revenue: number;
      orders: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleDateString("es-ES", {
        month: "short",
        year: "numeric",
      });
      const monthOrders = allOrders.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        return (
          orderDate.getMonth() === month.getMonth() &&
          orderDate.getFullYear() === month.getFullYear()
        );
      });
      revenueByMonth.push({
        month: monthName,
        revenue: monthOrders.reduce((sum, order) => sum + order.totalPrice, 0),
        orders: monthOrders.length,
      });
    }

    // Productos destacados (top 5)
    const productMap = new Map<
      string,
      { name: string; type: string; sales: number; revenue: number }
    >();
    allOrders.forEach((order: any) => {
      const key = order.streamingAccount?.name || "Unknown";
      const current = productMap.get(key) || {
        name: key,
        type: order.streamingAccount?.type || "Unknown",
        sales: 0,
        revenue: 0,
      };
      productMap.set(key, {
        ...current,
        sales: current.sales + 1,
        revenue: current.revenue + order.totalPrice,
      });
    });
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    // Crecimiento de usuarios (últimos 6 meses)
    const userGrowth: Array<{
      month: string;
      users: number;
      newUsers: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleDateString("es-ES", {
        month: "short",
        year: "numeric",
      });
      const monthUsers = allUsers.filter((user: any) => {
        const userDate = new Date(user.createdAt);
        return (
          userDate.getMonth() === month.getMonth() &&
          userDate.getFullYear() === month.getFullYear()
        );
      });
      const totalUsersUntilMonth = allUsers.filter(
        (user: any) =>
          new Date(user.createdAt) <=
          new Date(now.getFullYear(), now.getMonth() - i + 1, 0),
      ).length;
      userGrowth.push({
        month: monthName,
        users: totalUsersUntilMonth,
        newUsers: monthUsers.length,
      });
    }

    // Actividad reciente (últimos 5 pedidos)
    const recentActivity: Array<{
      type: string;
      description: string;
      time: string;
      icon: string;
    }> = [];
    const recentOrders = allOrders.slice(0, 5);
    recentOrders.forEach((order: any) => {
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

      recentActivity.push({
        type: "order",
        description: `Nuevo pedido: ${order.streamingAccount?.name || "Producto"}`,
        time: timeString,
        icon: "ShoppingCart",
      });
    });

    // Métricas adicionales
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const activeUsers = allUsers.filter((user: any) =>
      allOrders.some((order: any) => order.user.email === user.email),
    ).length;
    const totalCredits = allUsers.reduce((sum, user) => sum + user.credits, 0);
    const conversionRate =
      totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    // Top 5 usuarios por gasto
    const topUsers = allUsers
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
      .map((u) => ({
        ...u,
        name: u.fullName,
        _count: { orders: 0 },
        isBlocked: false,
        blockReason: null,
        blockExpiresAt: null,
        isActive: true,
      }));

    const stats = {
      totalUsers,
      totalOrders,
      totalRevenue,
      topUsers,
      revenueByMonth,
      salesByType,
      recentActivity,
      topProducts,
      userGrowth,
      averageOrderValue,
      conversionRate,
      activeUsers,
      totalCredits,
    };

    // Cache por 5 minutos
    userCache.set(cacheKey, stats, 5 * 60 * 1000);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas" },
      { status: 500 },
    );
  }
});
