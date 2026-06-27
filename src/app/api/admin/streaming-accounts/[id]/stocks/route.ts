import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { decryptInventoryCredentials } from "@/lib/order-helper";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
import { logger } from "@/lib/logger";

export const GET = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { id: string } },
  ) => {
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

      const accountId = params.id;

      const uuidCheck = requireUUID(params.id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      const isExclusive =
        request.nextUrl.searchParams.get("exclusive") === "true";

      let stocks: any[] = [];

      if (isExclusive) {
        const exclusiveStocks = await db.exclusiveStock.findMany({
          where: { exclusiveAccountId: accountId, isAvailable: true },
          select: {
            id: true,
            email: true,
            profileName: true,
            isAvailable: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        stocks = exclusiveStocks.map((stock) => {
          const decrypted = decryptInventoryCredentials(stock);
          return {
            id: stock.id,
            type: decrypted.profileName ? "Perfil" : "Cuenta",
            email: decrypted.email || "Sin email",
            createdAt: stock.createdAt,
          };
        });
      } else {
        const [accountStocks, profileStocks] = await Promise.all([
          db.accountStock.findMany({
            where: { streamingAccountId: accountId, isAvailable: true },
            select: {
              id: true,
              email: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          }),
          db.accountProfile.findMany({
            where: { streamingAccountId: accountId, isAvailable: true },
            select: {
              id: true,
              email: true,
              profileName: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        stocks = [
          ...accountStocks.map((s) => {
            const d = decryptInventoryCredentials(s);
            return {
              id: s.id,
              type: "Cuenta",
              email: d.email || "Sin email",
              createdAt: s.createdAt,
            };
          }),
          ...profileStocks.map((s) => {
            const d = decryptInventoryCredentials(s);
            return {
              id: s.id,
              type: "Perfil",
              email: d.email || "Sin email",
              createdAt: s.createdAt,
            };
          }),
        ];
      }

      return NextResponse.json(stocks);
    } catch (error) {
      logger.error({ err: error }, "Error al obtener stocks");
      return NextResponse.json(
        { error: "Error al obtener stocks" },
        { status: 500 },
      );
    }
  },
);
