import crypto from "crypto";
import { logger } from "./logger";

const TELEGRAM_API_URL =
  process.env.TELEGRAM_API_URL || "http://telegram-bot-api:8081";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

interface SendMessageParams {
  chat_id: string | number;
  text: string;
  parse_mode?: "Markdown" | "HTML";
  reply_markup?: any;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: { parse_mode?: "Markdown" | "HTML"; reply_markup?: any },
): Promise<boolean> {
  try {
    if (!BOT_TOKEN) {
      logger.warn("[Telegram] TELEGRAM_BOT_TOKEN no está definido");
      return false;
    }

    const params: SendMessageParams = {
      chat_id: chatId,
      text,
      ...options,
    };

    const res = await fetch(`${TELEGRAM_API_URL}/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error(
        {
          status: res?.status,
          body: errBody,
          context: "telegram_send_message",
        },
        "[Telegram] Error enviando mensaje",
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: error }, "[Telegram] Error de conexión");
    return false;
  }
}

export function generateTempToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
