import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const supportContacts = await db.supportContact.findMany({
      orderBy: {
        order: "asc",
      },
    });

    return NextResponse.json(supportContacts);
  } catch (error) {
    logger.error({ err: error }, "Error al obtener los contactos de soporte");
    return NextResponse.json(
      { error: "Error al obtener los contactos de soporte" },
      { status: 500 },
    );
  }
});
