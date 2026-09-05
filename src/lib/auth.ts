import { NextRequest } from "next/server";
import { jwtVerify, errors } from "jose";
import { db } from "@/lib/db";
import { logger } from "./logger";
import { sendTelegramMessage } from "./telegram";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("CRITICAL: JWT_SECRET no está definido");
  }

  return new TextEncoder().encode(secret);
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    role: string;
  } | null;
  error?: string;
}

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export const auth = async (request: NextRequest): Promise<AuthResult> => {
  try {
    // Cookie
    const token =
      request.cookies.get("authToken")?.value ||
      request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return { user: null };

    const JWT_SECRET = getJwtSecret();

    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      maxTokenAge: "24h",
    });

    const userId = payload.userId as string;

    if (!userId) {
      return { user: null, error: "Token inválido" };
    }

    // DB
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isBlocked: true,
        tokenVersion: true,
        vendorTrialEndsAt: true,
        vendorTrialQuota: true,
        telegramChatId: true,
      },
    });

    if (!user) return { user: null, error: "Usuario no existe" };
    if (!user.isActive) return { user: null, error: "Cuenta inactiva" };
    if (user.isBlocked) return { user: null, error: "Cuenta bloqueada" };

    // === Chequeo de trial de vendedor ===
    if (
      user.role === "VENDEDOR" &&
      user.vendorTrialEndsAt &&
      user.vendorTrialQuota
    ) {
      const now = new Date();
      if (now > user.vendorTrialEndsAt) {
        const totalVentas = await db.order.count({
          where: {
            userId: user.id,
            status: "COMPLETED",
            createdAt: { lte: user.vendorTrialEndsAt },
          },
        });

        if (totalVentas < user.vendorTrialQuota) {
          await db.user.update({
            where: { id: user.id },
            data: {
              role: "USER",
              vendorTrialEndsAt: null,
              vendorTrialQuota: null,
            },
          });
          await notifyVendorTrialResult({
            userId: user.id,
            telegramChatId: user.telegramChatId,
            totalVentas,
            trialQuota: user.vendorTrialQuota,
            aprobo: false,
          }).catch((notifyErr) => {
            logger.error(
              { err: notifyErr, context: "vendor_trial_failed_notify" },
              "No se pudo notificar la expiracion del trial (no aprobo)",
            );
          });
          return {
            user: {
              id: user.id,
              email: user.email,
              role: "USER",
            },
            error: `Tu período de prueba finalizó. Vendiste ${totalVentas} de ${user.vendorTrialQuota} cuentas requeridas.`,
          };
        } else {
          await db.user.update({
            where: { id: user.id },
            data: {
              vendorTrialEndsAt: null,
              vendorTrialQuota: null,
            },
          });
          await notifyVendorTrialResult({
            userId: user.id,
            telegramChatId: user.telegramChatId,
            totalVentas,
            trialQuota: user.vendorTrialQuota,
            aprobo: true,
          }).catch((notifyErr) => {
            logger.error(
              { err: notifyErr, context: "vendor_trial_passed_notify" },
              "No se pudo notificar la superacion del trial (aprobo)",
            );
          });
        }
      }
    }

    if ((payload as any).tokenVersion !== user.tokenVersion) {
      return { user: null, error: "Sesión revocada" };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return { user: null, error: "Token expirado" };
    }

    logger.error({ err: error }, "Error de autenticacion");
    return { user: null, error: "Credenciales inválidas" };
  }
};

export function requireAuth(
  handler: (
    req: NextRequest,
    user: AuthUser,
    context: { params: any },
  ) => Promise<Response>,
) {
  return async (req: NextRequest, context: { params: any }) => {
    const { user, error } = await auth(req);

    if (!user) {
      return new Response(JSON.stringify({ error: error ?? "No autorizado" }), {
        status: 401,
      });
    }

    //reenviamos context (donde vive params)
    return handler(req, user, context);
  };
}

