import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth, optionalAuth } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { z } from "zod";
import { parseSafeInt, parseSafeSearch } from "@/lib/parse-safe";
import { logger } from "@/lib/logger";

export const GET = optionalAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    /* const userId = searchParams.get("userId"); */
    //const userId = user?.id || searchParams.get("userId");
    const userId = user?.id;

    // Nuevos parámetros de paginación
    const page = parseSafeInt(searchParams.get("page"), 1, 1, 10000);
    const limit = parseSafeInt(searchParams.get("limit"), 9, 1, 100);
    const search = parseSafeSearch(searchParams.get("search"));

    let userRole = "USER";
    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      userRole = user?.role || "USER";
    }

    // Buscar por nombre, tipo o descripción si hay búsqueda
    const searchCondition = search.trim()
      ? {
          OR: [
            { name: { contains: search } },
            { type: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {};

    // Construir condición where para cuentas exclusivas
    const exclusiveWhereCondition: any = {
      isActive: true,
      OR: [
        // Cuentas públicas que NO han vencido
        {
          isPublic: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      ],
    };

    if (userId) {
      // Si el usuario está logueado, incluir también cuentas exclusivas asignadas
      exclusiveWhereCondition.OR.push({
        allowedUsers: {
          some: { id: userId },
        },
        OR: [
          { expiresAt: null }, // Cuenta permanente
          { expiresAt: { gt: new Date() } }, // Aún vigente
        ],
      });
    }

    // Aplicar búsqueda a cuentas exclusivas si existe
    let finalExclusiveWhereCondition = { ...exclusiveWhereCondition };
    if (search.trim()) {
      finalExclusiveWhereCondition = {
        isActive: true,
        OR: exclusiveWhereCondition.OR.map((condition: any) => ({
          AND: [
            condition,
            {
              OR: [
                { name: { contains: search } },
                { type: { contains: search } },
                { description: { contains: search } },
              ],
            },
          ],
        })),
      };
    }

    // Obtener cuentas regulares (SIN paginación primero)
    const allRegularAccounts = await db.streamingAccount.findMany({
      where: {
        isActive: true,
        ...searchCondition,
      },
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
          select: {
            id: true,
            isAvailable: true,
          },
        },
        profileStocks: {
          where: {
            isAvailable: true,
          },
          select: {
            id: true,
            isAvailable: true,
          },
        },
        vendorPricing:
          userRole === "VENDEDOR"
            ? { select: { vendorPrice: true, isActive: true } }
            : false,
      },
      orderBy: {
        order: "asc",
      },
    });

    const processedRegularAccounts = allRegularAccounts.map((account) => {
      let finalPrice = account.price;
      let originalPrice: number | undefined = undefined;

      // Si es VENDEDOR y tiene configuración de precios, aplicar descuento
      if (
        userRole === "VENDEDOR" &&
        account.vendorPricing &&
        account.vendorPricing.isActive
      ) {
        originalPrice = account.price;
        finalPrice = account.vendorPricing.vendorPrice;
      }

      return {
        ...account,
        price: finalPrice,
        originalPrice: originalPrice,
        accountType: "regular",
      };
    });

    // Obtener cuentas exclusivas (SIN paginación primero)
    const allExclusiveAccounts = await db.exclusiveAccount.findMany({
      where: finalExclusiveWhereCondition,
      include: {
        allowedUsers: userId
          ? {
              where: {
                id: userId,
              },
            }
          : undefined,
        exclusiveStocks: {
          where: {
            isAvailable: true,
          },
          select: {
            id: true,
            isAvailable: true,
          },
        },
        orders: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const processedExclusiveAccounts = allExclusiveAccounts.map((account) => ({
      ...account,
      accountType: "exclusive",
    }));

    // COMBINAR todas las cuentas
    const allAccounts = [
      ...processedExclusiveAccounts,
      ...processedRegularAccounts,
    ];

    // Aplicar paginación al total combinado
    const skip = (page - 1) * limit;
    const paginatedAccounts = allAccounts.slice(skip, skip + limit);

    // Calcular totales
    const totalAccounts = allAccounts.length;
    const totalPages = Math.ceil(totalAccounts / limit);

    // Separar cuentas paginadas por tipo para el frontend
    const regularAccounts = paginatedAccounts.filter(
      (account: any) => account.accountType === "regular",
    );
    const exclusiveAccounts = paginatedAccounts.filter(
      (account: any) => account.accountType === "exclusive",
    );

    // Obtener ofertas especiales para usuarios
    let specialOffers: any[] = [];
    if (userId) {
      specialOffers = await db.specialOffer.findMany({
        where: {
          userId: userId,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          streamingAccount: {
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
                select: {
                  id: true,
                  isAvailable: true,
                },
              },
              profileStocks: {
                where: {
                  isAvailable: true,
                },
                select: {
                  id: true,
                  isAvailable: true,
                },
              },
              vendorPricing:
                userRole === "VENDEDOR"
                  ? { select: { vendorPrice: true, isActive: true } }
                  : false,
            },
          },
        },
      });
    }

    return NextResponse.json({
      regularAccounts,
      exclusiveAccounts,
      specialOffers,
      pagination: {
        page,
        limit,
        totalAccounts,
        totalPages,
      },
    });
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

    const createAccountFullSchema = z.object({
      name: z.string().min(1, "El nombre es requerido").max(100),
      description: z.string().min(1, "La descripción es requerida").max(1000),
      price: z.coerce
        .number()
        .positive("El precio debe ser positivo")
        .max(1000000, "Precio máximo 1,000,000"),
      type: z.string().min(1, "El tipo es requerido").max(50),
      duration: z.string().min(1, "La duración es requerida").max(50),
      quality: z.string().min(1, "La calidad es requerida").max(20),
      screens: z.coerce
        .number()
        .int("Las pantallas deben ser un número entero")
        .min(1, "Mínimo 1 pantalla")
        .max(20, "Máximo 20 pantallas"),
      saleType: z.enum(["FULL", "PROFILES"]).default("FULL"),
      /* maxProfiles: z.coerce.number().int().min(1).optional().nullable(),
      pricePerProfile: z.coerce.number().positive().optional().nullable(), */
      email: z.string().optional(),
      password: z.string().optional(),
      stock: z.string().optional(),
      profilesStock: z.string().optional(),
    });

    const body = await request.json();
    const validation = createAccountFullSchema.safeParse(body);

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
      price,
      type,
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
    const sanitizedType = sanitizeInput(type);

    // Verificar que el tipo de streaming existe
    const existingType = await db.streamingType.findUnique({
      where: { name: sanitizedType },
    });

    if (!existingType) {
      return NextResponse.json(
        { error: "El tipo de streaming no existe. Crea el tipo primero." },
        { status: 400 },
      );
    }

    const account = await db.streamingAccount.create({
      data: {
        name: sanitizedName,
        description: sanitizedDescription,
        price,
        type: sanitizedType,
        duration: sanitizedDuration,
        quality: sanitizedQuality,
        screens,
        saleType: saleType || "FULL",
        //maxProfiles,
        //pricePerProfile,
      },
      include: {
        streamingType: true,
        accountStocks: true,
        profileStocks: true,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Error al crear una cuenta de streaming");
    return NextResponse.json(
      { error: "Error al crear una cuenta de streaming" },
      { status: 500 },
    );
  }
});
