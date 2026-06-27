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

      if (!userId) {
        return NextResponse.json(
          { error: "ID de usuario requerido" },
          { status: 400 },
        );
      }

      const blocks = await db.userBlock.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(blocks);
    } catch (error) {
      logger.error({ err: error }, "Error al obtener bloqueos");
      return NextResponse.json(
        { error: "Error al obtener bloqueos" },
        { status: 500 },
      );
    }
  },
);
