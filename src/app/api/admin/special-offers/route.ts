import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const cacheKey = "admin:special-offers:list";
    let cachedOffers = userCache.get(cacheKey);

    if (!cachedOffers) {
      // verificary actualizar las ofertas vencidas
      const now = new Date();
      await db.specialOffer.updateMany({
        where: {
          expiresAt: {
            lt: now,
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      const specialOffers = await db.specialOffer.findMany({
        include: {
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
          streamingAccount: {
            select: {
              name: true,
              type: true,
              price: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Transformar los datos para que coincidan con la interfaz esperada
      cachedOffers = specialOffers.map((offer) => ({
        ...offer,
        user: {
          ...offer.user,
          name: offer.user.fullName,
        },
      }));

      userCache.set(cacheKey, cachedOffers, 5 * 60 * 1000);
    }

    return NextResponse.json(cachedOffers);
  } catch (error) {
    logger.error({ err: error }, "Error al obtener ofertas especiales");
    return NextResponse.json(
      { error: "Error al cargar las ofertas especiales" },
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

    const specialOfferSchema = z
      .object({
        userIds: z.array(z.string().uuid("ID de usuario inválido")),
        streamingAccountId: z.string().uuid("ID de cuenta inválido"),
        discountPercentage: z.coerce
          .number()
          .min(0, "Mínimo 0%")
          .max(100, "Máximo 100%"),
        expiresAt: z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Formato de fecha inválido (YYYY-MM-DD)",
          )
          .optional()
          .nullable(),
        applyToAllUsers: z.boolean().default(false),
      })
      .refine(
        (data) => {
          if (
            !data.applyToAllUsers &&
            (!data.userIds || data.userIds.length === 0)
          ) {
            return false;
          }
          return true;
        },
        {
          message:
            "Debes seleccionar usuarios o aplicar a todos los usuarios normales",
          path: ["userIds"],
        },
      );

    const body = await request.json();
    const validation = specialOfferSchema.safeParse(body);

    if (!validation.success) {
      const allErrors = validation.error.issues.map((issue) => ({
        field: String(issue.path[0]),
        message: issue.message,
      }));
      return NextResponse.json(
        { error: "Datos inválidos", details: allErrors },
        { status: 400 },
      );
    }

    const {
      userIds,
      streamingAccountId,
      discountPercentage,
      expiresAt,
      applyToAllUsers,
    } = validation.data;

    const discount = discountPercentage;

    let specialOffers;

    if (applyToAllUsers) {
      // Obtener todos los usuarios normales (no proveedores)
      const normalUsers = await db.user.findMany({
        where: { role: "USER" },
        select: { id: true },
      });

      // Crea ofertas especiales para todos los usuarios normales.
      specialOffers = await Promise.all(
        normalUsers.map((user) =>
          db.specialOffer.create({
            data: {
              userId: user.id,
              streamingAccountId,
              discountPercentage,
              targetSpent: 0,
              expiresAt: expiresAt
                ? new Date(expiresAt + "T23:59:59.999Z")
                : null,
            },
            include: {
              user: {
                select: {
                  email: true,
                  fullName: true,
                },
              },
              streamingAccount: {
                select: {
                  name: true,
                  type: true,
                },
              },
            },
          }),
        ),
      );
    } else {
      // Crear ofertas especiales para usuarios seleccionados
      specialOffers = await Promise.all(
        userIds.map((userId: string) =>
          db.specialOffer.create({
            data: {
              userId,
              streamingAccountId,
              discountPercentage,
              targetSpent: 0,
              expiresAt: expiresAt
                ? new Date(expiresAt + "T23:59:59.999Z")
                : null,
            },
            include: {
              user: {
                select: {
                  email: true,
                  fullName: true,
                },
              },
              streamingAccount: {
                select: {
                  name: true,
                  type: true,
                },
              },
            },
          }),
        ),
      );
    }

    // Transformar los datos para que coincidan con la interfaz esperada
    const transformedOffers = specialOffers.map((offer) => ({
      ...offer,
      user: {
        ...offer.user,
        name: offer.user.fullName,
      },
    }));

    // Invalidar caché cuando se crean nuevas ofertas
    userCache.delete("admin:special-offers:list");

    return NextResponse.json(transformedOffers);
  } catch (error) {
    logger.error({ err: error }, "Error al crear ofertas especiales");
    return NextResponse.json(
      { error: "Error al crear ofertas especiales" },
      { status: 500 },
    );
  }
});
