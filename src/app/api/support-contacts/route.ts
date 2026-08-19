import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  sanitizeInput,
  sanitizePhone,
  sanitizeTelegramUsername,
} from "@/lib/sanitize";
import { logger } from "@/lib/logger";

// Schema para validación
const supportContactSchema = z
  .object({
    name: z.string().min(1, "El nombre es requerido"),
    number: z.string().min(1, "El número es requerido"),
    type: z.enum(["whatsapp", "phone", "telegram", "sms"]),
    description: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
    order: z.number().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.type === "telegram") {
      // Limpiar @ para validar
      const username = data.number.trim().replace(/^@+/, "");
      // 5-32 chars, empieza con letra, solo [a-zA-Z0-9_]
      if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Ingresa un username de Telegram válido (5-32 caracteres, empieza con letra, solo letras, números y _). Ej: @MiBotSoporte",
          path: ["number"],
        });
      }
    } else {
      // Para whatsapp/phone/sms: al menos 7 dígitos
      const digits = data.number.replace(/\D/g, "");
      if (digits.length < 7) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresa un número de teléfono válido (mínimo 7 dígitos)",
          path: ["number"],
        });
      }
    }
  });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    // FIX: Rechazar query params con caracteres sospechosos
    for (const [key, value] of searchParams.entries()) {
      if (key !== "activeOnly" && value && /[<>"'&|\\(){}[\];]/.test(value)) {
        return NextResponse.json(
          { error: "Parámetro no válido" },
          { status: 400 },
        );
      }
    }

    const contacts = await db.supportContact.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        number: true,
        type: true,
        description: true,
        isActive: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const filteredContacts = activeOnly
      ? contacts.filter((contact) => contact.isActive)
      : contacts;

    return NextResponse.json({
      success: true,
      contacts: filteredContacts,
      total: contacts.length,
      active: contacts.filter((c) => c.isActive).length,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al obtener los contactos de soporte");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// POST - Crear nuevo contacto de soporte
export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const { rateLimit } = await import("@/lib/rate-limiter");
    const limitCheck = await rateLimit({
      identifier: `admin:${user.id}:${request.url}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
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

    const body = await request.json();

    // Validar datos
    const validation = supportContactSchema.safeParse(body);

    if (!validation.success) {
      const allErrors = validation.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }));

      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: allErrors,
        },
        { status: 400 },
      );
    }

    const { name, number, type, description, isActive, order } =
      validation.data;

    const sanitizedNumber =
      type === "telegram"
        ? sanitizeTelegramUsername(number)
        : sanitizePhone(number);
    const sanitizedName = sanitizeInput(name);
    const sanitizedDescription = description
      ? sanitizeInput(description)
      : null;

    // Crear contacto
    const newContact = await db.supportContact.create({
      data: {
        name: sanitizedName,
        number: sanitizedNumber,
        type,
        description: sanitizedDescription,
        isActive,
        order,
      },
      select: {
        id: true,
        name: true,
        number: true,
        type: true,
        description: true,
        isActive: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Contacto de soporte creado exitosamente",
        contact: newContact,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "Error al crear contacto de soporte");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});

export const PUT = requireAdmin(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID del contacto es requerido" },
        { status: 400 },
      );
    }

    // Validar datos (parcial)
    const validation = supportContactSchema.partial().safeParse(updateData);

    if (!validation.success) {
      const allErrors = validation.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }));

      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: allErrors,
        },
        { status: 400 },
      );
    }

    /* const sanitizedData = {
      ...validation.data,
      name: validation.data.name
        ? sanitizeInput(validation.data.name)
        : undefined,
      description: validation.data.description
        ? sanitizeInput(validation.data.description)
        : undefined,
      
    }; */
    const sanitizedData: any = {
      ...validation.data,
    };

    if (validation.data.name) {
      sanitizedData.name = sanitizeInput(validation.data.name);
    }
    if (validation.data.description) {
      sanitizedData.description = sanitizeInput(validation.data.description);
    }
    if (validation.data.number) {
      sanitizedData.number =
        validation.data.type === "telegram"
          ? sanitizeTelegramUsername(validation.data.number)
          : sanitizePhone(validation.data.number);
    }

    // Verificar si el contacto existe
    const existingContact = await db.supportContact.findUnique({
      where: { id },
    });

    if (!existingContact) {
      return NextResponse.json(
        { error: "Contacto de soporte no encontrado" },
        { status: 404 },
      );
    }

    // Actualizar contacto
    const updatedContact = await db.supportContact.update({
      where: { id },
      data: sanitizedData,
      select: {
        id: true,
        name: true,
        number: true,
        type: true,
        description: true,
        isActive: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Contacto de soporte actualizado exitosamente",
      contact: updatedContact,
    });
  } catch (error) {
    logger.error({ err: error }, "Error al actualizar contacto de soporte");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});

export const DELETE = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID del contacto es requerido" },
        { status: 400 },
      );
    }

    const { requireId } = await import("@/lib/validate-id");
    const idCheck = requireId(id);
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 });
    }

    // Verificar si el contacto existe
    const existingContact = await db.supportContact.findUnique({
      where: { id },
    });

    if (!existingContact) {
      return NextResponse.json(
        { error: "Contacto de soporte no encontrado" },
        { status: 404 },
      );
    }

    // Eliminar contacto
    await db.supportContact.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Contacto de soporte eliminado exitosamente",
    });
  } catch (error) {
    logger.error({ err: error }, "Error al eliminar contacto de soporte");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
});
