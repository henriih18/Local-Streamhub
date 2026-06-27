import { NextRequest } from "next/server";
import { jwtVerify, errors } from "jose";
import { db } from "@/lib/db";
import { logger } from "./logger";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("CRITICAL: JWT_SECRET no está definido");
  }

  return new TextEncoder().encode(secret);
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    role: string;
  } | null;
  error?: string;
}

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export const auth = async (request: NextRequest): Promise<AuthResult> => {
  try {
    // Cookie
    const token =
      request.cookies.get("authToken")?.value ||
      request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return { user: null };

    const JWT_SECRET = getJwtSecret();

    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      maxTokenAge: "24h",
    });

    const userId = payload.userId as string;

    if (!userId) {
      return { user: null, error: "Token inválido" };
    }

    // DB
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isBlocked: true,
        tokenVersion:true,
      },
    });

    if (!user) return { user: null, error: "Usuario no existe" };
    if (!user.isActive) return { user: null, error: "Cuenta inactiva" };
    if (user.isBlocked) return { user: null, error: "Cuenta bloqueada" };

    if ((payload as any).tokenVersion !== user.tokenVersion) {
      return { user: null, error: "Sesión revocada" };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return { user: null, error: "Token expirado" };
    }

    logger.error({ err: error }, "Error de autenticacion");
    return { user: null, error: "Credenciales inválidas" };
  }
};

export function requireAuth(
  handler: (
    req: NextRequest,
    user: AuthUser,
    context: { params: any },
  ) => Promise<Response>,
) {
  return async (req: NextRequest, context: { params: any }) => {
    const { user, error } = await auth(req);

    if (!user) {
      return new Response(JSON.stringify({ error: error ?? "No autorizado" }), {
        status: 401,
      });
    }

    //reenviamos context (donde vive params)
    return handler(req, user, context);
  };
}

export function requireAdmin(
  handler: (
    req: NextRequest,
    user: AuthUser,
    context: { params: any },
  ) => Promise<Response>,
) {
  return requireAuth(
    async (req: NextRequest, user: AuthUser, context: { params: any }) => {
      if (user.role !== "ADMIN") {
        return new Response(
          JSON.stringify({ error: "Acceso solo para administradores" }),
          { status: 403 },
        );
      }

      //reenviamos context
      return handler(req, user, context);
    },
  );
}

export function optionalAuth(
  handler: (
    req: NextRequest,
    user: AuthUser | null,
    context: { params: any },
  ) => Promise<Response>,
) {
  return async (req: NextRequest, context: { params: any }) => {
    const { user } = await auth(req);
    // Permitir acceso con o sin usuario
    return handler(req, user, context);
  };
}
