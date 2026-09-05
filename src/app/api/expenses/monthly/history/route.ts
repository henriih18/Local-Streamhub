import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "12");
    const year = searchParams.get("year");

    let whereClause = {};
    if (year) {
      whereClause = { year: parseInt(year) };
    }

    const monthlyHistory = await db.monthlyProfit.findMany({
      where: whereClause,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: limit,
    });

    const totalRevenue = monthlyHistory.reduce((sum, r) => sum + r.revenue, 0);
    const totalExpenses = monthlyHistory.reduce(
      (sum, r) => sum + r.expenses,
      0,
    );
    const totalProfits = monthlyHistory.reduce((sum, r) => sum + r.profits, 0);
    const averageProfitMargin =
      totalRevenue > 0 ? (totalProfits / totalRevenue) * 100 : 0;

    // Resumen por año (uniqueUsers = promedio mensual, no suma, para no inflar)
    const yearlySummary = monthlyHistory.reduce(
      (acc, record) => {
        const y = record.year;
        if (!acc[y]) {
          acc[y] = {
            year: y,
            totalRevenue: 0,
            totalExpenses: 0,
            totalProfits: 0,
            totalRecharges: 0,
            sumUniqueUsers: 0,
            monthCount: 0,
            months: [] as any[],
          };
        }
        acc[y].totalRevenue += record.revenue;
        acc[y].totalExpenses += record.expenses;
        acc[y].totalProfits += record.profits;
        acc[y].totalRecharges += record.totalRecharges;
        acc[y].sumUniqueUsers += record.uniqueUsers;
        acc[y].monthCount += 1;
        acc[y].months.push(record);
        return acc;
      },
      {} as Record<number, any>,
    );

    const yearlySummaryArr = Object.values(yearlySummary)
      .map((s: any) => ({
        year: s.year,
        totalRevenue: s.totalRevenue,
        totalExpenses: s.totalExpenses,
        totalProfits: s.totalProfits,
        totalRecharges: s.totalRecharges,
        uniqueUsers: Math.round(s.sumUniqueUsers / s.monthCount), // promedio
        averageMonthlyProfit: s.totalProfits / s.monthCount,
        averageProfitMargin:
          s.totalRevenue > 0 ? (s.totalProfits / s.totalRevenue) * 100 : 0,
        months: s.months,
      }))
      .sort((a: any, b: any) => b.year - a.year);

    const availableYears = await db.monthlyProfit.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });

    return NextResponse.json({
      history: monthlyHistory,
      summary: {
        totalRevenue,
        totalExpenses,
        totalProfits,
        averageProfitMargin,
        totalMonths: monthlyHistory.length,
      },
      yearlySummary: yearlySummaryArr,
      availableYears: availableYears.map((y) => y.year),
      currentMonth: {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error al obtener el historial mensual");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});
