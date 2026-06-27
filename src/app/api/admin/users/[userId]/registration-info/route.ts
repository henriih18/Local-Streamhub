import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { broadcastUserUpdate, getIO } from "@/lib/socket";
import { rateLimit } from "@/lib/rate-limiter";
import { requireUUID } from "@/lib/validate-uuid";
import { z } from "zod";
import { logger } from "@/lib/logger";
export const GET = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { userId: string } },
  ) => {
    try {
      const userId = params.userId;

      const uuidCheck = requireUUID(params.userId);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }

      // Obtener información de registro de usuario
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          phone: true,
          credits: true,
          role: true,
          createdAt: true,
          telegramChatId: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 },
        );
      }

      // Obtener información de registro (sin contraseña)
      const registrationInfo = {
        fullName: user.fullName || "",
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
        credits: user.credits || 0,
        role: user.role || "USER",
        password: "",
        confirmPassword: "",
        telegramChatId: user.telegramChatId || null,
      };

      return NextResponse.json({
        registrationInfo,
        user: {
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          phone: user.phone,
          credits: user.credits,
          role: user.role,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      logger.error(
        { err: error },
        "Error al obtener la información de registro del usuario",
      );
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 },
      );
    }
  },
);

export const PUT = requireAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { userId: string } },
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
      const userId = params.userId;

      const uuidCheck = requireUUID(params.userId);
      if (!uuidCheck.valid) {
        return NextResponse.json({ error: uuidCheck.error }, { status: 400 });
      }
      const body = await request.json();

      const updateUserSchema = z
        .object({
          fullName: z
            .string()
            .min(3, "El nombre debe tener al menos 3 caracteres")
            .max(100, "Nombre demasiado largo"),
          username: z
            .string()
            .min(3, "El usuario debe tener al menos 3 caracteres")
            .max(20, "El usuario no puede exceder 20 caracteres")
            .regex(
              /^[a-zA-Z0-9_]+$/,
              "Solo se permiten letras, números y guiones bajos",
            ),
          email: z.string().email("Email no válido").max(255),
          phone: z.preprocess(
            (val) =>
              val === "" || val === null || val === undefined ? null : val,
            z
              .string()
              .min(10, "El teléfono debe tener al menos 10 caracteres")
              .max(20, "Teléfono demasiado largo")
              .regex(/^\+?[\d\s\-\(\)]+$/, "Formato de teléfono inválido")
              .nullable()
              .optional(),
          ),
          credits: z.coerce.number().min(0).max(1000000).optional(),
          role: z.enum(["USER", "ADMIN", "VENDEDOR"]),
          password: z
            .string()
            .min(8, "La contraseña debe tener al menos 8 caracteres")
            .regex(
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
              "La contraseña debe incluir mayúsculas, minúsculas y números",
            )
            .optional(),
          confirmPassword: z.string().optional(),
        })
        .refine(
          (data) => {
            if (data.password || data.confirmPassword) {
              return data.password === data.confirmPassword;
            }
            return true;
          },
          {
            message: "Las contraseñas no coinciden",
            path: ["confirmPassword"],
          },
        );

      const validation = updateUserSchema.safeParse(body);

      if (!validation.success) {
        const allErrors = validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return NextResponse.json(
          { error: "Datos inválidos", details: allErrors },
          { status: 400 },
        );
      }

      const { fullName, username, email, phone, credits, role, password } =
        validation.data;

      // Compruebe si el usuario existe
      const existingUser = await db.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 },
        );
      }

      //No permitir cambiar teléfono si está verificado por Telegram
      if (
        existingUser.telegramChatId &&
        phone &&
        phone.trim() !== existingUser.phone
      ) {
        return NextResponse.json(
          {
            error:
              "No se puede modificar el teléfono de un usuario verificado por Telegram. El teléfono fue verificado directamente con su cuenta y es inmutable.",
            code: "PHONE_LOCKED_BY_TELEGRAM",
          },
          { status: 403 },
        );
      }

      // Comprobar si el correo electrónico ya está en uso por otro usuario
      const emailExists = await db.user.findFirst({
        where: {
          email: email,
          id: { not: userId },
        },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "El email ya está en uso por otro usuario", field: "email" },
          { status: 400 },
        );
      }

      // Comprobar si el nombre de usuario ya está en uso por otro usuario
      const usernameExists = await db.user.findFirst({
        where: {
          username: username,
          id: { not: userId },
        },
      });

      if (usernameExists) {
        return NextResponse.json(
          {
            error: "El nombre de usuario ya está en uso por otro usuario",
            field: "username",
          },
          { status: 400 },
        );
      }

      // Preparar datos de actualización
      const creditsValue =
        credits !== undefined ? credits : existingUser.credits;

      const updateData: any = {
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : null,
        credits: creditsValue,
        role,
        updatedAt: new Date(),
      };

      // Agregue una contraseña para actualizar si se proporciona
      if (password) {
        updateData.password = await bcrypt.hash(password, 12);
      }

      // Actualizar usuario
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          phone: true,
          credits: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Notificar al usuario por WebSocket
      const io = getIO();
      if (io) {
        broadcastUserUpdate(io, userId, {
          fullName: updatedUser.fullName,
          username: updatedUser.username,
          email: updatedUser.email,
          phone: updatedUser.phone,
          credits: updatedUser.credits,
          role: updatedUser.role,
        });
      }

      return NextResponse.json({
        message: "Información de registro actualizada exitosamente",
        user: updatedUser,
      });
    } catch (error) {
      logger.error(
        { err: error },
        "Error al actualizar la información de registro del usuario",
      );

      // Handle specific database errors
      if (error instanceof Error) {
        if (error.message.includes("Unique constraint")) {
          return NextResponse.json(
            { error: "El email o nombre de usuario ya está en uso" },
            { status: 400 },
          );
        }
      }

      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 },
      );
    }
  },
);
