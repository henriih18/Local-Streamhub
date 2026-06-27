import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { logger } from "@/lib/logger";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await auth(request);
  if (!authResult.user) {
    return NextResponse.json(
      { error: authResult.error || "No autorizado" },
      { status: 401 },
    );
  }
  const user = authResult.user;

  try {
    const resolvedParams = await params;
    const body = await request.json();
    const updateCartSchema = z.object({
      quantity: z
        .number()
        .int("Debe ser un entero")
        .positive("Debe ser mayor a 0")
        .max(100, "Máximo 100 unidades"),
    });
    const validation = updateCartSchema.safeParse(body);

    const uuidCheck = requireUUID(resolvedParams.id);
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
    }

    // Validar que quantity sea un entero positivo
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

    const { quantity } = validation.data;

    // Verificar que el usuario tiene permiso para este item
    const cartItem = await db.cartItem.findUnique({
      where: { id: resolvedParams.id },
      include: {
        cart: { select: { userId: true } },
        streamingAccount: {
          include: {
            accountStocks: { where: { isAvailable: true } },
            profileStocks: { where: { isAvailable: true } },
          },
        },
      },
    });

    if (!cartItem) {
      return NextResponse.json(
        { error: "Artículo del carrito no encontrado" },
        { status: 404 },
      );
    }

    // Verificar propiedad del carrito
    if (cartItem.cart.userId !== user.id) {
      logger.warn(
        {
          userId: user.id,
          targetCartOwner: cartItem.cart.userId,
          action: "modify_cart_item",
          security: true,
        },
        `Usuario intentó modificar item del carrito de otro usuario`,
      );
      return NextResponse.json(
        { error: "No tienes permiso para modificar este item" },
        { status: 403 },
      );
    }

    // Validar stock
    if (cartItem.streamingAccount) {
      const availableStock =
        cartItem.saleType === "PROFILES"
          ? cartItem.streamingAccount.profileStocks?.length || 0
          : cartItem.streamingAccount.accountStocks?.length || 0;

      if (availableStock < quantity) {
        return NextResponse.json(
          {
            error: `Stock insuficiente. Solo hay ${availableStock} disponible.`,
          },
          { status: 400 },
        );
      }
    }

    // Actualizar item
    const updatedCartItem = await db.cartItem.update({
      where: { id: resolvedParams.id },
      data: { quantity },
    });

    // Recalcular total
    await updateCartTotal(cartItem.cartId);

    return NextResponse.json(updatedCartItem);
  } catch (error) {
    logger.error({ err: error }, "Error al actualizar el artículo del carrito");
    return NextResponse.json(
      { error: "Error al actualizar el artículo del carrito" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await auth(request);
  if (!authResult.user) {
    return NextResponse.json(
      { error: authResult.error || "No autorizado" },
      { status: 401 },
    );
  }
  const user = authResult.user;

  try {
    const resolvedParams = await params;
    const cartItem = await db.cartItem.findUnique({
      where: { id: resolvedParams.id },
      include: { cart: { select: { userId: true } } },
    });

    const uuidCheck = requireUUID(resolvedParams.id);
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
    }

    if (!cartItem) {
      return NextResponse.json(
        { error: "Artículo del carrito no encontrado" },
        { status: 404 },
      );
    }

    // Verificar propiedad del carrito
    if (cartItem.cart.userId !== user.id) {
      logger.warn(
        {
          userId: user.id,
          targetCartOwner: cartItem.cart.userId,
          action: "delete_cart_item",
          security: true,
        },
        "Usuario intentó eliminar item del carrito de otro usuario",
      );
      return NextResponse.json(
        { error: "No tienes permiso para eliminar este item" },
        { status: 403 },
      );
    }

    await db.cartItem.delete({
      where: { id: resolvedParams.id },
    });

    // Actualizar el total del carrito
    await updateCartTotal(cartItem.cartId);

    return NextResponse.json({ message: "Artículo eliminado del carrito" });
  } catch (error) {
    logger.error({ err: error }, "Error al eliminar el artículo del carrito");
    return NextResponse.json(
      { error: "Error al eliminar el artículo del carrito" },
      { status: 500 },
    );
  }
}

async function updateCartTotal(cartId: string) {
  const items = await db.cartItem.findMany({
    where: { cartId },
    include: {
      streamingAccount: true,
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
