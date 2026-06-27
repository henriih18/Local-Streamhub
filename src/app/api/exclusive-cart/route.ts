import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { logger } from "@/lib/logger";

const exclusiveCartSchema = z.object({
  exclusiveAccountId: z.string().min(1),
  quantity: z.number().int().positive().max(100).default(1),
});

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    //const userId = searchParams.get("userId");
    const userId = user.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Se requiere el ID de usuario" },
        { status: 400 },
      );
    }

    // Obtener cuentas exclusivas a las que el usuario tiene acceso.
    const exclusiveAccounts = await db.exclusiveAccount.findMany({
      where: {
        isActive: true,
        OR: [
          { isPublic: true },
          {
            allowedUsers: {
              some: {
                id: userId,
              },
            },
          },
        ],
      },
      include: {
        allowedUsers: {
          where: {
            id: userId,
          },
        },
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
    });

    return NextResponse.json(exclusiveAccounts);
  } catch (error) {
    logger.error({ err: error }, "Error al recuperar cuentas exclusivas");
    return NextResponse.json(
      { error: "Error al recuperar cuentas exclusivas" },
      { status: 500 },
    );
  }
});

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();

    const validation = exclusiveCartSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { exclusiveAccountId, quantity } = validation.data;
    const userId = user.id;

    if (!userId || !exclusiveAccountId) {
      return NextResponse.json(
        { error: "Se requieren el ID de usuario y el ID de cuenta exclusivo." },
        { status: 400 },
      );
    }

    // Obtener detalles de cuenta exclusivos
    const exclusiveAccount = await db.exclusiveAccount.findUnique({
      where: { id: exclusiveAccountId },
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
    });

    if (!exclusiveAccount) {
      return NextResponse.json(
        { error: "Cuenta exclusiva no encontrada" },
        { status: 404 },
      );
    }

    // Verificar si el usuario tiene acceso a esta cuenta exclusiva
    const hasAccess =
      exclusiveAccount.isPublic ||
      (exclusiveAccount.allowedUsers &&
        exclusiveAccount.allowedUsers.some((user) => user.id === userId));

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Acceso denegado a esta cuenta exclusiva" },
        { status: 403 },
      );
    }

    // Consultar disponibilidad de stock
    const availableStock = exclusiveAccount.exclusiveStocks.length;
    if (availableStock < quantity) {
      return NextResponse.json(
        {
          error: `Stock insuficiente. Solo hay ${availableStock} unidades disponibles`,
        },
        { status: 400 },
      );
    }

    // Obtener o crear carrito
    let cart = await db.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await db.cart.create({
        data: {
          userId,
          totalAmount: 0,
        },
      });
    }

    // Comprobar si el artículo ya existe en el carrito
    const existingItem = await db.cartItem.findFirst({
      where: {
        cartId: cart.id,
        exclusiveAccountId: exclusiveAccountId,
      },
    });

    if (existingItem) {
      // Cantidad de actualización
      const newQuantity = existingItem.quantity + quantity;

      // Consultar stock nuevamente
      if (availableStock < newQuantity) {
        return NextResponse.json(
          {
            error: `Stock insuficiente. Solo hay ${availableStock} unidades disponibles`,
          },
          { status: 400 },
        );
      }

      const updatedItem = await db.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
        },
      });

      // Actualizae el total del carrito
      await updateCartTotal(cart.id);

      return NextResponse.json(updatedItem);
    } else {
      const finalPriceAtTime = exclusiveAccount.price;

      const cartItem = await db.cartItem.create({
        data: {
          cartId: cart.id,
          exclusiveAccountId,
          quantity: quantity,
          saleType: exclusiveAccount.saleType as "FULL" | "PROFILES",
          priceAtTime: finalPriceAtTime,
        },
      });

      // Actualizar carrito total
      await updateCartTotal(cart.id);

      return NextResponse.json(cartItem, { status: 201 });
    }
  } catch (error) {
    logger.error(
      { err: error },
      "Error al agregar una cuenta exclusiva al carrito",
    );
    return NextResponse.json(
      { error: "Error al agregar al carrito" },
      { status: 500 },
    );
  }
});

async function updateCartTotal(cartId: string) {
  const items = await db.cartItem.findMany({
    where: { cartId },
  });

  const totalAmount = items.reduce((total, item) => {
    return total + item.priceAtTime * item.quantity;
  }, 0);

  await db.cart.update({
    where: { id: cartId },
    data: { totalAmount },
  });
}
