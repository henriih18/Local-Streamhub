import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import crypto from "crypto";
export const GET = requireAuth(async (request, user) => {
  try {
    const fullUser = await db.user.findUnique({
      where: { id: user.id },

      select: { referralCode: true, fullName: true },
    });

    // Si por algún motivo no tiene código, generar uno al vuelo
    if (!fullUser?.referralCode) {
      const cleanName = (fullUser?.fullName || "USER")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 4);
      // 6 caracteres aleatorios hex
      const random = crypto.randomBytes(3).toString("hex").toUpperCase();
      const newCode = `${cleanName}${random}`;

      // Asegurar que sea único
      let attempts = 0;
      let finalCode = newCode;
      while (
        (await db.user.findUnique({ where: { referralCode: finalCode } })) &&
        attempts < 10
      ) {
        const newRandom = Math.floor(100 + Math.random() * 900);
        //finalCode = `${cleanUsername}${newRandom}`;
        finalCode = `${cleanName}${newRandom}`;
        attempts++;
      }

      await db.user.update({
        where: { id: user.id },
        data: { referralCode: finalCode },
      });

      // Consultar estado del sistema para incluirlo en la respuesta
      const settings = await db.referralSetting.findFirst();

      return NextResponse.json({
        success: true,
        referralCode: finalCode,
        systemEnabled: settings?.isEnabled ?? true,
        rewardPercent: settings?.rewardPercent ?? 10,
        referrals: [],
        stats: { total: 0, completed: 0, creditsEarned: 0 },
      });
    }

    // Obtener referidos, estadísticas y estado del sistema
    const [totalCount, completedCount, creditsSum, systemSettings] =
      await Promise.all([
        db.referral.count({
          where: { referrerId: user.id },
        }),
        db.referral.count({
          where: { referrerId: user.id, status: "REWARDED" },
        }),
        db.referral.aggregate({
          where: { referrerId: user.id, status: "REWARDED" },
          _sum: { creditsEarned: true },
        }),
        db.referralSetting.findFirst(),
      ]);

    return NextResponse.json({
      success: true,
      referralCode: fullUser.referralCode,
      // Estado del sistema de referidos (para atenuar la UI si está desactivado)
      systemEnabled: systemSettings?.isEnabled ?? true,
      rewardPercent: systemSettings?.rewardPercent ?? 10,
      // NO devolvemos referrals[], solo stats
      stats: {
        total: totalCount,
        completed: completedCount,
        creditsEarned: creditsSum._sum.creditsEarned || 0,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error al obtener datos de referidos");
    return NextResponse.json(
      { error: "Error al obtener referidos" },
      { status: 500 },
    );
  }
});
