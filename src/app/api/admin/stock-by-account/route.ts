import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    // Obtener todas las cuentas de streaming con sus stocks
    const streamingAccounts = await db.streamingAccount.findMany({
      include: {
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
        streamingType: {
          select: {
            name: true,
            color: true,
          },
        },
      },
    });

    // Obtener cuentas exclusivas con sus stocks
    const exclusiveAccounts = await db.exclusiveAccount.findMany({
      include: {
        exclusiveStocks: {
          where: {
            isAvailable: true,
          },
        },
      },
    });

    // Procesar datos de cuentas regulares
    const regularStockData = streamingAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: "REGULAR",
      streamingType: account.streamingType?.name || "Sin tipo",
      color: account.streamingType?.color || "#6B7280",
      saleType: account.saleType,
      price: account.price,
      duration: account.duration,
      quality: account.quality,
      screens: account.screens,
      accountStock: account.accountStocks.length,
      profileStock: account.profileStocks.length,
      totalStock: account.accountStocks.length + account.profileStocks.length,
      isActive: account.isActive,
    }));

    // Procesar datos de cuentas exclusivas
    const exclusiveStockData = exclusiveAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: "EXCLUSIVE",
      streamingType: account.type,
      color: "#8B5CF6",
      saleType: account.saleType,
      price: account.price,
      duration: account.duration.toString(),
      quality: account.quality,
      screens: account.screens?.toString() || "1",
      accountStock:
        account.saleType === "FULL" ? account.exclusiveStocks.length : 0,
      profileStock:
        account.saleType === "PROFILES" ? account.exclusiveStocks.length : 0,
      totalStock: account.exclusiveStocks.length,
      isActive: account.isActive,
      maxProfiles: account.maxProfiles,
      pricePerProfile: account.pricePerProfile,
    }));

    // Combinar todos los datos
    const allStockData = [...regularStockData, ...exclusiveStockData];

    // Calcular totales generales
    const totalAccounts = allStockData.reduce(
      (sum, account) => sum + account.accountStock,
      0,
    );
    const totalProfiles = allStockData.reduce(
      (sum, account) => sum + account.profileStock,
      0,
    );
    const totalStock = totalAccounts + totalProfiles;

    // Agrupar por tipo de streaming
    const stockByStreamingType = allStockData.reduce(
      (acc, account) => {
        const type = account.streamingType;
        if (!acc[type]) {
          acc[type] = {
            streamingType: type,
            color: account.color,
            accounts: 0,
            profiles: 0,
            totalStock: 0,
            accountCount: 0,
          };
        }
        acc[type].accounts += account.accountStock;
        acc[type].profiles += account.profileStock;
        acc[type].totalStock += account.totalStock;
        acc[type].accountCount += 1;
        return acc;
      },
      {} as Record<string, any>,
    );

    // Agrupar por tipo de venta (FULL vs PROFILE)
    const stockBySaleType = allStockData.reduce(
      (acc, account) => {
        const saleType = account.saleType;
        if (!acc[saleType]) {
          acc[saleType] = {
            saleType,
            accounts: 0,
            profiles: 0,
            totalStock: 0,
            accountCount: 0,
          };
        }
        acc[saleType].accounts += account.accountStock;
        acc[saleType].profiles += account.profileStock;
        acc[saleType].totalStock += account.totalStock;
        acc[saleType].accountCount += 1;
        return acc;
      },
      {} as Record<string, any>,
    );

    const response = {
      success: true,
      data: {
        summary: {
          totalAccounts,
          totalProfiles,
          totalStock,
          activeAccounts: allStockData.filter((a) => a.isActive).length,
          totalAccountTypes: allStockData.length,
        },
        byAccount: allStockData.sort((a, b) => b.totalStock - a.totalStock),
        byStreamingType: Object.values(stockByStreamingType).sort(
          (a: any, b: any) => b.totalStock - a.totalStock,
        ),
        bySaleType: Object.values(stockBySaleType),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ err: error }, "Error al obtener stock por cuenta");
    return NextResponse.json(
      { success: false, error: "Error al obtener los datos de stock" },
      { status: 500 },
    );
  }
});
