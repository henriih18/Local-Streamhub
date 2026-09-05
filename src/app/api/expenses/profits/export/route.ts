import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { rateLimit, getClientIdentifier } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";
import { computeAndPersistProfits } from "../_compute";

// Escapa un valor para CSV siguiendo RFC 4180.
function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const GET = requireAdmin(
  async (request: NextRequest, _user, _context) => {
    try {
      // Rate limiting: 20 exportaciones por minuto
      const limitCheck = await rateLimit({
        identifier: getClientIdentifier(request),
        limit: 20,
        windowMs: 60 * 1000,
      });
      if (!limitCheck.success) {
        return NextResponse.json(
          { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
          { status: 429 },
        );
      }

      const { searchParams } = new URL(request.url);
      const yearParam = searchParams.get("year");
      const monthParam = searchParams.get("month");

      const now = new Date();
      const year = yearParam ? parseInt(yearParam) : now.getFullYear();
      const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

      const data = await computeAndPersistProfits(year, month);

      // ---------- Sección 1: Resumen ----------
      const resumen: (string | number)[][] = [
        ["Concepto", "Valor"],
        ["Año", data.year],
        ["Mes", data.month],
        ["Ingresos", data.revenue.toFixed(2)],
        ["Gastos mensuales", data.breakdown.monthlyExpenses.toFixed(2)],
        [
          "Gastos anuales (mensualizados)",
          data.breakdown.annualExpensesMonthly.toFixed(2),
        ],
        ["Gastos únicos del mes", data.breakdown.uniqueExpenses.toFixed(2)],
        ["Gastos totales", data.expenses.toFixed(2)],
        ["Ganancias", data.profits.toFixed(2)],
        ["Margen %", data.profitMargin.toFixed(2)],
        ["Total recargas", data.totalRecharges],
        ["Usuarios únicos", data.uniqueUsers],
        ["Promedio recarga", data.averageRecharge.toFixed(2)],
        ["Fecha inicio", (data.dateRange.start as Date).toISOString()],
        ["Fecha fin", (data.dateRange.end as Date).toISOString()],
        ["Estado", data.isClosed ? "Cerrado" : "En curso"],
      ];

      // ---------- Sección 2: Detalle de recargas ----------
      const recargas: (string | number)[][] = [
        [
          "ID",
          "Usuario (email)",
          "Nombre",
          "Monto",
          "Método",
          "Estado",
          "Fecha",
        ],
        ...data.details.creditRecharges.map((r) => [
          r.id,
          r.userEmail,
          r.userName || "",
          r.amount.toFixed(2),
          r.method,
          "COMPLETED",
          new Date(r.createdAt).toISOString(),
        ]),
      ];

      // ---------- Sección 3: Detalle de gastos ----------
      const gastos: (string | number)[][] = [
        ["ID", "Nombre", "Monto", "Categoría", "Frecuencia"],
        ...data.details.expenses.monthly.map((e) => [
          e.id,
          e.name,
          Number(e.amount).toFixed(2),
          e.category,
          "MENSUAL",
        ]),
        ...data.details.expenses.annual.map((e) => [
          e.id,
          e.name,
          Number(e.amount).toFixed(2),
          e.category,
          "ANUAL",
        ]),
        ...data.details.expenses.unique.map((e) => [
          e.id,
          e.name,
          Number(e.amount).toFixed(2),
          e.category,
          "UNICO",
        ]),
      ];

      const sections = [
        { title: "RESUMEN DEL MES", rows: resumen },
        { title: "DETALLE DE RECARGAS", rows: recargas },
        { title: "DETALLE DE GASTOS", rows: gastos },
      ];

      const csv = sections
        .map((section) => {
          const lines = section.rows.map((row) => row.map(csvField).join(","));
          return [`# ${section.title}`, ...lines].join("\n");
        })
        .join("\n\n");

      const fileName = `ganancias-${year}-${String(month).padStart(2, "0")}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "Error al exportar ganancias a CSV");
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 },
      );
    }
  },
);
