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
        "🆘 *Ya tienes una conversación activa*\n\nEscribe tu mensaje y un agente te responderá pronto.",
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
      "🆘 *Soporte Técnico iniciado*\n\nDescribe tu problema. Un agente te responderá pronto.",
    );

    return NextResponse.json({ ok: true });
  }

  // ── MENSAJE DEL USUARIO (chat privado) ──
  if (body.message?.chat?.type === "private") {
    const msg = body.message;
    const chatId = String(msg.chat.id);
    const text = msg.text || "";

    // ══════ CASO: /start {orderId} (deep link desde checkout) ══════
    if (text.startsWith("/start ") && text.length > 7) {
      const orderId = text.slice(7).trim();

      // 1. Verificar que la orden existe
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          streamingAccount: {
            select: { name: true, deliveryMethod: true },
          },
          exclusiveAccount: {
            select: { name: true, deliveryMethod: true },
          },
        },
      });

      if (!order) {
        await sendToUser(
          chatId,
          "❌ *ID de compra inválido*\n\nVerifica que el ID sea correcto.",
        );
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

      // 2. Verificar que el usuario de Telegram sea el dueño de la orden
      const telegramUser = await db.user.findFirst({
        where: { telegramChatId: chatId },
        select: { id: true, fullName: true, email: true, username: true },
      });

      if (!telegramUser) {
        await sendToUser(
          chatId,
          "❌ *No tienes una cuenta vinculada*\n\nTu número de Telegram no está asociado a ninguna cuenta de RiyoStream.\n\nSi crees que es un error, regístrate en nuestra web o contacta a soporte.",
        );
        return NextResponse.json({ ok: true });
      }

      // Determinar si la orden pertenece al usuario (para informar al agente)
      const isOwner = order.userId === telegramUser.id;

      // 3. Determinar el deliveryMethod y nombre de la cuenta
      let accountName = "Servicio";
      let deliveryMethod = "AUTOMATIC";

      if (order.streamingAccount) {
        accountName = order.streamingAccount.name;
        deliveryMethod = order.streamingAccount.deliveryMethod;
      } else if (order.exclusiveAccount) {
        accountName = order.exclusiveAccount.name;
        deliveryMethod = order.exclusiveAccount.deliveryMethod;
      }

      // 4. Verificar que la orden requiera entrega por soporte
      if (deliveryMethod !== "SUPPORT") {
        await sendToUser(
          chatId,
          "✅ *Esta compra ya tiene sus credenciales*\n\nEsta orden no requiere entrega por soporte. Puedes ver tus credenciales en tu panel *Mi Cuenta*.",
        );
        return NextResponse.json({ ok: true });
      }

      // 5. Preparar datos de la orden
      const accountType =
        order.saleType === "PROFILES" ? "Perfil" : "Cuenta completa";
      const totalPrice = order.totalPrice.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      });
      const createdAt = new Date(order.createdAt).toLocaleString("es-CO");
      const expiresAt = new Date(order.expiresAt).toLocaleDateString("es-CO");
      const shortId = orderId.slice(-8);

      const userEmail = telegramUser.email || "No registrado";
      const userFullName = telegramUser.fullName || "No especificado";

      // 6.1 Mensaje de verificación para el agente
      const verificationStatus = isOwner
        ? "✅ *Compra verificada en la base de datos*"
        : "⚠️ *Esta orden no pertenece a este usuario*";

      // 6.2 Datos del dueño real de la orden (para informar al agente si no coincide)
      let ownerInfo = "";
      if (!isOwner) {
        const realOwner = await db.user.findUnique({
          where: { id: order.userId },
          select: { fullName: true, email: true, username: true },
        });
        if (realOwner) {
          ownerInfo = `\n🔴 *Dueño real:* ${realOwner.fullName || "N/A"} (\`${realOwner.email || "sin email"}\`)`;
        }
      }

      // 6. Buscar thread existente
      const existingThread = await db.telegramSupportThread.findUnique({
        where: {
          userChatId_botType: { userChatId: chatId, botType: BOT_TYPE },
        },
      });

      // 7. CASO A: Ya tiene thread → reutilizarlo y notificar la nueva orden
      if (existingThread) {
        // Publicar en el thread existente
        await botApi("sendMessage", {
          chat_id: existingThread.groupId,
          message_thread_id: existingThread.threadId,
          text:
            `🛒 *Orden:* \`${orderId}\`\n` +
            `🎬 *Cuenta:* ${accountName}\n` +
            `📦 *Tipo:* ${accountType}\n` +
            `💰 *Precio:* ${totalPrice}\n` +
            `📅 *Comprada:* ${createdAt}\n` +
            `⏰ *Vence:* ${expiresAt}\n\n` +
            `👤 *Cliente:* ${userFullName}\n` +
            `📧 *Email:* \`${userEmail}\`\n` +
            `🆔 *Telegram:* \`${chatId}\`${ownerInfo}\n\n` +
            `${verificationStatus}\n\n` +
            `Entrega las credenciales al usuario en este hilo.`,
          parse_mode: "Markdown",
        });

        // Avisar al usuario
        await sendToUser(
          chatId,
          `✅ *Orden agregada a tu conversación*\n\n` +
            `🎬 *Cuenta:* ${accountName}\n` +
            `🆔 *Orden:* \`${orderId}\`\n\n` +
            `Un agente te entregará las credenciales en este chat enseguida.`,
        );
        return NextResponse.json({ ok: true });
      }

      // 8. CASO B: No tiene thread → crear uno nuevo con los datos
      const userRes = await botApi("getChat", { chat_id: chatId });
      const userData = await userRes.json();
      const userName = userData.ok ? userData.result.first_name : "Usuario";

      const topicName = `🎫 ${userName} - ${accountName} (${shortId})`.slice(
        0,
        128,
      );

      const topicRes = await botApi("createForumTopic", {
        chat_id: GROUP_ID,
        name: topicName,
        icon_color: 0xf39c12, // naranja para entrega
      });
      const topicData = await topicRes.json();

      if (!topicData.ok) {
        console.error("[SupportWebhook] createForumTopic failed:", topicData);
        await sendToUser(
          chatId,
          "❌ No se pudo crear la conversación. Intenta más tarde.",
        );
        return NextResponse.json({ ok: true });
      }

      const threadId = topicData.result.message_thread_id as number;

      await db.telegramSupportThread.create({
        data: {
          userChatId: chatId,
          botType: BOT_TYPE,
          threadId,
          groupId: GROUP_ID,
          userName,
          userUsername: userData.ok ? userData.result.username || "" : "",
        },
      });

      // Notificar al grupo con todos los datos
      await botApi("sendMessage", {
        chat_id: GROUP_ID,
        message_thread_id: threadId,
        text:
          `🛒 *Orden:* \`${orderId}\`\n` +
          `🎬 *Cuenta:* ${accountName}\n` +
          `📦 *Tipo:* ${accountType}\n` +
          `💰 *Precio:* ${totalPrice}\n` +
          `📅 *Comprada:* ${createdAt}\n` +
          `⏰ *Vence:* ${expiresAt}\n\n` +
          `👤 *Cliente:* ${userFullName}\n` +
          `📧 *Email:* \`${userEmail}\`\n` +
          `🆔 *Telegram:* \`${chatId}\`${ownerInfo}\n\n` +
          `${verificationStatus}\n\n` +
          `Entrega las credenciales al usuario en este hilo.`,
        parse_mode: "Markdown",
      });

      // Responder al usuario
      await sendToUser(
        chatId,
        `✅ *Ticket creado*\n\n` +
          `🎬 *Cuenta:* ${accountName}\n` +
          `🆔 *Orden:* \`${orderId}\`\n\n` +
          `Un agente te entregará las credenciales en este chat enseguida.`,
      );

      return NextResponse.json({ ok: true });
    }

    // ══════ CASO: /start sin argumentos ══════
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

    // ══════ CASO: /cancel (bloqueado) ══════
    if (text === "/cancel") {
      await sendToUser(
        chatId,
        "🔒 *Esta conversación no se puede cerrar*\n\nTu conversación con soporte es permanente. Escribe tu mensaje y un agente te responderá pronto.",
      );
      return NextResponse.json({ ok: true });
    }

    // ══════ CASO: Mensaje normal del usuario ══════
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
