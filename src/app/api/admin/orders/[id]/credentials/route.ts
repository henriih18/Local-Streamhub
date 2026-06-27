import { requireAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limiter";
import { sanitizeInput } from "@/lib/sanitize";
import { requireUUID } from "@/lib/validate-uuid";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const PUT = requireAdmin(
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

      const orderId = params.id;

      const uuidCheck = requireUUID(params.id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }
      const updateCredentialsSchema = z.object({
        accountEmail: z
          .string()
          .email("Formato de email inválido")
          .max(255)
          .optional(),
        accountPassword: z
          .string()
          .min(4, "La contraseña debe tener al menos 4 caracteres")
          .max(200)
          .optional(),
        profileName: z
          .string()
          .max(100, "Nombre de perfil demasiado largo")
          .nullish(),
        profilePin: z.string().max(20, "PIN demasiado largo").nullish(),
      });

      const body = await request.json();
      const validation = updateCredentialsSchema.safeParse(body);

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

      const { accountEmail, accountPassword, profileName, profilePin } =
        validation.data;

      //  SANITIZAR y ENCRIPTAR antes de guardar
      const updatedOrder = await db.order.update({
        where: { id: orderId },
        data: {
          // Solo actualizar campos proporcionados, y ENCRIPTARLOS
          ...(accountEmail && {
            accountEmail: encrypt(sanitizeInput(accountEmail)),
          }),
          ...(accountPassword && {
            accountPassword: encrypt(sanitizeInput(accountPassword)),
          }),
          ...(profileName && {
            profileName: encrypt(sanitizeInput(profileName)),
          }),
          ...(profilePin && {
            profilePin: encrypt(sanitizeInput(profilePin)),
          }),
          // Expirar la orden para que el comprador ya no vea credenciales
          status: "EXPIRED",
          expiresAt: new Date(),
        },
      });

      //  Log de auditoría (sin datos sensibles)
      logger.info(
        {
          adminId: user.id,
          orderId: orderId,
          action: "update_credentials",
          security: true,
        },
        "Admin actualizó credenciales del pedido",
      );

      return NextResponse.json({
        success: true,
        message: "Credenciales actualizadas correctamente",
        order: {
          id: updatedOrder.id,
          updatedAt: updatedOrder.updatedAt,
        },
      });
    } catch (error) {
      logger.error(
        { err: error },
        "Error al actualizar las credenciales del pedido",
      );
      return NextResponse.json(
        { error: "Error al actualizar credenciales del pedido" },
        { status: 500 },
      );
    }
  },
);

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
export function POST() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
export function DELETE() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "PUT" } },
  );
}
