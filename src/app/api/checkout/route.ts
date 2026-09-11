import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SaleType } from "@prisma/client";
import { calculateExpirationDate } from "@/lib/date-utils";
import { getIO } from "@/lib/socket";
import { requireAuth } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limiter";
import { sendTelegramMessage } from "@/lib/telegram";
import { logger } from "@/lib/logger";

// Función para escapar caracteres especiales de Markdown
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

// Error personalizado para conflictos de stock
class StockConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockConflictError";
  }
}

// Procesar recompensa de referido al completar primera compra
async function processReferralReward(
  userId: string,
  orderId: string,
  orderTotal: number,
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    if (!user?.referredById) return;

    const referral = await db.referral.findUnique({
      where: { referredId: userId },
    });

    if (!referral || referral.status !== "PENDING") return;

    // Debe ser la PRIMERA compra COMPLETED del usuario
    const previousCompletedOrders = await db.order.count({
      where: {
        userId: userId,
        status: "COMPLETED",
        id: { not: orderId },
      },
    });

    if (previousCompletedOrders > 0) return;

    // Validar que el referidor siga activo
    const referrer = await db.user.findUnique({
      where: { id: user.referredById },
      select: {
        id: true,
        telegramChatId: true,
        fullName: true,
        isActive: true,
        isBlocked: true,
      },
    });

    if (!referrer || !referrer.isActive || referrer.isBlocked) {
      await db.referral.update({
        where: { id: referral.id },
        data: { status: "EXPIRED" },
      });
      return;
    }

    // Leer configuración del sistema de referidos
    const settings = await db.referralSetting.findFirst();

    // Si no hay settings o el sistema está desactivado, salir
    if (!settings || !settings.isEnabled) return;

    // Calcular recompensa con el porcentaje configurado
    const rewardPercent = settings.rewardPercent;
    const reward = Math.round(orderTotal * (rewardPercent / 100));

    if (reward <= 0) return;

    if (reward <= 0) return;

    // Transacción atómica: actualizar referral + acreditar créditos
    await db.$transaction([
      db.referral.update({
        where: { id: referral.id },
        data: {
          status: "REWARDED",
          creditsEarned: reward,
          completedOrderId: orderId,
        },
      }),
      db.user.update({
        where: { id: referrer.id },
        data: { credits: { increment: reward } },
      }),
    ]);

    // Notificar al referidor por Telegram
    if (referrer.telegramChatId) {
      const tgText =
        `🎉 *¡Has ganado una recompensa\\!*\n\n` +
        `Tu amigo realizó su primera compra\\.\n` +
        `🎁 Has recibido *${reward} créditos*\\.\n\n` +
        `¡Sigue compartiendo tu código\\!`;

      await sendTelegramMessage(referrer.telegramChatId, tgText, {
        parse_mode: "Markdown",
      }).catch((err) =>
        logger.error({ err }, "Error al enviar Telegram de recompensa"),
      );
    }

    logger.info(
      {
        context: "referral_reward",
        referrerId: referrer.id,
        referredId: userId,
        orderId,
        reward,
      },
      "Recompensa de referido acreditada",
    );
  } catch (error) {
    logger.error(
      { err: error, context: "referral_reward" },
      "Error al procesar recompensa de referido (no bloquea checkout)",
    );
  }
}

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    await request.json();

    const identifier = `${user.id}-checkout`;
    const limitCheck = await rateLimit({
      identifier,
      limit: 4,
      windowMs: 60 * 1000,
    });

    if (!limitCheck.success) {
      return NextResponse.json(
        {
          error: "Demasiadas solicitudes. Por favor, espera un momento.",
          retryAfter: Math.ceil((limitCheck.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (limitCheck.resetTime - Date.now()) / 1000,
            ).toString(),
            "X-RateLimit-Limit": "4",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(limitCheck.resetTime).toISOString(),
          },
        },
      );
    }

    const cart = await db.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            streamingAccount: {
              include: {
                accountStocks: true,
                profileStocks: true,
              },
            },
            exclusiveAccount: {
              include: {
                exclusiveStocks: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json(
        { error: "El carrito está vacío" },
        { status: 400 },
      );
    }

    const orders = await db.$transaction(async (tx) => {
      const createdOrders: any[] = [];

      const totalAmount = cart.totalAmount;

      const userUpdate = await tx.user.updateMany({
        where: {
          id: user.id,
          isBlocked: false,
          credits: {
            gte: cart.totalAmount,
          },
        },
        data: {
          credits: {
            decrement: cart.totalAmount,
          },
        },
      });

      if (userUpdate.count === 0) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      for (const item of cart.items) {
        const {
          streamingAccount,
          exclusiveAccount,
          quantity,
          saleType,
          priceAtTime,
        } = item;

        if (quantity <= 0) {
          throw new Error("Cantidad inválida");
        }

        // STREAMING
        if (streamingAccount) {
          //ENTREGA POR SOPORTE (stock infinito)
          if (streamingAccount.deliveryMethod === "SUPPORT") {
            for (let i = 0; i < quantity; i++) {
              createdOrders.push(
                await tx.order.create({
                  data: {
                    userId: user.id,
                    streamingAccountId: streamingAccount.id,
                    quantity: 1,
                    saleType:
                      saleType === "PROFILES"
                        ? SaleType.PROFILES
                        : SaleType.FULL,
                    totalPrice: priceAtTime,
                    status: "COMPLETED",
                    expiresAt: calculateExpirationDate(
                      streamingAccount.duration,
                    ),
                  },
                }),
              );
            }
          }
          // PROFILES (entrega automática)
          else if (saleType === "PROFILES") {
            const candidates = await tx.accountProfile.findMany({
              where: {
                streamingAccountId: streamingAccount.id,
                isAvailable: true,
              },
              select: { id: true },
              take: quantity,
            });

            if (candidates.length < quantity) {
              throw new StockConflictError("perfiles");
            }

            const result = await tx.accountProfile.updateMany({
              where: {
                id: { in: candidates.map((c) => c.id) },
                isAvailable: true,
              },
              data: {
                isAvailable: false,
                soldToUserId: user.id,
                soldAt: new Date(),
              },
            });

            if (result.count < quantity) {
              throw new StockConflictError("perfiles");
            }

            const profiles = await tx.accountProfile.findMany({
              where: {
                id: { in: candidates.map((c) => c.id) },
              },
            });

            for (const p of profiles) {
              createdOrders.push(
                await tx.order.create({
                  data: {
                    userId: user.id,
                    streamingAccountId: streamingAccount.id,
                    accountProfileId: p.id,
                    accountEmail: p.email,
                    accountPassword: p.password,
                    profileName: p.profileName,
                    profilePin: p.profilePin,
                    quantity: 1,
                    saleType: SaleType.PROFILES,
                    totalPrice: priceAtTime,
                    status: "COMPLETED",
                    expiresAt: calculateExpirationDate(
                      streamingAccount.duration,
                    ),
                  },
                }),
              );
            }
          }

          // FULL ACCOUNTS
          else {
            const candidates = await tx.accountStock.findMany({
              where: {
                streamingAccountId: streamingAccount.id,
                isAvailable: true,
              },
              select: { id: true },
              take: quantity,
            });

            if (candidates.length < quantity) {
              throw new StockConflictError("cuentas");
            }

            const result = await tx.accountStock.updateMany({
              where: {
                id: { in: candidates.map((c) => c.id) },
                isAvailable: true,
              },
              data: {
                isAvailable: false,
                soldToUserId: user.id,
                soldAt: new Date(),
              },
            });

            if (result.count < quantity) {
              throw new StockConflictError("cuentas");
            }

            const accounts = await tx.accountStock.findMany({
              where: {
                id: { in: candidates.map((c) => c.id) },
              },
            });

            for (const a of accounts) {
              createdOrders.push(
                await tx.order.create({
                  data: {
                    userId: user.id,
                    streamingAccountId: streamingAccount.id,
                    accountStockId: a.id,
                    accountEmail: a.email,
                    accountPassword: a.password,
                    quantity: 1,
                    saleType: SaleType.FULL,
                    totalPrice: priceAtTime,
                    status: "COMPLETED",
                    expiresAt: calculateExpirationDate(
                      streamingAccount.duration,
                    ),
                  },
                }),
              );
            }
          }
        }

        // EXCLUSIVE
        else if (exclusiveAccount) {
          //ENTREGA POR SOPORTE (stock infinito)
          if (exclusiveAccount.deliveryMethod === "SUPPORT") {
            for (let i = 0; i < quantity; i++) {
              createdOrders.push(
                await tx.order.create({
                  data: {
                    userId: user.id,
                    exclusiveAccountId: exclusiveAccount.id,
                    // Sin asignar stock de la BD
                    // Sin credenciales
                    quantity: 1,
                    saleType:
                      exclusiveAccount.saleType === "PROFILES"
                        ? SaleType.PROFILES
                        : SaleType.FULL,
                    totalPrice: priceAtTime,
                    status: "COMPLETED",
                    expiresAt: calculateExpirationDate(
                      exclusiveAccount.duration,
                    ),
                  },
                }),
              );
            }
          } else {
            const candidates = await tx.exclusiveStock.findMany({
              where: {
                exclusiveAccountId: exclusiveAccount.id,
                isAvailable: true,
              },
              select: { id: true },
              take: quantity,
            });

            if (candidates.length < quantity) {
              throw new StockConflictError("exclusivo");
            }

            const result = await tx.exclusiveStock.updateMany({
              where: {
                id: { in: candidates.map((c) => c.id) },
                isAvailable: true,
              },
              data: {
                isAvailable: false,
                soldToUserId: user.id,
                soldAt: new Date(),
              },
            });

            if (result.count < quantity) {
              throw new StockConflictError("exclusivo");
            }

            const stocks = await tx.exclusiveStock.findMany({
              where: {
                id: { in: candidates.map((c) => c.id) },
              },
            });

            for (const s of stocks) {
              createdOrders.push(
                await tx.order.create({
                  data: {
                    userId: user.id,
                    exclusiveAccountId: exclusiveAccount.id,
                    exclusiveStockId: s.id,
                    accountEmail: s.email,
                    accountPassword: s.password,
                    quantity: 1,
                    saleType:
                      exclusiveAccount.saleType === "PROFILES"
                        ? SaleType.PROFILES
                        : SaleType.FULL,
                    totalPrice: priceAtTime,
                    status: "COMPLETED",
                    expiresAt: calculateExpirationDate(
                      exclusiveAccount.duration,
                    ),
                  },
                }),
              );
            }
          }
        }
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { totalAmount: 0 },
      });

      const updatedUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { credits: true },
      });

      return { createdOrders, newCredits: updatedUser?.credits };
    });

    // Procesar recompensa de referido si corresponde
    // Fire-and-forget (no bloquea la respuesta al usuario)
    if (orders?.createdOrders && orders.createdOrders.length > 0) {
      const totalComprado = orders.createdOrders.reduce(
        (sum: number, o: any) => sum + (o.totalPrice || 0),
        0,
      );
      const firstOrderId = orders.createdOrders[0].id;
      processReferralReward(user.id, firstOrderId, totalComprado).catch((err) =>
        logger.error({ err }, "Error en processReferralReward"),
      );
    }

    const io = getIO();
    if (io) {
      for (const item of cart.items) {
        const { streamingAccount, exclusiveAccount, quantity, saleType } = item;

        if (streamingAccount) {
          // Si la entrega es por soporte, el stock no cambia (es infinito)
          if (streamingAccount.deliveryMethod === "SUPPORT") continue;

          const currentStock =
            saleType === "PROFILES"
              ? streamingAccount.profileStocks.filter((s) => s.isAvailable)
                  .length
              : streamingAccount.accountStocks.filter((s) => s.isAvailable)
                  .length;

          io.emit("stockUpdated", {
            accountId: streamingAccount.id,
            accountType: "regular",
            type: saleType,
            newStock: Math.max(0, currentStock - quantity),
          });
        } else if (exclusiveAccount) {
          // Si la entrega es por soporte, el stock no cambia (es infinito)
          if (exclusiveAccount.deliveryMethod === "SUPPORT") continue;

          const currentStock = exclusiveAccount.exclusiveStocks.filter(
            (s) => s.isAvailable,
          ).length;

          io.emit("stockUpdated", {
            accountId: exclusiveAccount.id,
            accountType: "exclusive",
            type: exclusiveAccount.saleType,
            newStock: Math.max(0, currentStock - quantity),
          });
        }
      }
    }

    // ── Enviar credenciales por Telegram si el usuario está vinculado ──
    try {
      const telegramUser = await db.user.findUnique({
        where: { id: user.id },
        select: { telegramChatId: true },
      });

      if (telegramUser?.telegramChatId) {
        for (const order of orders.createdOrders as any[]) {
          if (order.status !== "COMPLETED") continue;

          let serviceName = "Servicio";
          let orderDeliveryMethod: string = "AUTOMATIC";

          if (order.streamingAccountId) {
            const sa = await db.streamingAccount.findUnique({
              where: { id: order.streamingAccountId },
              select: { name: true, deliveryMethod: true },
            });
            if (sa) {
              serviceName = sa.name;
              orderDeliveryMethod = sa.deliveryMethod;
            }
          } else if (order.exclusiveAccountId) {
            const ea = await db.exclusiveAccount.findUnique({
              where: { id: order.exclusiveAccountId },
              select: { name: true, deliveryMethod: true },
            });
            if (ea) {
              serviceName = ea.name;
              orderDeliveryMethod = ea.deliveryMethod;
            }
          }

          let email = "";
          let password = "";
          let profileName = "";
          let profilePin = "";

          try {
            if (order.accountEmail) email = decrypt(order.accountEmail);
            if (order.accountPassword)
              password = decrypt(order.accountPassword);
            if (order.profileName) profileName = decrypt(order.profileName);
            if (order.profilePin) profilePin = decrypt(order.profilePin);
          } catch (decryptError) {
            logger.error(
              {
                err: decryptError,
                context: "checkout",
                action: "decrypt_credentials",
              },
              "[Checkout] Error desencriptando credenciales",
            );
          }

          const accountType =
            order.saleType === "PROFILES" ? "Perfil" : "Cuenta completa";
          const expiresIn = new Date(order.expiresAt).toLocaleDateString(
            "es-CO",
          );

          // Detectar si es una cuenta exclusiva
          const isExclusive = Boolean(order.exclusiveAccountId);

          let message: string;

          // MENSAJE PARA ENTREGA POR SOPORTE
          if (orderDeliveryMethod === "SUPPORT") {
            const supportBotUsername = "riyostream_soporte_bot";
            // Deep link con el ID de la orden → el bot lo recibe automáticamente
            const supportUrl = `https://t.me/${supportBotUsername}?start=${order.id}`;

            message = `🎫 *Compra procesada*\n\n`;
            message += `🎬 *Cuenta:* ${escapeMarkdown(serviceName)}\n`;
            message += `🆔 *ID de compra:* \`${order.id}\`\n\n`;
            message += `💬 Esta cuenta se entrega de forma personalizada por nuestro equipo de soporte.\n\n`;
            message += `Toca el botón de abajo para iniciar el chat con soporte y recibir tus credenciales:`;
            message += `\n[👉 Abrir chat de soporte](${supportUrl})`;
          } else if (isExclusive) {
            //MENSAJE PREMIUM PARA CUENTAS EXCLUSIVAS
            message = `👑✨ *¡COMPRA EXCLUSIVA EXITOSA!* ✨👑\n\n`;
            message += `💎 *${escapeMarkdown(serviceName)}*\n`;
            message += `🌟 *Cuenta Exclusiva* — ${accountType}\n`;
            message += `🆔 *ID de compra:* \`${order.id}\`\n\n`;
            message += `╔══════════════════════╗\n`;
            message += `  📧 *Email:* ${escapeMarkdown(email)}\n`;
            message += `  🔑 *Contraseña:* ${escapeMarkdown(password)}\n`;

            if (order.saleType === "PROFILES") {
              if (profileName)
                message += `  👤 *Perfil:* ${escapeMarkdown(profileName)}\n`;
              if (profilePin)
                message += `  🔒 *PIN:* ${escapeMarkdown(profilePin)}\n`;
            }

            message += `╚══════════════════════╝\n`;
            message += `⏰ *Vigencia:* ${expiresIn}\n\n`;
            message += `👑 Esta es una cuenta exclusiva. Disfruta de tu acceso premium.\n\n`;
            message += `📝 Puedes ver tus credenciales en tu panel *"Mi Cuenta".*\n\n`;
            message += `⚠️ *IMPORTANTE:* No compartas estas credenciales. El uso compartido puede resultar en el bloqueo permanente de tu cuenta.`;
          } else {
            // MENSAJE NORMAL PARA CUENTAS REGULARES
            message = `🎉 *¡Compra exitosa!*\n\n`;
            message += `📺 *${escapeMarkdown(serviceName)}*\n`;
            message += `📦 Tipo: ${accountType}\n`;
            message += `🆔 *ID de compra:* \`${order.id}\`\n\n`;
            message += `─────────────────────\n`;
            message += `📧 *Email:* ${escapeMarkdown(email)}\n`;
            message += `🔑 *Contraseña:* ${escapeMarkdown(password)}\n`;

            if (order.saleType === "PROFILES") {
              if (profileName)
                message += `👤 *Perfil:* ${escapeMarkdown(profileName)}\n`;
              if (profilePin)
                message += `🔒 *PIN:* ${escapeMarkdown(profilePin)}\n`;
            }

            message += `─────────────────────\n`;
            message += `⏰ Expira: ${expiresIn}\n\n`;
            message += `📝 También puedes ver tus credenciales en tu panel "Mi Cuenta".\n\n`;
            message += `⚠️ IMPORTANTE: No compartas estas credenciales con otras personas. Si se detecta uso compartido, tu cuenta podría ser bloqueada permanentemente.`;
          }

          await sendTelegramMessage(telegramUser.telegramChatId, message, {
            parse_mode: "Markdown",
          });
        }
      }
    } catch (telegramError) {
      logger.error(
        {
          err: telegramError,
          context: "checkout",
          action: "telegram_send_credentials",
        },
        "[Checkout] Error enviando credenciales por Telegram",
      );
    }

    // Solo devolver datos mínimos, NO credenciales encriptadas
    const safeOrders = orders.createdOrders.map((order: any) => ({
      id: order.id,
      streamingAccountId: order.streamingAccountId,
      exclusiveAccountId: order.exclusiveAccountId,
      saleType: order.saleType,
      totalPrice: order.totalPrice,
      status: order.status,
      expiresAt: order.expiresAt,
    }));

    return NextResponse.json({
      success: true,
      message:
        "Pago procesado exitosamente, consulta el panel Mi Cuenta para ver los detalles",
      orders: safeOrders,
      newCredits: orders.newCredits,
    });
  } catch (error: any) {
    logger.error(
      {
        err: error,
        userId: user.id,
        context: "checkout",
      },
      "Error en checkout",
    );

    if (error instanceof StockConflictError) {
      const messages: Record<string, string> = {
        perfiles:
          "¡Ups! Otro usuario compró el último perfil mientras completabas tu compra.",
        cuentas:
          "¡Ups! Otro usuario compró la última cuenta mientras completabas tu compra.",
        exclusivo:
          "¡Ups! Esta cuenta exclusiva fue adquirida por otro usuario mientras completabas tu compra.",
      };

      return NextResponse.json(
        {
          error: messages[error.message],
          errorCode: "STOCK_CONFLICT",
        },
        { status: 409 },
      );
    }
    if (error.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        { error: "Créditos insuficientes" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Error al procesar el pago. Por favor, intenta nuevamente.",
        errorCode: "CHECKOUT_ERROR",
      },
      { status: 500 },
    );
  }
});

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
