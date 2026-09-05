// src/app/api/expenses/profits/_compute.ts
//
// Lógica de cálculo de ganancias + persistencia en MonthlyProfit.
// Vive en un archivo separado (con prefijo "_") porque Next.js App Router
// solo permite exportar GET/POST/PUT/DELETE/etc. desde los archivos route.ts.
// El prefijo "_" hace que la carpeta sea tratada como código privado y NO
// se exponga como ruta HTTP.

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface ProfitDetails {
  breakdown: {
    monthlyExpenses: number;
    annualExpensesMonthly: number;
    uniqueExpenses: number;
  };
  creditRecharges: Array<{
    id: string;
    amount: number;
    method: string;
    userId: string;
    userEmail: string;
    userName: string | null;
    createdAt: Date;
  }>;
  expenses: {
    monthly: Array<{ id: string; name: string; amount: number; category: string }>;
    annual: Array<{ id: string; name: string; amount: number; category: string }>;
    unique: Array<{ id: string; name: string; amount: number; category: string }>;
  };
}

export interface ProfitResult {
  year: number;
  month: number;
  revenue: number;
  expenses: number;
  profits: number;
  profitMargin: number;
  totalRecharges: number;
  uniqueUsers: number;
  averageRecharge: number;
  breakdown: {
    monthlyExpenses: number;
    annualExpensesMonthly: number;
    uniqueExpenses: number;
  };
  dateRange: { start: Date; end: Date };
  details: ProfitDetails;
  isClosed: boolean;
}

// Calcula las ganancias de un mes. Si el mes está cerrado, devuelve el
// snapshot congelado de MonthlyProfit. Si está abierto, calcula en vivo
// y hace upsert en MonthlyProfit (para que el historial se vaya guardando).
export async function computeAndPersistProfits(
  year: number,
  month: number,
): Promise<ProfitResult> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // --- ¿Ya está cerrado este mes? ---
  const existing = await db.monthlyProfit.findUnique({
    where: { year_month: { year, month } },
  });

  if (existing?.isClosed) {
    // Devolver el snapshot congelado (no recalcular)
    const details: any = existing.details || {
      breakdown: {
        monthlyExpenses: 0,
        annualExpensesMonthly: 0,
        uniqueExpenses: 0,
      },
      creditRecharges: [],
      expenses: { monthly: [], annual: [], unique: [] },
    };
    return {
      year: existing.year,
      month: existing.month,
      revenue: existing.revenue,
      expenses: existing.expenses,
      profits: existing.profits,
      profitMargin: existing.profitMargin,
      totalRecharges: existing.totalRecharges,
      uniqueUsers: existing.uniqueUsers,
      averageRecharge: existing.averageRecharge,
      breakdown: details.breakdown || {
        monthlyExpenses: 0,
        annualExpensesMonthly: 0,
        uniqueExpenses: 0,
      },
      dateRange: { start: monthStart, end: monthEnd },
      details,
      isClosed: true,
    };
  }

  // --- Calcular en vivo ---
  const creditRecharges = await db.creditRecharge.findMany({
    where: {
      status: "COMPLETED",
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  const totalCreditsRecharged = creditRecharges.reduce(
    (sum, r) => sum + r.amount,
    0,
  );
  const uniqueUsers = new Set(creditRecharges.map((r) => r.userId)).size;
  const averageRecharge =
    creditRecharges.length > 0
      ? totalCreditsRecharged / creditRecharges.length
      : 0;

  const monthlyExpenses = await db.expense.findMany({
    where: { isActive: true, frequency: "MENSUAL" },
  });
  const annualExpenses = await db.expense.findMany({
    where: { isActive: true, frequency: "ANUAL" },
  });
  const uniqueExpenses = await db.expense.findMany({
    where: {
      isActive: true,
      frequency: "UNICO",
      dueDate: { gte: monthStart, lte: monthEnd },
    },
  });

  const totalMonthlyExpenses = monthlyExpenses.reduce(
    (sum, e) => sum + e.amount,
    0,
  );
  const totalAnnualMonthly = annualExpenses.reduce(
    (sum, e) => sum + e.amount / 12,
    0,
  );
  const totalUniqueExpenses = uniqueExpenses.reduce(
    (sum, e) => sum + e.amount,
    0,
  );
  const totalExpenses =
    totalMonthlyExpenses + totalAnnualMonthly + totalUniqueExpenses;

  const profits = totalCreditsRecharged - totalExpenses;
  const profitMargin =
    totalCreditsRecharged > 0 ? (profits / totalCreditsRecharged) * 100 : 0;

  const details: ProfitDetails = {
    breakdown: {
      monthlyExpenses: totalMonthlyExpenses,
      annualExpensesMonthly: totalAnnualMonthly,
      uniqueExpenses: totalUniqueExpenses,
    },
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

  // --- Guardar/actualizar en MonthlyProfit (solo si no está cerrado) ---
  try {
    await db.monthlyProfit.upsert({
      where: { year_month: { year, month } },
      create: {
        year,
        month,
        revenue: totalCreditsRecharged,
        expenses: totalExpenses,
        profits,
        profitMargin,
        totalRecharges: creditRecharges.length,
        uniqueUsers,
        averageRecharge,
        details: details as any,
        isClosed: false,
      },
      update: {
        revenue: totalCreditsRecharged,
        expenses: totalExpenses,
        profits,
        profitMargin,
        totalRecharges: creditRecharges.length,
        uniqueUsers,
        averageRecharge,
        details: details as any,
      },
    });
  } catch (err) {
    // Si falla el upsert, no rompemos el cálculo: lo logueamos y seguimos.
    logger.error({ err }, "No se pudo guardar el snapshot en MonthlyProfit");
  }

  return {
    year,
    month,
    revenue: totalCreditsRecharged,
    expenses: totalExpenses,
    profits,
    profitMargin,
    totalRecharges: creditRecharges.length,
    uniqueUsers,
    averageRecharge,
    breakdown: {
      monthlyExpenses: totalMonthlyExpenses,
      annualExpensesMonthly: totalAnnualMonthly,
      uniqueExpenses: totalUniqueExpenses,
    },
    dateRange: { start: monthStart, end: monthEnd },
    details,
    isClosed: false,
  };
}