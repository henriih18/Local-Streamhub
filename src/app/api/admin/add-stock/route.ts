import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AccountProfile, AccountStock } from "@prisma/client";
import { getIO, broadcastStockUpdate } from "@/lib/socket";
import { requireAdmin } from "@/lib/auth";
import { encryptInventoryCredentials } from "@/lib/order-helper";
import { rateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { logger } from "@/lib/logger";

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

    const addStockSchema = z.object({
      streamingAccountId: z.string().uuid("ID de cuenta inválido"),
      saleType: z.enum(["FULL", "PROFILES"]).optional(),
      accounts: z
        .string()
        .max(50000, "Texto de cuentas demasiado largo")
        .optional(),
      profiles: z
        .string()
        .max(50000, "Texto de perfiles demasiado largo")
        .optional(),
    });

    const data = await request.json();
    const validation = addStockSchema.safeParse(data);

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

    const { streamingAccountId, saleType, accounts, profiles } =
      validation.data;

    // Obtener una cuenta de streaming para verificar el tipo de venta
    const streamingAccount = await db.streamingAccount.findUnique({
      where: { id: streamingAccountId },
    });

    if (!streamingAccount) {
      return NextResponse.json(
        { error: "No se encontró la cuenta de streaming" },
        { status: 404 },
      );
    }

    const results: (AccountStock | AccountProfile)[] = [];
    //const actualSaleType = saleType || streamingAccount.saleType;
    const actualSaleType = streamingAccount.saleType;

    if (actualSaleType === "FULL" && (!accounts || !accounts.trim())) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta es de tipo COMPLETA. Ingresa las cuentas en formato email:contraseña",
        },
        { status: 400 },
      );
    }
    if (actualSaleType === "PROFILES" && (!profiles || !profiles.trim())) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta es de tipo POR PERFILES. Ingresa los perfiles en formato email:contraseña:perfil:pin",
        },
        { status: 400 },
      );
    }

    // Añadir cuentas completas al stock
    // Añadir cuentas completas al stock
    if (actualSaleType === "FULL" && accounts && accounts.trim()) {
      const accountLines = accounts.trim().split("\n");

      for (const line of accountLines) {
        const parts = line.split(":").map((s) => s.trim());
        if (parts.length !== 2) {
          return NextResponse.json(
            {
              error: `Formato inválido en línea: "${line}". Para cuentas completas usa formato email:contraseña (2 campos separados por ":")`,
            },
            { status: 400 },
          );
        }
        const [email, password] = parts;
        if (email && password) {
          const encrypted = encryptInventoryCredentials({
            email,
            password,
          });
          const newAccount = await db.accountStock.create({
            data: {
              streamingAccountId,
              email: encrypted.email!,
              password: encrypted.password!,
              isAvailable: true,
            },
          });
          results.push(newAccount);
        }
      }
    }

    // Añadir perfiles al stock
    if (actualSaleType === "PROFILES" && profiles && profiles.trim()) {
      const profileLines = profiles.trim().split("\n");

      for (const line of profileLines) {
        const parts = line.split(":").map((s) => s.trim());
        if (parts.length !== 4) {
          return NextResponse.json(
            {
              error: `Formato inválido en línea: "${line}". Para perfiles usa formato email:contraseña:perfil:pin (4 campos separados por ":")`,
            },
            { status: 400 },
          );
        }
        const [email, password, profileName, profilePin] = parts;
        const encrypted = encryptInventoryCredentials({
          email,
          password,
          profileName,
          profilePin: profilePin,
        });
        const newProfile = await db.accountProfile.create({
          data: {
            streamingAccountId,
            email: encrypted.email!,
            password: encrypted.password!,
            profileName: encrypted.profileName!,
            profilePin: encrypted.profilePin!,
            isAvailable: true,
          },
        });
        results.push(newProfile);
      }
    }

    // Emitir actualización de stock en tiempo real
    const io = getIO();
    if (io) {
      const updatedAccount = await db.streamingAccount.findUnique({
        where: { id: streamingAccountId },
        include: {
          accountStocks: {
            where: { isAvailable: true },
          },
          profileStocks: {
            where: { isAvailable: true },
          },
        },
      });

      const newStock =
        actualSaleType === "PROFILES"
          ? updatedAccount?.profileStocks?.length || 0
          : updatedAccount?.accountStocks?.length || 0;

      // Crear arrays de nuevos stocks sin credenciales para el frontend
      const newStocksForFrontend = results.map((stock) => ({
        id: stock.id,
        isAvailable: true,
      }));

      broadcastStockUpdate(io, {
        accountId: streamingAccountId,
        accountType: "regular",
        type: actualSaleType,
        newStock: newStock,
        newStocks: newStocksForFrontend,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Se agregaron ${results.length} artículos al inventario`,
      results,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al agregar stock");
    return NextResponse.json(
      { error: "Error al agregar stock" },
      { status: 500 },
    );
  }
});

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function PUT() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function DELETE() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
