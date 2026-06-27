import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { logger } from "@/lib/logger";

const cartItemSchema = z.object({
  streamingAccountId: z.string().min(1),
  quantity: z.number().int().positive().max(100).default(1),
  saleType: z.enum(["FULL", "PROFILES"]).default("FULL"),
  priceAtTime: z.number().positive().optional(),
});
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const cart = await db.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            streamingAccount: {
              include: {
                streamingType: true,
                accountStocks: {
                  select: {
                    id: true,
                    isAvailable: true,
                  },
                },
                profileStocks: {
                  select: {
                    id: true,
                    isAvailable: true,
                  },
                },
              },
            },
            exclusiveAccount: {
              include: {
                allowedUsers: true,
                exclusiveStocks: {
                  where: {
                    isAvailable: true,
                  },
                  select: {
                    id: true,
                    isAvailable: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return NextResponse.json({ items: [], totalAmount: 0 });
    }

    return NextResponse.json(cart);
  } catch (error) {
    logger.error({ err: error }, "Error al recuperar el carrito");
    return NextResponse.json(
      { error: "Error al recuperar el carrito" },
      { status: 500 },
    );
  }
});

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();

    const validation = cartItemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { streamingAccountId, quantity, saleType, priceAtTime } =
      validation.data;

    if (!streamingAccountId) {
      return NextResponse.json(
        {
          error: "Se requiere el ID de la cuenta de Streaming.",
        },
        { status: 400 },
      );
    }

    // Obtener detalles de la cuenta de transmisión
    const streamingAccount = await db.streamingAccount.findUnique({
      where: { id: streamingAccountId },
      include: {
        accountStocks: {
          where: { isAvailable: true },
          select: {
            id: true,
            isAvailable: true,
          },
        },
        profileStocks: {
          where: { isAvailable: true },
          select: {
            id: true,
            isAvailable: true,
          },
        },
      },
    });

    if (!streamingAccount) {
      return NextResponse.json(
        { error: "No se encontró la cuenta de Streaming" },
        { status: 404 },
      );
    }

    // Obtener o crear carrito
    let cart = await db.cart.findUnique({
      where: { userId: user.id },
    });

    if (!cart) {
      cart = await db.cart.create({
        data: {
          userId: user.id,
          totalAmount: 0,
        },
      });
    }

    // Comprobar si el artículo ya existe en el carrito
    const existingItem = await db.cartItem.findFirst({
      where: {
        cartId: cart.id,
        streamingAccountId,
        saleType,
      },
    });

    if (existingItem) {
      // Calcular nueva cantidad
      const newQuantity = existingItem.quantity + (quantity || 1);

      // Consultar la disponibilidad de stock ANTES de actualizar
      const availableStock =
        saleType === "PROFILES"
          ? streamingAccount.profileStocks?.length || 0
          : streamingAccount.accountStocks?.length || 0;

      if (availableStock < newQuantity) {
        return NextResponse.json(
          {
            error: `Stock insuficiente. Solo hay ${availableStock} unidad${
              availableStock !== 1 ? "es" : ""
            } disponible${availableStock !== 1 ? "s" : ""}.`,
          },
          { status: 400 },
        );
      }

      // Cantidad de actualización
      const updatedItem = await db.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });

      // Actualizar el total del carrito
      await updateCartTotal(cart.id);

      return NextResponse.json(updatedItem);
    } else {
      const availableStock =
        saleType === "PROFILES"
          ? streamingAccount.profileStocks?.length || 0
          : streamingAccount.accountStocks?.length || 0;

      if (availableStock < (quantity || 1)) {
        return NextResponse.json(
          {
            error: `Stock insuficiente. Solo hay ${availableStock} unidad${
              availableStock !== 1 ? "es" : ""
            } disponible${availableStock !== 1 ? "s" : ""}.`,
          },
          { status: 400 },
        );
      }

      let finalPriceAtTime: number;
      let priceSource = "BASE";
      let discountType = "";
      let originalBasePrice = 0;

      // 1. Calcular precio base según tipo de venta
      if (saleType === "PROFILES") {
        if (streamingAccount.pricePerProfile && streamingAccount.maxProfiles) {
          finalPriceAtTime = streamingAccount.pricePerProfile;
        } else if (streamingAccount.pricePerProfile) {
          finalPriceAtTime = streamingAccount.pricePerProfile;
        } else if (streamingAccount.maxProfiles) {
          finalPriceAtTime =
            streamingAccount.price / streamingAccount.maxProfiles;
        } else {
          finalPriceAtTime = streamingAccount.price;
        }
      } else {
        finalPriceAtTime = streamingAccount.price;
      }

      originalBasePrice = finalPriceAtTime;

      // 2. Aplicar precio de VENDEDOR si corresponde
      let vendorPrice: number | null = null;
      if (user.role === "VENDEDOR") {
        const vendorPricing = await db.vendorPricing.findFirst({
          where: {
            streamingAccountId: streamingAccount.id,
            isActive: true,
          },
        });

        if (vendorPricing && vendorPricing.vendorPrice > 0) {
          vendorPrice = vendorPricing.vendorPrice;
          if (finalPriceAtTime > vendorPrice) {
            finalPriceAtTime = vendorPrice;
            priceSource = "VENDOR";
            discountType = "PRECIO VENDEDOR";
          }
        }
      }

      // 3. Aplicar OFERTA ESPECIAL si existe y es mejor
      const specialOffer = await db.specialOffer.findFirst({
        where: {
          userId: user.id,
          streamingAccountId: streamingAccount.id,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      if (specialOffer) {
        let specialPrice: number;

        // Calcular precio con oferta especial
        if (specialOffer.discountPercentage) {
          specialPrice =
            originalBasePrice * (1 - specialOffer.discountPercentage / 100);
          discountType = `${specialOffer.discountPercentage}% DESCUENTO`;
        } else if (specialOffer.specialPrice) {
          specialPrice = specialOffer.specialPrice;
          discountType = "OFERTA ESPECIAL";
        } else {
          specialPrice = originalBasePrice;
          discountType = "OFERTA ESPECIAL (PRECIO BASE)";
        }

        // Aplicar solo si el precio de oferta es mejor que el actual
        if (specialPrice < finalPriceAtTime) {
          finalPriceAtTime = specialPrice;
          priceSource = "SPECIAL_OFFER";
        }
      }

      // Validar rango mínimo (evitar precios negativos o 0)
      if (finalPriceAtTime <= 0) {
        return NextResponse.json(
          { error: "Error: precio inválido calculado" },
          { status: 400 },
        );
      }

      // Validar límite máximo (prevenir precios absurdamente altos)
      if (finalPriceAtTime > 1000000) {
        // $1,000,000 como límite máximo
        return NextResponse.json(
          { error: "Error: precio excede el máximo permitido" },
          { status: 400 },
        );
      }

      const cartItem = await db.cartItem.create({
        data: {
          cartId: cart.id,
          streamingAccountId,
          quantity: quantity || 1,
          saleType: saleType || "FULL",
          priceAtTime: finalPriceAtTime,
        },
      });

      // Actualizar el total del carrito
      await updateCartTotal(cart.id);

      return NextResponse.json(cartItem, { status: 201 });
    }
  } catch (error) {
    logger.error({ err: error }, "Error al agregar al carrito");
    return NextResponse.json(
      { error: "Error al agregar al carrito" },
      { status: 500 },
    );
  }
});

async function updateCartTotal(cartId: string) {
  const items = await db.cartItem.findMany({
    where: { cartId },
    select: {
      priceAtTime: true,
      quantity: true,
    },
  });

  const totalAmount = items.reduce((total, item) => {
    return total + item.priceAtTime * item.quantity;
  }, 0);

  await db.cart.update({
    where: { id: cartId },
    data: { totalAmount },
  });
}
