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

export function escapeMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "••••";
  return phone.length > 4 ? `••••${phone.slice(-4)}` : "••••";
}


// ============================================================
//  Bot de Recargas (TELEGRAM_RECHARGE_BOT_TOKEN)
// ============================================================

const RECHARGE_BOT_TOKEN = process.env.TELEGRAM_RECHARGE_BOT_TOKEN || "";

/**
 * Enviar mensaje al chat privado de un usuario por el bot de recargas.
 * El usuario debe haber iniciado /start con el bot de recargas antes.
 */
export async function sendViaRechargeBot(
  chatId: string | number,
  text: string,
  options?: { parse_mode?: "Markdown" | "HTML"; reply_markup?: any },
): Promise<boolean> {
  try {
    if (!RECHARGE_BOT_TOKEN) {
      logger.warn("[Telegram] TELEGRAM_RECHARGE_BOT_TOKEN no está definido");
      return false;
    }

    const params: SendMessageParams = {
      chat_id: chatId,
      text,
      ...options,
    };

    const res = await fetch(
      `${TELEGRAM_API_URL}/bot${RECHARGE_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      logger.error(
        {
          status: res?.status,
          body: errBody,
          context: "recharge_bot_send_message",
        },
        "[Telegram Recharge Bot] Error enviando mensaje",
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      { err: error },
      "[Telegram Recharge Bot] Error de conexión",
    );
    return false;
  }
}

/**
 * Enviar mensaje a un thread (hilo) específico del grupo de recargas.
 * Útil para que el agente del grupo vea confirmaciones.
 */
export async function sendToRechargeGroupThread(
  groupId: string,
  threadId: number,
  text: string,
  options?: { parse_mode?: "Markdown" | "HTML" },
): Promise<boolean> {
  try {
    if (!RECHARGE_BOT_TOKEN) {
      logger.warn("[Telegram] TELEGRAM_RECHARGE_BOT_TOKEN no está definido");
      return false;
    }

    const params: SendMessageParams & { message_thread_id: number } = {
      chat_id: groupId,
      message_thread_id: threadId,
      text,
      ...options,
    };

    const res = await fetch(
      `${TELEGRAM_API_URL}/bot${RECHARGE_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      logger.error(
        {
          status: res?.status,
          body: errBody,
          context: "recharge_bot_group_thread",
        },
        "[Telegram Recharge Bot] Error enviando al thread del grupo",
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      { err: error },
      "[Telegram Recharge Bot] Error de conexión al grupo",
    );
    return false;
  }
}