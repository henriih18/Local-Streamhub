import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { requireUUID } from "@/lib/validate-uuid";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { userId: string } },
  ) => {
    try {
      const userId = params.userId;

      const uuidCheck = requireUUID(params.userId);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      // Contar advertencias y bloques de 24h para este usuario.
      const warningsCount = await db.userWarning.count({
        where: { userId },
      });

      const blocks24hCount = await db.userBlock.count({
        where: {
          userId,
          blockType: "temporary",
          duration: "24",
        },
      });

      const totalCount = warningsCount + blocks24hCount;

      return NextResponse.json({
        count: totalCount,
        warnings: warningsCount,
        blocks24h: blocks24hCount,
      });
    } catch (error) {
      logger.error(
        { err: error },
        "Error al obtener el recuento de acciones del usuario",
      );
      return NextResponse.json(
        { error: "Error al obtener el recuento de acciones del usuario" },
        { status: 500 },
      );
    }
  },
);
