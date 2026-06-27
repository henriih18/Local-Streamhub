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

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    await request.json();

    const identifier = `${user.id}-checkout`;
    const limitCheck = await rateLimit({
      identifier,
      limit: 10,
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
            "X-RateLimit-Limit": "10",
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

        // ================= STREAMING =================
        if (streamingAccount) {
          // ---------- PROFILES ----------
          if (saleType === "PROFILES") {
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

          // ---------- FULL ACCOUNTS ----------
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

        // ================= EXCLUSIVE =================
        else if (exclusiveAccount) {
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
                  expiresAt: calculateExpirationDate(exclusiveAccount.duration),
                },
              }),
            );
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

    const io = getIO();
    if (io) {
      for (const item of cart.items) {
        const { streamingAccount, exclusiveAccount, quantity, saleType } = item;

        if (streamingAccount) {
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

          if (order.streamingAccountId) {
            const sa = await db.streamingAccount.findUnique({
              where: { id: order.streamingAccountId },
              select: { name: true },
            });
            if (sa) serviceName = sa.name;
          } else if (order.exclusiveAccountId) {
            const ea = await db.exclusiveAccount.findUnique({
              where: { id: order.exclusiveAccountId },
              select: { name: true },
            });
            if (ea) serviceName = ea.name;
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

          if (isExclusive) {
            // ══════ MENSAJE PREMIUM PARA CUENTAS EXCLUSIVAS ══════
            message = `👑✨ *¡COMPRA EXCLUSIVA EXITOSA!* ✨👑\n\n`;
            message += `💎 *${escapeMarkdown(serviceName)}*\n`;
            message += `🌟 *Cuenta Exclusiva* — ${accountType}\n`;
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
            // ══════ MENSAJE NORMAL PARA CUENTAS REGULARES ══════
            message = `🎉 *¡Compra exitosa!*\n\n`;
            message += `📺 *${escapeMarkdown(serviceName)}*\n`;
            message += `📦 Tipo: ${accountType}\n`;
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
