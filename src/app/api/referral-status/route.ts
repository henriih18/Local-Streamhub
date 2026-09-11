import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// GET: estado público del sistema de referidos (solo isEnabled)
// Es seguro exponer esto porque no es info sensible (no incluye porcentaje ni stats)
export async function GET() {
  try {
    const settings = await db.referralSetting.findFirst();
    // Default: true y 10% si no existe el registro (compatibilidad con DBs sin migrar)
    return NextResponse.json({
      isEnabled: settings?.isEnabled ?? true,
      rewardPercent: settings?.rewardPercent ?? 10,
    });
  } catch (error) {
    logger.error(
      { err: error, context: "referral_status_public" },
      "Error al obtener estado público del sistema de referidos",
    );
    // Default seguro: true y 10% si falla (para no bloquear el registro)
    return NextResponse.json({ isEnabled: true, rewardPercent: 10 });
  }
}

// Handlers 405 (siguiendo el patrón del proyecto)
export function POST() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "GET" } },
  );
}

export function PUT() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "GET" } },
  );
}

export function DELETE() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "GET" } },
  );
}

export function PATCH() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "GET" } },
  );
}
