import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { rateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const cacheKey = "admin:streaming-accounts:list";
    let cachedData = userCache.get(cacheKey);

    if (!cachedData) {
      // Obtenercuentas con stock real disponible
      const rawAccounts = await db.streamingAccount.findMany({
        /* where: {
          isActive: true,
        }, */
        include: {
          streamingType: {
            select: {
              icon: true,
              color: true,
              imageUrl: true,
            },
          },
          accountStocks: {
            where: {
              isAvailable: true,
            },
          },
          profileStocks: {
            where: {
              isAvailable: true,
            },
          },
          orders: true,
        },
        orderBy: {
          order: "asc",
        },
      });

      // Transformar para que coincida con las expectativas del frontend
      const accounts = rawAccounts.map((account) => ({
        ...account,
        _count: {
          accountStocks: account.accountStocks.length,
          profileStocks: account.profileStocks.length,
          orders: account.orders.length,
        },
      }));

      userCache.set(cacheKey, accounts, 7 * 60 * 1000);
      cachedData = accounts;
    }

    return NextResponse.json(cachedData);
  } catch (error) {
    logger.error({ err: error }, "Error al obtener las cuentas de streaming");
    return NextResponse.json(
      { error: "Error al obtener las cuentas de streaming" },
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

    const createStreamingAccountSchema = z.object({
      name: z
        .string()
        .min(1, "El nombre es requerido")
        .max(100, "Nombre demasiado largo"),
      description: z
        .string()
        .min(1, "La descripción es requerida")
        .max(1000, "Descripción demasiado larga"),
      type: z.string().min(1, "El tipo es requerido"),
      price: z.coerce
        .number()
        .positive("El precio debe ser positivo")
        .max(1000000, "Precio máximo 1,000,000"),
      duration: z
        .string()
        .min(1, "La duración es requerida")
        .max(50, "Duración inválida"),
      quality: z
        .string()
        .min(1, "La calidad es requerida")
        .max(20, "Calidad inválida"),
      screens: z.coerce
        .number()
        .int("Las pantallas deben ser un número entero")
        .min(1, "Mínimo 1 pantalla")
        .max(20, "Máximo 20 pantallas"),
      saleType: z.enum(["FULL", "PROFILES"]).default("FULL"),
      /* maxProfiles: z.coerce.number().int().min(1).optional().nullable(),
      pricePerProfile: z.coerce.number().positive().optional().nullable(), */
    });

    const body = await request.json();
    const validation = createStreamingAccountSchema.safeParse(body);

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
      name,
      description,
      type,
      price,
      duration,
      quality,
      screens,
      saleType,
      //maxProfiles,
      //pricePerProfile,
    } = validation.data;

    const sanitizedName = sanitizeInput(name);
    const sanitizedDescription = sanitizeInput(description);
    const sanitizedDuration = sanitizeInput(duration);
    const sanitizedQuality = sanitizeInput(quality);

    const streamingAccount = await db.streamingAccount.create({
      data: {
        name: sanitizedName,
        description: sanitizedDescription,
        type,
        price,
        duration: sanitizedDuration,
        quality: sanitizedQuality,
        screens,
        saleType: saleType || "FULL",
        //maxProfiles,
        //pricePerProfile,
      },
    });

    // Invalidar caché al crear una nueva cuenta
    userCache.delete("admin:streaming-accounts:list");

    return NextResponse.json(streamingAccount);
  } catch (error) {
    logger.error({ err: error }, "Error al crear una cuenta de streaming");
    return NextResponse.json(
      { error: "Error al crear una cuenta de streaming" },
      { status: 500 },
    );
  }
});
