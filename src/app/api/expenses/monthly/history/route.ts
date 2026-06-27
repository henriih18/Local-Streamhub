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

    // Obtener historial de ganancias mensual
    const monthlyHistory = await db.monthlyProfit.findMany({
      where: whereClause,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: limit,
    });

    // Calcular totales y estadísticas
    const totalRevenue = monthlyHistory.reduce(
      (sum, record) => sum + record.revenue,
      0,
    );
    const totalExpenses = monthlyHistory.reduce(
      (sum, record) => sum + record.expenses,
      0,
    );
    const totalProfits = monthlyHistory.reduce(
      (sum, record) => sum + record.profits,
      0,
    );
    const averageProfitMargin =
      monthlyHistory.length > 0
        ? monthlyHistory.reduce((sum, record) => sum + record.profitMargin, 0) /
          monthlyHistory.length
        : 0;

    // Agrupar por año para resúmenes anuales
    const yearlySummary = monthlyHistory.reduce(
      (acc, record) => {
        const year = record.year;
        if (!acc[year]) {
          acc[year] = {
            year,
            totalRevenue: 0,
            totalExpenses: 0,
            totalProfits: 0,
            totalRecharges: 0,
            uniqueUsers: new Set(),
            months: [],
          };
        }

        acc[year].totalRevenue += record.revenue;
        acc[year].totalExpenses += record.expenses;
        acc[year].totalProfits += record.profits;
        acc[year].totalRecharges += record.totalRecharges;
        acc[year].months.push(record);

        return acc;
      },
      {} as Record<string, any>,
    );

    // Convertir conjuntos en recuentos y calcular promedios
    Object.values(yearlySummary).forEach((summary: any) => {
      summary.uniqueUsers = summary.months.reduce(
        (sum: number, month: any) => sum + month.uniqueUsers,
        0,
      );
      summary.averageMonthlyProfit =
        summary.totalProfits / summary.months.length;
      summary.averageProfitMargin =
        summary.months.reduce(
          (sum: number, month: any) => sum + month.profitMargin,
          0,
        ) / summary.months.length;
    });

    // Obtener los años disponibles para filtrar
    const availableYears = await db.monthlyProfit.findMany({
      select: {
        year: true,
      },
      distinct: ["year"],
      orderBy: {
        year: "desc",
      },
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
      yearlySummary: Object.values(yearlySummary).sort(
        (a: any, b: any) => b.year - a.year,
      ),
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
