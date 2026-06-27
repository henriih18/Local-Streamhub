import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const expenses = await db.expense.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calcular los gastos mensuales totales
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

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

    const uniqueExpenses = await db.expense.findMany({
      where: {
        isActive: true,
        frequency: "UNICO",
        createdAt: {
          gte: currentMonth,
        },
      },
    });

    // Calcular totales
    const totalMonthly = monthlyExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const totalAnnualMonthly = annualExpenses.reduce(
      (sum, expense) => sum + expense.amount / 12,
      0,
    );
    const totalUnique = uniqueExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

    const totalMonthlyExpenses =
      totalMonthly + totalAnnualMonthly + totalUnique;

    return NextResponse.json({
      expenses,
      totals: {
        monthly: totalMonthlyExpenses,
        annual: annualExpenses.reduce(
          (sum, expense) => sum + expense.amount,
          0,
        ),
        unique: uniqueExpenses.reduce(
          (sum, expense) => sum + expense.amount,
          0,
        ),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error al obtener los gastos");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});

export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const expenseSchema = z.object({
      name: z
        .string()
        .min(1, "El nombre es requerido")
        .max(100, "Nombre demasiado largo"),
      description: z
        .string()
        .max(500, "Descripción demasiado larga")
        .optional()
        .nullable(),
      amount: z.coerce
        .number()
        .positive("El monto debe ser positivo")
        .max(10000000, "Monto máximo 10,000,000"),
      category: z
        .string()
        .min(1, "La categoría es requerida")
        .max(50, "Categoría inválida"),
      frequency: z.enum(["MENSUAL", "ANUAL", "UNICO"]).default("MENSUAL"),
      dueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
        .optional()
        .nullable(),
    });

    const body = await request.json();
    const validation = expenseSchema.safeParse(body);

    if (!validation.success) {
      const allErrors = validation.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }));
      return NextResponse.json(
        { error: "Datos inválidos", details: allErrors },
        { status: 400 },
      );
    }

    const { name, description, amount, category, frequency, dueDate } =
      validation.data;
    const sanitizedName = sanitizeInput(name);
    const sanitizedDescription = description
      ? sanitizeInput(description)
      : null;
    const sanitizedCategory = sanitizeInput(category);

    const expense = await db.expense.create({
      data: {
        name: sanitizedName,
        description: sanitizedDescription,
        amount,
        category: sanitizedCategory,
        frequency: frequency || "MENSUAL",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    logger.error({ err: error }, "Error al crear gasto");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});
