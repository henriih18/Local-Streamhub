import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const cacheKey = "admin:exclusive-accounts:list";
    let accounts = userCache.get(cacheKey);

    if (!accounts) {
      const dbAccounts = await db.exclusiveAccount.findMany({
        include: {
          allowedUsers: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          exclusiveStocks: {
            include: {
              soldToUser: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Transforme los datos para incluir el recuento de usedSlots y que coincida con la interfaz esperada
      accounts = dbAccounts.map((account) => ({
        ...account,
        allowedUsers: account.allowedUsers.map((user) => ({
          ...user,
          name: user.fullName,
        })),
        exclusiveStocks: account.exclusiveStocks.map((stock) => ({
          ...stock,
          soldToUser: stock.soldToUser
            ? {
                ...stock.soldToUser,
                name: stock.soldToUser.fullName,
              }
            : undefined,
        })),
      }));

      // Caché durante 6 minutos: las cuentas exclusivas cambian moderadamente
      userCache.set(cacheKey, accounts, 6 * 60 * 1000);
    }

    return NextResponse.json(accounts);
  } catch (error) {
    logger.error({err: error},"Error al obtener cuentas exclusivas");
    return NextResponse.json(
      { error: "Error al cargar cuentas exclusivas" },
      { status: 500 },
    );
  }
});

export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const { rateLimit } = await import("@/lib/rate-limiter");
    const limitCheck = await rateLimit({
      identifier: `admin:${user.id}:${request.url}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
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

    const createExclusiveAccountSchema = z.object({
      name: z
        .string()
        .min(1, "El nombre es requerido")
        .max(100, "Nombre demasiado largo"),
      description: z
        .string()
        .min(1, "La descripción es requerida")
        .max(1000, "Descripción demasiado larga"),
      type: z.string().min(1, "El tipo es requerido").max(50),
      price: z.coerce
        .number()
        .positive("El precio debe ser positivo")
        .max(1000000, "Precio máximo 1,000,000"),
      duration: z.string().min(1, "La duración es requerida").max(50),
      quality: z
        .string()
        .min(1, "La calidad es requerida")
        .max(20)
        .optional()
        .nullable()
        .default("HD"),
      screens: z
        .union([z.string(), z.number()])
        .optional()
        .nullable()
        .default("1"),
      saleType: z.enum(["FULL", "PROFILES"]).default("FULL"),
      /* maxProfiles: z.coerce.number().int().min(1).optional().nullable(),
      pricePerProfile: z.coerce.number().positive().optional().nullable(), */
      isPublic: z.boolean().default(false),
      allowedUsers: z.array(z.string().min(1)).optional().default([]),
      maxSlots: z.coerce.number().int().min(1).optional().default(1),
      expiresAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
        .optional()
        .nullable(),
    });

    const body = await request.json();
    const validation = createExclusiveAccountSchema.safeParse(body);

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
      isPublic,
      allowedUsers,
      maxSlots,
      expiresAt,
    } = validation.data;

    const sanitizedName = sanitizeInput(name);
    const sanitizedDescription = sanitizeInput(description);
    const sanitizedDuration = sanitizeInput(duration);
    const sanitizedQuality = quality ? sanitizeInput(quality) : "HD";
    //const sanitizedQuality = sanitizeInput(quality) || "HD";

    // Crear cuenta exclusiva (NO cuenta de streaming)
    const exclusiveAccount = await db.exclusiveAccount.create({
      data: {
        name: sanitizedName,
        description: sanitizedDescription,
        type: sanitizeInput(type),
        price,
        duration: sanitizedDuration,
        quality: sanitizedQuality,
        screens: screens ? String(screens) : null,
        saleType: saleType || "FULL",
        //maxProfiles,
        //pricePerProfile,
        maxSlots: maxSlots || allowedUsers?.length || 1,
        expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59.999Z") : null,
        allowedUsers:
          allowedUsers && allowedUsers.length > 0
            ? {
                connect: allowedUsers.map((userId: string) => ({ id: userId })),
              }
            : undefined,
      },
      include: {
        allowedUsers: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Transformar los datos para que coincidan con la interfaz esperada
    const transformedAccount = {
      ...exclusiveAccount,
      allowedUsers: exclusiveAccount.allowedUsers.map((user) => ({
        ...user,
        name: user.fullName,
      })),
    };

    //  Invalidar caché cuando se crea una nueva cuenta exclusiva
    userCache.delete("admin:exclusive-accounts:list");

    return NextResponse.json(transformedAccount);
  } catch (error) {
    logger.error({err: error},"Error al crear cuenta exclusiva");
    return NextResponse.json(
      { error: "Error al crear cuenta exclusiva" },
      { status: 500 },
    );
  }
});
