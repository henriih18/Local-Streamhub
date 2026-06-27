import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const PUT = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { id: string } },
  ) => {
    try {
      const accountId = params.id;

      // Verificar si la cuenta existe
      const account = await db.streamingAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        return NextResponse.json(
          { error: "Cuenta no encontrada" },
          { status: 404 },
        );
      }

      // Cambiar el estado de la cuenta
      const updatedAccount = await db.streamingAccount.update({
        where: { id: accountId },
        data: {
          isActive: !account.isActive,
        },
      });

      // Invalidar caché cuando el estado de la cuenta está alternado
      userCache.delete("admin:streaming-accounts:list");

      return NextResponse.json({
        ...updatedAccount,
        message: `Cuenta ${
          updatedAccount.isActive ? "activada" : "desactivada"
        } exitosamente`,
      });
    } catch (error) {
      logger.error({ err: error }, "Error al alternar el estado de la cuenta");
      return NextResponse.json(
        { error: "Error al cambiar estado de la cuenta" },
        { status: 500 },
      );
    }
  },
);

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
export function POST() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
export function DELETE() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
