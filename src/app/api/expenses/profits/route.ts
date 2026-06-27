import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    // Obtener la fecha actual o utilizar los parámetros proporcionados
    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    // Establecer rango de fechas para el mes especificado
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Obtenga recargas de crédito para el mes especificado
    const creditRecharges = await db.creditRecharge.findMany({
      where: {
        status: "COMPLETED",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    const totalCreditsRecharged = creditRecharges.reduce(
      (sum, recharge) => sum + recharge.amount,
      0,
    );
    const uniqueUsers = new Set(creditRecharges.map((r) => r.userId)).size;
    const averageRecharge =
      creditRecharges.length > 0
        ? totalCreditsRecharged / creditRecharges.length
        : 0;

    // Obtener gastos mensuales totales
    const monthlyExpenses = await db.expense.findMany({
      where: {
        isActive: true,
        frequency: "MENSUAL",
      },
    });

    const annualExpenses = await db.expense.findMany({
      where: {
        isActive: true,
        frequency: "ANUAL",
      },
    });

    // Obtener gastos únicos del mes especificado
    const uniqueExpenses = await db.expense.findMany({
      where: {
        isActive: true,
        frequency: "UNICO",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // Calcular los gastos mensuales totales
    const totalMonthlyExpenses = monthlyExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const totalAnnualMonthly = annualExpenses.reduce(
      (sum, expense) => sum + expense.amount / 12,
      0,
    );
    const totalUniqueExpenses = uniqueExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

    const totalExpenses =
      totalMonthlyExpenses + totalAnnualMonthly + totalUniqueExpenses;

    // Calcular ganancias (créditos recargados - gastos)
    const profits = totalCreditsRecharged - totalExpenses;
    const profitMargin =
      totalCreditsRecharged > 0 ? (profits / totalCreditsRecharged) * 100 : 0;

    // Preparar detalles para el almacenamiento.
    const details = {
      creditRecharges: creditRecharges.map((r) => ({
        id: r.id,
        amount: r.amount,
        method: r.method,
        userId: r.userId,
        userEmail: r.user.email,
        userName: r.user.name,
        createdAt: r.createdAt,
      })),
      expenses: {
        monthly: monthlyExpenses.map((e) => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          category: e.category,
        })),
        annual: annualExpenses.map((e) => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          category: e.category,
        })),
        unique: uniqueExpenses.map((e) => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          category: e.category,
        })),
      },
    };

    return NextResponse.json({
      year,
      month,
      revenue: totalCreditsRecharged,
      expenses: totalExpenses,
      profits: profits,
      profitMargin: profitMargin,
      totalRecharges: creditRecharges.length,
      uniqueUsers: uniqueUsers,
      averageRecharge: averageRecharge,
      breakdown: {
        monthlyExpenses: totalMonthlyExpenses,
        annualExpensesMonthly: totalAnnualMonthly,
        uniqueExpenses: totalUniqueExpenses,
      },
      dateRange: {
        start: monthStart,
        end: monthEnd,
      },
      details: details,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al calcular las ganancias");
    return NextResponse.json(
      { error: "Error interno sel servidor" },
      { status: 500 },
    );
  }
});
