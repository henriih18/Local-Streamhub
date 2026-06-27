import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import {
  sanitizeInput,
  sanitizeCssValue,
  sanitizeAnimationValue,
} from "@/lib/sanitize";
import { z } from "zod";
import { sendTelegramMessage } from "@/lib/telegram";
import { logger } from "@/lib/logger";

export const GET = requireAuth(async () => {
  try {
    const banner = await db.announcementBanner.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!banner) {
      return NextResponse.json({ isActive: false });
    }

    return NextResponse.json(banner);
  } catch (error) {
    logger.error({ err: error }, "Error al cargar el banner del anuncio");
    return NextResponse.json(
      { error: "Error al cargar el banner del anuncio" },
      { status: 500 },
    );
  }
});

export const POST = requireAdmin(async (request: NextRequest) => {
  try {
    const announcementSchema = z.object({
      text: z
        .string()
        .min(1, "El texto es requerido")
        .max(500, "Texto demasiado largo"),
      isActive: z.boolean().default(true),
      speed: z.coerce.number().int().min(1).optional().default(20),
      backgroundColor: z.string().optional().default("#000000"),
      textColor: z.string().optional().default("#ffffff"),
      sendToTelegram: z.boolean().optional().default(false),
      targetRoles: z
        .array(z.enum(["USER", "VENDEDOR"]))
        .optional()
        .default([]),
    });

    const body = await request.json();
    const validation = announcementSchema.safeParse(body);

    if (!validation.success) {
      const allErrors = validation.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }));
      return NextResponse.json(
        { error: "Datos inválidos", details: allErrors },
        { status: 400 },
      );
    }

    const {
      text,
      isActive,
      speed,
      backgroundColor,
      textColor,
      sendToTelegram,
      targetRoles,
    } = validation.data;
    const sanitizedText = sanitizeInput(text);
    const sanitizedSpeed = sanitizeAnimationValue(speed ?? 20);
    const sanitizedBgColor = sanitizeCssValue(backgroundColor ?? "#000000");
    const sanitizedTextColor = sanitizeCssValue(textColor ?? "#ffffff");
    // Desactivar todos los banners existentes
    await db.announcementBanner.updateMany({
      where: {
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Crear nuevo banner
    const banner = await db.announcementBanner.create({
      data: {
        text: sanitizedText,
        isActive: isActive ?? true,
        speed: sanitizedSpeed,
        backgroundColor: sanitizedBgColor,
        textColor: sanitizedTextColor,
      },
    });

    // Enviar anuncio por Telegram a usuarios verificados
    let telegramSent = 0;
    let telegramFailed = 0;
    if (sendToTelegram) {
      try {
        const telegramUsers = await db.user.findMany({
          where: {
            telegramChatId: { not: null },
            ...(targetRoles.length > 0 && { role: { in: targetRoles } }),
          },
          select: {
            telegramChatId: true,
          },
        });

        if (telegramUsers.length > 0) {
          const message = `📢 *ANUNCIO*\n\n${sanitizedText}`;

          const results = await Promise.allSettled(
            telegramUsers.map((u) =>
              sendTelegramMessage(u.telegramChatId!, message, {
                parse_mode: "Markdown",
              }),
            ),
          );

          results.forEach((result) => {
            if (result.status === "fulfilled" && result.value) {
              telegramSent++;
            } else {
              telegramFailed++;
            }
          });

          logger.info(
            `Telegram: ${telegramSent} enviados, ${telegramFailed} fallidos`,
          );
        }
      } catch (error) {
        logger.error({ err: error }, "Error al enviar anuncio por Telegram");
      }
    }

    return NextResponse.json({
      ...banner,
      telegramSent,
      telegramFailed,
    });

    return NextResponse.json(banner);
  } catch (error) {
    logger.error({ err: error }, "Error al crear el banner del anuncio");
    return NextResponse.json(
      { error: "Error al crear el banner del anuncio" },
      { status: 500 },
    );
  }
});

export const PUT = requireAdmin(async (request: NextRequest) => {
  try {
    const updateAnnouncementSchema = z.object({
      id: z.string().min(1, "ID es requerido"),
      text: z
        .string()
        .min(1, "El texto es requerido")
        .max(500, "Texto demasiado largo")
        .optional(),
      isActive: z.boolean().optional(),
      speed: z.coerce.number().int().min(1).optional(),
      backgroundColor: z.string().optional(),
      textColor: z.string().optional(),
    });

    const body = await request.json();
    const validation = updateAnnouncementSchema.safeParse(body);

    if (!validation.success) {
      const allErrors = validation.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }));
      return NextResponse.json(
        { error: "Datos inválidos", details: allErrors },
        { status: 400 },
      );
    }

    const { id, text, isActive, speed, backgroundColor, textColor } =
      validation.data;
    const sanitizedText = text ? sanitizeInput(text) : undefined;
    const sanitizedSpeed = sanitizeAnimationValue(speed ?? 20);
    const sanitizedBgColor = sanitizeCssValue(backgroundColor ?? "#000000");
    const sanitizedTextColor = sanitizeCssValue(textColor ?? "#ffffff");

    const banner = await db.announcementBanner.update({
      where: {
        id,
      },
      data: {
        //text: sanitizedText,
        ...(sanitizedText && { text: sanitizedText }),
        isActive,
        speed: sanitizedSpeed,
        backgroundColor: sanitizedBgColor,
        textColor: sanitizedTextColor,
      },
    });

    return NextResponse.json(banner);
  } catch (error) {
    logger.error({ err: error }, "Error al actualizar el banner del anuncio");
    return NextResponse.json(
      { error: "Error al actualizar el banner del anuncio" },
      { status: 500 },
    );
  }
});

export const DELETE = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID es requerido" }, { status: 400 });
    }

    await db.announcementBanner.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error al eliminar el banner");
    return NextResponse.json(
      { error: "Error al eliminar el banner" },
      { status: 500 },
    );
  }
});

// 405 Method Not Allowed
export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
