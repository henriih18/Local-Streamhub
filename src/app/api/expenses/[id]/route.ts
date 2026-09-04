import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { requireId } from "@/lib/validate-id";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const PUT = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { id: string } },
  ) => {
    try {
      const id = params.id;

      const idCheck = requireId(params.id);
      if (!idCheck.valid) {
        return NextResponse.json({ error: idCheck.error }, { status: 400 });
      }

      const updateExpenseSchema = z
        .object({
          name: z.string().trim().min(1).max(100).optional(),
          description: z.string().trim().max(500).optional().optional(),
          amount: z.coerce.number().positive().optional(),
          category: z.string().trim().min(1).max(50).optional(),
          frequency: z.enum(["MENSUAL", "ANUAL", "UNICO"]).optional(),
          dueDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .nullable(),
          isActive: z.boolean().optional(),
        })
        .refine(
          (data) => {
            // Si es único, la fecha de vencimiento NO puede estar vacía ni ser null
            if (
              data.frequency === "UNICO" &&
              (!data.dueDate || data.dueDate.trim() === "")
            ) {
              return false;
            }
            return true;
          },
          {
            message:
              "La fecha de vencimiento es obligatoria para gastos únicos",
            path: ["dueDate"],
          },
        );

      const body = await request.json();
      const validation = updateExpenseSchema.safeParse(body);

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

      const {
        name,
        description,
        amount,
        category,
        frequency,
        dueDate,
        isActive,
      } = validation.data;

      const sanitizedName = name ? sanitizeInput(name) : undefined;
      const sanitizedDescription =
        description !== undefined ? sanitizeInput(description) : undefined;
      const sanitizedCategory = category ? sanitizeInput(category) : undefined;

      const expense = await db.expense.update({
        where: { id },
        data: {
          ...(sanitizedName && { name: sanitizedName }),
          ...(sanitizedDescription !== undefined && {
            description: sanitizedDescription,
          }),
          ...(sanitizedCategory && { category: sanitizedCategory }),
          ...(amount !== undefined && { amount }),
          ...(frequency && { frequency }),
          ...(dueDate !== undefined && {
            dueDate: dueDate ? new Date(dueDate) : null,
          }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      return NextResponse.json(expense);
    } catch (error) {
      logger.error({ err: error }, "Error al actualizar el gasto:", error);
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 },
      );
    }
  },
);

export const DELETE = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { id: string } },
  ) => {
    try {
      const id = params.id;

      const idCheck = requireId(params.id);
      if (!idCheck.valid) {
        return NextResponse.json({ error: idCheck.error }, { status: 400 });
      }

      // Eliminación temporal estableciendo isActive como falso
      const expense = await db.expense.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, "Error al eliminar gasto");
      return NextResponse.json(
        { error: "Error Interno del Servidor" },
        { status: 500 },
      );
    }
  },
);
