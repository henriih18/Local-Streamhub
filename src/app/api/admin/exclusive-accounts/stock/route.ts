import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getIO, broadcastStockUpdate } from "@/lib/socket";
import { requireAdmin } from "@/lib/auth";
import { encryptInventoryCredentials } from "@/lib/order-helper";
import { sanitizeInput } from "@/lib/sanitize";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const exclusiveStockSchema = z.object({
      exclusiveAccountId: z
        .string()
        .min(1, "Se requiere el ID de la cuenta exclusiva"),
      email: z.string().email("Formato de email inválido").max(255),
      password: z.string().min(1, "La contraseña es requerida").max(200),
      pin: z.string().max(20, "PIN demasiado largo").optional(),
      profileName: z
        .string()
        .max(100, "Nombre de perfil demasiado largo")
        .optional(),
      notes: z
        .string()
        .max(500, "Notas demasiado largas")
        .optional()
        .nullable(),
    });

    const data = await request.json();
    const validation = exclusiveStockSchema.safeParse(data);

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

    const { exclusiveAccountId, email, password, pin, profileName, notes } =
      validation.data;

    // Comprobar si existe una cuenta exclusiva
    const exclusiveAccount = await db.exclusiveAccount.findUnique({
      where: { id: exclusiveAccountId },
    });

    if (!exclusiveAccount) {
      return NextResponse.json(
        { error: "Cuenta exclusiva no encontrada" },
        { status: 404 },
      );
    }

    const sanitizedNotes = notes ? sanitizeInput(String(notes)) : null;
    const sanitizedProfileName = profileName
      ? sanitizeInput(String(profileName))
      : undefined;

    const encrypted = encryptInventoryCredentials({
      email: String(email).trim(),
      password: String(password).trim(),
      profileName: sanitizedProfileName,
      profilePin: pin || undefined,
    });

    // Crear stock exclusivo
    const stock = await db.exclusiveStock.create({
      data: {
        exclusiveAccountId,
        email: encrypted.email!,
        password: encrypted.password!,
        pin: encrypted.profilePin || null,
        profileName: encrypted.profileName || null,
        notes: sanitizedNotes,
      },
      include: {
        exclusiveAccount: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    // Emitir actualización de stock en tiempo real
    const io = getIO();
    if (io) {
      const updatedStocks = await db.exclusiveStock.findMany({
        where: {
          exclusiveAccountId,
          isAvailable: true,
        },
      });

      broadcastStockUpdate(io, {
        accountId: exclusiveAccountId,
        accountType: "exclusive",
        type: exclusiveAccount.saleType,
        newStock: updatedStocks.length,
      });
    }

    return NextResponse.json(stock);
  } catch (error) {
    logger.error({ err: error }, "Error al crear stock exclusivo");
    return NextResponse.json(
      { error: "Error al agregar stock" },
      { status: 500 },
    );
  }
});

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const exclusiveAccountId = searchParams.get("exclusiveAccountId");

    if (!exclusiveAccountId) {
      return NextResponse.json(
        { error: "Se requiere el ID de la cuenta exclusiva" },
        { status: 400 },
      );
    }

    const stocks = await db.exclusiveStock.findMany({
      where: {
        exclusiveAccountId,
      },
      select: {
        id: true,
        exclusiveAccountId: true,
        profileName: true,
        notes: true,
        isAvailable: true,
        soldToUserId: true,
        soldAt: true,
        createdAt: true,
        updatedAt: true,
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
    });

    // Transformar los datos para que coincidan con la interfaz esperada
    const transformedStocks = stocks.map((stock) => ({
      ...stock,
      soldToUser: stock.soldToUser
        ? {
            ...stock.soldToUser,
            name: stock.soldToUser.fullName,
          }
        : undefined,
    }));

    return NextResponse.json(transformedStocks);
  } catch (error) {
    logger.error({ err: error }, "Error al obtener existencias exclusivas");

    return NextResponse.json(
      { error: "Error al cargar stock" },
      { status: 500 },
    );
  }
});
