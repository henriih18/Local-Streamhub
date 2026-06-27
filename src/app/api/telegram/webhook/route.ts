import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { logger } from "@/lib/logger";

// Verificar que el webhook viene de Telegram
function verifyWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("[SECURITY] TELEGRAM_WEBHOOK_SECRET no configurado");
      return false; //  BLOQUEAR en producción
    }
    return true; // Permitir solo en desarrollo
  }

  const telegramSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  return telegramSecret === secret;
}

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticidad del webhook
    if (!verifyWebhookSecret(req)) {
      logger.warn(
        { headers: Object.fromEntries(req.headers.entries()) },
        "[SECURITY] Webhook sin token válido",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!body.message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(body.message.chat.id);
    const msgText: string | undefined = body.message.text;
    const contact = body.message.contact;

    // ── CASO 1: El usuario compartió su contacto ──
    if (contact) {
      const phone = contact.phone_number;

      const linkToken = await db.telegramLinkToken.findFirst({
        where: {
          chatId: chatId,
          state: { in: ["PENDING", "WAITING_PHONE"] },
          expiresAt: { gt: new Date() },
        },
      });

      if (!linkToken) {
        logger.warn(
          { chatId, phone, action: "link_no_token" },
          "[Telegram] Sin token activo para vincular teléfono",
        );
        await sendTelegramMessage(
          chatId,
          "⚠️ No encontré una solicitud de vinculación activa. Vuelve a iniciar el proceso desde la página de registro.",
        );
        return NextResponse.json({ ok: true });
      }

      await db.telegramLinkToken.update({
        where: { id: linkToken.id },
        data: {
          phone: phone,
          state: `LINKED_${chatId}_${phone}`,
          chatId: chatId,
        },
      });

      logger.info(
        {
          chatId: chatId,
          phone: phone,
          action: "link_phone",
          context: "telegram",
        },
        "[Telegram] Teléfono vinculado",
      );

      await sendTelegramMessage(
        chatId,
        `✅ *Número verificado exitosamente*\n\n📱 Teléfono: ${phone}\n\nTu número ha sido verificado. Ya puedes volver a la página de registro para continuar.`,
        { parse_mode: "Markdown" },
      );

      return NextResponse.json({ ok: true });
    }

    // ── CASO 2: /start con token ──
    if (msgText?.startsWith("/start ")) {
      const tempToken = msgText.split(" ")[1];

      if (!tempToken) {
        await sendTelegramMessage(
          chatId,
          "👋 Bienvenido al bot de RiyoStream.\n\nEste bot se utiliza para verificar tu número de teléfono durante el registro. Si intentas registrarte, usa el enlace que te aparece en la página.",
        );
        return NextResponse.json({ ok: true });
      }

      const linkToken = await db.telegramLinkToken.findUnique({
        where: { tempToken },
      });

      if (!linkToken) {
        logger.warn(
          { chatId, action: "invalid_token" },
          "[Telegram] /start con token inválido",
        );
        await sendTelegramMessage(
          chatId,
          "❌ Enlace inválido o expirado.\n\nPor favor, vuelve a generar un nuevo enlace desde la página de registro.",
        );
        return NextResponse.json({ ok: true });
      }

      if (linkToken.expiresAt < new Date()) {
        logger.warn(
          { chatId, action: "expired_token" },
          "[Telegram] Token expirado",
        );
        await db.telegramLinkToken.delete({ where: { id: linkToken.id } });
        await sendTelegramMessage(
          chatId,
          "⏰ Este enlace ha expirado.\n\nPor favor, genera uno nuevo desde la página de registro.",
        );
        return NextResponse.json({ ok: true });
      }

      if (linkToken.state !== "PENDING") {
        logger.warn(
          { chatId, state: linkToken.state, action: "already_used_token" },
          "[Telegram] Token ya utilizado",
        );
        await sendTelegramMessage(
          chatId,
          "⚠️ Este enlace ya fue utilizado o está en proceso.\n\nSi no completaste la verificación, genera un nuevo enlace.",
        );
        return NextResponse.json({ ok: true });
      }

      await db.telegramLinkToken.update({
        where: { id: linkToken.id },
        data: {
          state: "WAITING_PHONE",
          chatId: chatId,
        },
      });

      // Enviar teclado de contacto nativo de Telegram
      const TELEGRAM_API_URL =
        process.env.TELEGRAM_API_URL || "https://api.telegram.org";
      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

      await fetch(`${TELEGRAM_API_URL}/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🔐 *Verificación de número telefónico*\n\nPara completar tu registro en RiyoStream necesitamos verificar tu número de teléfono.\n\nHaz clic en el botón de abajo para compartir tu número:",
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [
                {
                  text: "📱 Compartir mi número de teléfono",
                  request_contact: true,
                },
              ],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ── CASO 3: /start sin argumentos ──
    if (msgText === "/start") {
      await sendTelegramMessage(
        chatId,
        "👋 Bienvenido al bot de RiyoStream.\n\nEste bot se utiliza para verificar tu número de teléfono durante el registro. Si intentas registrarte, usa el enlace que te aparece en la página.",
      );
      return NextResponse.json({ ok: true });
    }

    // ── CASO 4: /unlink ──
    if (msgText === "/unlink") {
      const user = await db.user.findUnique({
        where: { telegramChatId: chatId },
      });

      if (!user) {
        logger.warn(
          { chatId, action: "unlink_no_user" },
          "[Telegram] /unlink sin cuenta vinculada",
        );
        await sendTelegramMessage(
          chatId,
          "❌ No tienes una cuenta vinculada a este chat de Telegram.",
        );
        return NextResponse.json({ ok: true });
      }

      await db.user.update({
        where: { id: user.id },
        data: { telegramChatId: null },
      });

      logger.info(
        {
          chatId,
          userId: user.id,
          action: "unlink_account",
          context: "telegram",
        },
        "[Telegram] Cuenta desvinculada",
      );

      await sendTelegramMessage(
        chatId,
        "✅ Tu cuenta ha sido desvinculada de Telegram correctamente.",
      );
      return NextResponse.json({ ok: true });
    }

    // ── CASO 5: Mensaje desconocido → ignorar silenciosamente ──
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "[Error de webhook de Telegram]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
