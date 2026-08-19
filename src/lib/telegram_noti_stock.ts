import { logger } from "./logger";

const API = process.env.TELEGRAM_API_URL || "http://telegram-bot-api:8081";
const TOKEN = process.env.TELEGRAM_SUPPORT_BOT_TOKEN || "";
const GROUP_ID = process.env.TELEGRAM_SUPPORT_GROUP_ID || "";

async function botApi(method: string, body: unknown) {
  return fetch(`${API}/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface StockNotificationData {
  accountName: string;
  accountType: string; // Netflix, Disney+, etc.
  saleType: "FULL" | "PROFILES";
  //quantity: number;
  isExclusive: boolean;
  duration?: string; // "1 mes", "3 meses"...
  quality?: string; // "4K", "HD"
}

// Escapa Markdown (mismo patrón que checkout/route.ts)
function escapeMd(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function sendStockNotificationToSupportGroup(
  data: StockNotificationData,
): Promise<boolean> {
  if (!TOKEN || !GROUP_ID) {
    logger.warn(
      "[TelegramSupport] TELEGRAM_SUPPORT_BOT_TOKEN o TELEGRAM_SUPPORT_GROUP_ID no definidos",
    );
    return false;
  }

  const kind = data.isExclusive ? "Exclusiva" : "Regular";
  //const unit = data.saleType === "PROFILES" ? "perfiles" : "cuentas completas";

  const text =
    `📦 *Nuevo stock disponible*\n\n` +
    `🎬 *Cuenta:* ${escapeMd(data.accountName)}\n` +
    `🏷️ *Tipo:* ${escapeMd(data.accountType)}\n` +
    `⏱️ *Duración:* ${escapeMd(data.duration || "—")}\n` +
    `📺 *Calidad:* ${escapeMd(data.quality || "—")}\n` +
    `🔐 *Venta:* ${data.saleType === "PROFILES" ? "Por perfiles" : "Cuenta completa"}\n` +
    /* `📊 *Cantidad:* ${data.quantity} ${unit}\n` + */
    `💎 *Clase:* ${kind}\n\n` +
    `¡Entra a la tienda y pide la tuya antes de que se agoten!`;

  try {
    // CLAVE: NO incluir message_thread_id → cae al General
    const res = await botApi("sendMessage", {
      chat_id: GROUP_ID,
      text,
      parse_mode: "Markdown",
    });

    if (!res.ok) {
      logger.error(
        {
          status: res.status,
          body: await res.text(),
          context: "support_group_send",
        },
        "[TelegramSupport] Error enviando a General",
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "[TelegramSupport] Error de conexión");
    return false;
  }
}
