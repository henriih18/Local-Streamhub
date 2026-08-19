import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const API = process.env.TELEGRAM_API_URL || "http://telegram-bot-api:8081";
const TOKEN = process.env.TELEGRAM_SUPPORT_BOT_TOKEN || "";
const GROUP_ID = process.env.TELEGRAM_SUPPORT_GROUP_ID || "";
const BOT_TYPE = "support";

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_SUPPORT_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

async function botApi(method: string, body: unknown) {
  return fetch(`${API}/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendToUser(chatId: string, text: string) {
  await botApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  });
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // ── CALLBACK: botón "Iniciar Soporte" ──
  if (body.callback_query) {
    const cbChatId = String(body.callback_query.message.chat.id);
    const cbData = body.callback_query.data;

    await botApi("answerCallbackQuery", {
      callback_query_id: body.callback_query.id,
    });

    if (cbData !== "mode_support") {
      await sendToUser(cbChatId, "⚠️ Opción no válida para este bot.");
      return NextResponse.json({ ok: true });
    }

    if (!GROUP_ID) {
      await sendToUser(
        cbChatId,
        "⚠️ Servicio no disponible. Intenta más tarde.",
      );
      return NextResponse.json({ ok: true });
    }

    // Buscar thread existente
    const existing = await db.telegramSupportThread.findUnique({
      where: {
        userChatId_botType: { userChatId: cbChatId, botType: BOT_TYPE },
      },
    });

    if (existing) {
      await sendToUser(
        cbChatId,
        "🆘 *Soporte Técnico*\n\nYa tienes una conversación activa. Escribe tu mensaje y un agente te responderá pronto.\n\n/cancel para cerrar.",
      );
      return NextResponse.json({ ok: true });
    }

    // Crear topic en el grupo
    const userRes = await botApi("getChat", { chat_id: cbChatId });
    const userData = await userRes.json();
    const userName = userData.ok ? userData.result.first_name : "Usuario";

    const topicRes = await botApi("createForumTopic", {
      chat_id: GROUP_ID,
      name: `🆘 ${userName}`.slice(0, 128),
      icon_color: 0xe74c3c,
    });
    const topicData = await topicRes.json();

    if (!topicData.ok) {
      console.error("[SupportWebhook] createForumTopic failed:", topicData);
      await sendToUser(
        cbChatId,
        "❌ No se pudo crear la conversación. Verifica que el bot sea admin del grupo con Topics habilitados.",
      );
      return NextResponse.json({ ok: true });
    }

    const threadId = topicData.result.message_thread_id as number;

    await db.telegramSupportThread.create({
      data: {
        userChatId: cbChatId,
        botType: BOT_TYPE,
        threadId,
        groupId: GROUP_ID,
        userName,
        userUsername: userData.ok ? userData.result.username || "" : "",
      },
    });

    // Notificar al grupo
    await botApi("sendMessage", {
      chat_id: GROUP_ID,
      message_thread_id: threadId,
      text: `🆕 *Nueva conversación de Soporte*\n\n👤 *Cliente:* ${userName}\n🆔 \`${cbChatId}\`\n\nEscribe en este hilo para responderle.`,
      parse_mode: "Markdown",
    });

    await sendToUser(
      cbChatId,
      "🆘 *Soporte Técnico iniciado*\n\nDescribe tu problema. Un agente te responderá pronto.\n\n/cancel para cerrar.",
    );

    return NextResponse.json({ ok: true });
  }

  // ── MENSAJE DEL USUARIO (chat privado) ──
  if (body.message?.chat?.type === "private") {
    const msg = body.message;
    const chatId = String(msg.chat.id);
    const text = msg.text || "";

    if (text === "/start") {
      await botApi("sendMessage", {
        chat_id: chatId,
        text: "👋 *¡Bienvenido a Soporte RiyoStream!*\n\n¿Tienes un problema? Cuéntanos y te ayudaremos.",
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🆘 Iniciar Soporte", callback_data: "mode_support" }],
          ],
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (text === "/cancel") {
      await db.telegramSupportThread.deleteMany({
        where: { userChatId: chatId, botType: BOT_TYPE },
      });
      await sendToUser(chatId, "👋 Conversación cerrada. /start para volver.");
      return NextResponse.json({ ok: true });
    }

    const thread = await db.telegramSupportThread.findUnique({
      where: { userChatId_botType: { userChatId: chatId, botType: BOT_TYPE } },
    });

    if (!thread) {
      await sendToUser(chatId, "👋 Escribe /start para iniciar soporte.");
      return NextResponse.json({ ok: true });
    }

    const userName = msg.from?.first_name || "Usuario";
    await botApi("sendMessage", {
      chat_id: thread.groupId,
      message_thread_id: thread.threadId,
      text: `🆘 *${userName}:*\n${text}`,
      parse_mode: "Markdown",
    });

    return NextResponse.json({ ok: true });
  }

  // ── MENSAJE DEL ADMIN EN EL GRUPO ──
  if (body.message?.chat?.type === "supergroup") {
    const msg = body.message;
    const groupId = String(msg.chat.id);
    const threadId = msg.message_thread_id;

    if (!threadId || msg.from?.is_bot) {
      return NextResponse.json({ ok: true });
    }

    const thread = await db.telegramSupportThread.findFirst({
      where: { threadId, groupId, botType: BOT_TYPE },
    });

    if (!thread) return NextResponse.json({ ok: true });

    const text = msg.text || msg.caption || "";
    if (!text) return NextResponse.json({ ok: true });

    const adminName = msg.from?.first_name || "Agente";
    await sendToUser(thread.userChatId, `📨 *${adminName}:*\n\n${text}`);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}
