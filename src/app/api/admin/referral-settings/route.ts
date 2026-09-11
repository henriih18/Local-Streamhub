import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";

//obtener configuración actual + stats básicas
export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    // Solo admin puede ver la configuración
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acceso solo para administradores" },
        { status: 403 },
      );
    }

    // Obtener o crear configuración por defecto
    let settings = await db.referralSetting.findFirst();
    if (!settings) {
      settings = await db.referralSetting.create({
        data: {
          isEnabled: true,
          rewardPercent: 10,
        },
      });
    }

    // Stats básicas para mostrar en el modal
    const [totalRewarded, totalCreditsEarned, pendingCount] = await Promise.all(
      [
        db.referral.count({ where: { status: "REWARDED" } }),
        db.referral.aggregate({
          where: { status: "REWARDED" },
          _sum: { creditsEarned: true },
        }),
        db.referral.count({ where: { status: "PENDING" } }),
      ],
    );

    return NextResponse.json({
      settings: {
        id: settings.id,
        isEnabled: settings.isEnabled,
        rewardPercent: settings.rewardPercent,
        updatedAt: settings.updatedAt,
      },
      stats: {
        totalRewarded,
        totalCreditsEarned: totalCreditsEarned._sum.creditsEarned || 0,
        pendingCount,
      },
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Error al cargar la configuración de referidos",
    );
    return NextResponse.json(
      { error: "Error al cargar la configuración" },
      { status: 500 },
    );
  }
});

// POST: actualizar configuración
export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    // Rate limit (mismo patrón que credit-recharge)
    const limitCheck = await rateLimit({
      identifier: `admin:${user.id}:${request.url}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento." },
        { status: 429 },
      );
    }

    const referralSettingsSchema = z.object({
      isEnabled: z.boolean(),
      rewardPercent: z.coerce
        .number()
        .min(0, "El porcentaje no puede ser negativo")
        .max(100, "El porcentaje no puede exceder 100"),
    });

    const body = await request.json();
    const validation = referralSettingsSchema.safeParse(body);

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

    const { isEnabled, rewardPercent } = validation.data;

    // Obtener o crear el registro de configuración (siempre solo 1)
    let settings = await db.referralSetting.findFirst();
    if (!settings) {
      settings = await db.referralSetting.create({
        data: { isEnabled, rewardPercent },
      });
    } else {
      settings = await db.referralSetting.update({
        where: { id: settings.id },
        data: { isEnabled, rewardPercent },
      });
    }

    logger.info(
      {
        context: "referral_settings_updated",
        adminId: user.id,
        isEnabled,
        rewardPercent,
        security: true,
      },
      "Configuración de referidos actualizada",
    );

    return NextResponse.json({
      message: "Configuración actualizada exitosamente",
      settings: {
        id: settings.id,
        isEnabled: settings.isEnabled,
        rewardPercent: settings.rewardPercent,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Error al actualizar la configuración de referidos",
    );
    return NextResponse.json(
      { error: "Error al actualizar la configuración" },
      { status: 500 },
    );
  }
});

export function PUT() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "GET, POST" } },
  );
}

export function DELETE() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "GET, POST" } },
  );
}

export function PATCH() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "GET, POST" } },
  );
}
