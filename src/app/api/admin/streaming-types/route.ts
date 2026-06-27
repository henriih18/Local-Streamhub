import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import {
  sanitizeInput,
  sanitizeIcon,
  sanitizeCssValue,
  sanitizeUrl,
} from "@/lib/sanitize";
import { rateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const cacheKey = "admin:streaming-types:list";
    let types = userCache.get(cacheKey);

    if (!types) {
      types = await db.streamingType.findMany({
        orderBy: { name: "asc" },
      });

      userCache.set(cacheKey, types, 10 * 60 * 1000);
    }

    return NextResponse.json(types);
  } catch (error) {
    logger.error({ err: error }, "Error al recuperar tipos de Streaming");
    return NextResponse.json(
      { error: "Error al recuperar tipos de Streaming" },
      { status: 500 },
    );
  }
});

export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const limitCheck = await rateLimit({
      identifier: `admin:${user.id}:${request.url}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limitCheck.success) {
      return NextResponse.json(
        {
          error: "Demasiadas solicitudes. Espera un momento.",
          retryAfter: Math.ceil((limitCheck.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (limitCheck.resetTime - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    const createStreamingTypeSchema = z.object({
      name: z
        .string()
        .min(1, "El nombre es obligatorio")
        .max(50, "Nombre demasiado largo"),
      description: z
        .string()
        .max(200, "Descripción demasiado larga")
        .optional(),
      color: z.string().max(20, "Color inválido").optional().default("#3B82F6"),
      imageUrl: z.preprocess(
        (val) => (!val || typeof val !== "string" ? null : val),
        z
          .string()
          .max(500, "URL demasiado larga")
          .nullable()
          .refine(
            (val) => !val || /^\/|^https?:\/\//.test(val),
            "URL inválida",
          ),
      ),
    });

    const body = await request.json();

    const validation = createStreamingTypeSchema.safeParse(body);

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

    const { name, color, imageUrl } = validation.data;
    const sanitizedName = sanitizeInput(name);
    const sanitizedColor = sanitizeCssValue(color);
    const sanitizedImageUrl = imageUrl ? sanitizeUrl(imageUrl) : null;

    const existingType = await db.streamingType.findUnique({
      where: { name: sanitizedName },
    });

    if (existingType) {
      return NextResponse.json(
        { error: "El tipo de Streaming ya existe" },
        { status: 400 },
      );
    }

    const newType = await db.streamingType.create({
      data: {
        name: sanitizedName,
        //description: sanitizedDescription,
        color: sanitizedColor,
        imageUrl: sanitizedImageUrl,
      },
    });

    userCache.delete("admin:streaming-types:list");
    userCache.delete("admin:streaming-accounts:list");

    return NextResponse.json(newType);
  } catch (error) {
    logger.error({ err: error }, "Error al crear el tipo de streaming");
    return NextResponse.json(
      { error: "Error al crear el tipo de streaming" },
      { status: 500 },
    );
  }
});