export function requireAdmin(
  handler: (
    req: NextRequest,
    user: AuthUser,
    context: { params: any },
  ) => Promise<Response>,
) {
  return requireAuth(
    async (req: NextRequest, user: AuthUser, context: { params: any }) => {
      if (user.role !== "ADMIN") {
        return new Response(
          JSON.stringify({ error: "Acceso solo para administradores" }),
          { status: 403 },
        );
      }

      //reenviamos context
      return handler(req, user, context);
    },
  );
}

export function optionalAuth(
  handler: (
    req: NextRequest,
    user: AuthUser | null,
    context: { params: any },
  ) => Promise<Response>,
) {
  return async (req: NextRequest, context: { params: any }) => {
    const { user } = await auth(req);
    // Permitir acceso con o sin usuario
    return handler(req, user, context);
  };
}

// ============================================================
//  Notificacion cuando vence el periodo de prueba de vendedores
// ============================================================

async function notifyVendorTrialResult(params: {
  userId: string;
  telegramChatId: string | null;
  totalVentas: number;
  trialQuota: number;
  aprobo: boolean;
}): Promise<void> {
  const { userId, telegramChatId, totalVentas, trialQuota, aprobo } = params;

  // --- 1. Mensaje in-app (tabla Message) ---

  const title = aprobo
    ? "¡Felicidades! Ahora eres Vendedor permanente"
    : "Tu período de prueba como Vendedor ha finalizado";

  const content = aprobo
    ? `¡Felicitaciones! Has superado tu período de prueba como Vendedor.\n\n` +
      `• Cuentas vendidas: ${totalVentas}\n\n` +
      `Tu rol de Vendedor es ahora permanente. ¡Sigue con el buen trabajo!`
    : `Tu período de prueba como Vendedor ha finalizado.\n\n` +
      `• Cuentas vendidas: ${totalVentas}\n\n` +
      `Como no se alcanzó la cuota mínima, tu cuenta ha vuelto al rol de Usuario.\n\n` +
      `Si deseas volver a ser Vendedor, contacta a soporte para una nueva evaluación.`;

  try {
    const adminUser = await db.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (adminUser) {
      await db.message.create({
        data: {
          senderId: adminUser.id,
          receiverId: userId,
          title,
          content,
          type: "SYSTEM_NOTIFICATION",
          isRead: false,
        },
      });
    }
  } catch (err) {
    logger.error(
      { err, context: "vendor_trial_result_inapp" },
      "No se pudo crear el mensaje in-app del resultado del trial",
    );
  }

  // --- 2. Mensaje por Telegram (si tiene chatId vinculado) ---
  if (!telegramChatId) {
    logger.info(
      {
        context: "vendor_trial_result",
        userId,
        aprobo,
        reason: "no_telegram_chat_id",
      },
      "Usuario sin telegramChatId; solo se notifico in-app",
    );
    return;
  }

  const tgText = aprobo
    ? `🏆 *¡Felicitaciones! Has superado tu período de prueba*\n\n` +
      `• Cuentas vendidas: *${totalVentas}*\n\n` +
      `Tu rol de *Vendedor* es ahora permanente. ¡Sigue con el buen trabajo! 🎉`
    : `⏰ *Tu período de prueba ha finalizado*\n\n` +
      `• Cuentas vendidas: *${totalVentas}*\n\n` +
      `Como no se alcanzó la cuota mínima, tu cuenta ha vuelto al rol de *Usuario*.\n\n` +
      `Si deseas volver a ser Vendedor, contacta a soporte para una nueva evaluación.`;

  const sent = await sendTelegramMessage(telegramChatId, tgText, {
    parse_mode: "Markdown",
  });

  logger.info(
    {
      context: "vendor_trial_result",
      userId,
      aprobo,
      sent,
      totalVentas,
      trialQuota,
    },
    aprobo
      ? "Trial superado: notificacion de VENDEDOR permanente enviada"
      : "Trial NO superado: notificacion de degradacion a USER enviada",
  );
}
