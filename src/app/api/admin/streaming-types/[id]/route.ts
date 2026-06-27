import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { sanitizeInput, sanitizeCssValue, sanitizeUrl } from "@/lib/sanitize";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { logger } from "@/lib/logger";

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

      const id = params.id;

      const uuidCheck = requireUUID(params.id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      const updateStreamingTypeSchema = z.object({
        name: z.string().min(1).max(50).optional(),
        /* description: z.string().max(200).optional(), */
        color: z.string().max(20).optional(),
        imageUrl: z.preprocess(
          (val) => (!val || typeof val !== "string" ? null : val),
          z
            .string()
            .max(500, "URL demasiado larga")
            .nullable()
            .refine(
              (val) => !val || /^\/|^https?:\/\//.test(val),
              "URL inválida",
            ),
        ),
        isActive: z.boolean().optional(),
      });

      const body = await request.json();
      const validation = updateStreamingTypeSchema.safeParse(body);

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

      const { name, /* description, */ color, imageUrl, isActive } =
        validation.data;
      const sanitizedName = name ? sanitizeInput(name) : undefined;
      /* const sanitizedDescription = description
        ? sanitizeInput(description)
        : undefined; */
      const sanitizedColor = sanitizeCssValue(color || "#3B82F6");
      const sanitizedImageUrl = imageUrl ? sanitizeUrl(imageUrl) : null;
      const updatedType = await db.streamingType.update({
        where: { id },
        data: {
          ...(sanitizedName && { name: sanitizedName }),
          /* ...(sanitizedDescription !== undefined && {
            description: sanitizedDescription,
          }), */
          color: sanitizedColor,
          imageUrl: sanitizedImageUrl,
          ...(isActive !== undefined && { isActive }),
        },
      });

      // Invalidar caché cuando se actualiza el tipo
      userCache.delete("admin:streaming-types:list");
      userCache.delete("admin:streaming-accounts:list");

      return NextResponse.json(updatedType);
    } catch (error) {
      logger.error(
        { err: error },
        "Error al actualizar el tipo de transmisión",
      );
      return NextResponse.json(
        { error: "Error al actualizar el tipo Streaming" },
        { status: 500 },
      );
    }
  },
);

export const DELETE = requireAdmin(
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
      const id = params.id;

      const uuidCheck = requireUUID(params.id);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      // Obtener el tipo de streaming
      const streamingType = await db.streamingType.findUnique({
        where: { id },
      });

      if (!streamingType) {
        return NextResponse.json(
          { error: "No se encontró el tipo de Streaming" },
          { status: 404 },
        );
      }

      // Verificar si hay cuentas asociadas a este tipo
      const associatedAccounts = await db.streamingAccount.findMany({
        where: { type: streamingType.name },
      });

      if (associatedAccounts.length > 0) {
        return NextResponse.json(
          {
            error:
              "No se puede eliminar este tipo porque tiene cuentas asociadas",
            count: associatedAccounts.length,
            accounts: associatedAccounts.map((acc) => acc.name),
          },
          { status: 400 },
        );
      }

      // Eliminar el tipo
      await db.streamingType.delete({
        where: { id },
      });

      // Invalidar caché
      userCache.delete("admin:streaming-types:list");
      userCache.delete("admin:streaming-accounts:list");

      return NextResponse.json({
        message: "Tipo de Streaming eliminado correctamente",
      });
    } catch (error) {
      logger.error({ err: error }, "Error al eliminar el tipo de Streaming");
      return NextResponse.json(
        { error: "Error al eliminar el tipo de Streaming" },
        { status: 500 },
      );
    }
  },
);

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function POST() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
