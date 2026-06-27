import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { logger } from "./lib/logger";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("CRITICAL: JWT_SECRET no está definido");
  return new TextEncoder().encode(secret);
}

// =========================
// NONCE GENERATOR
// =========================
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

// CSP BUILDER

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // Desarrollo: relajado para HMR + React DevTools
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' ws: wss: http://localhost:*",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
  }

  const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "www.riyostream.com";

  // Producción: CSP estricta con nonces
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    //"connect-src 'self' https://www.riyostream.com wss://www.riyostream.com",
    `connect-src 'self' https://${DOMAIN} wss://${DOMAIN}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function isRouteMatch(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

// =========================
// RUTAS
// =========================
const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const staticRoutes = [
  "/_next/static",
  "/_next/image",
  "/favicon.ico",
  "/images",
];

const protectedRoutes = [
  "/account",
  "/dashboard",
  "/profile",
  "/orders",
  "/support",
  "/admin",
];

const protectedApiRoutes = [
  "/api/admin",
  "/api/orders",
  "/api/cart",
  "/api/checkout",
  "/api/exclusive-cart",
  "/api/messages",
  "/api/credit-recharge",
  "/api/expenses",
  "/api/user",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generar nonce por petición
  const nonce = generateNonce();

  // Pasar nonce al layout vía request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // -------------------------
  // Permitir rutas públicas y estáticas
  // -------------------------

  if (
    isRouteMatch(pathname, publicRoutes) ||
    isRouteMatch(pathname, staticRoutes)
  ) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    addSecurityHeaders(response, nonce);
    return response;
  }

  // -------------------------
  // Obtener token
  // -------------------------
  const token =
    request.cookies.get("authToken")?.value ||
    request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    const requiresAuth =
      isRouteMatch(pathname, protectedRoutes) ||
      isRouteMatch(pathname, protectedApiRoutes);
    if (requiresAuth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("message", "auth_required");
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("authToken");
      addSecurityHeaders(response, nonce);
      return response;
    }

    // FIX H-02: Antes no se añadían security headers aquí.
    // Ahora TODAS las respuestas llevan headers de seguridad.
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    addSecurityHeaders(response, nonce);
    return response;
  }

  // -------------------------
  // Validar JWT
  // -------------------------
  try {
    const secret = getJwtSecret();
    // jwtVerify de jose (es async)
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      maxTokenAge: "24h",
    });

    // +extraer de payload
    const userId = payload.userId as string;
    const email = payload.email as string;
    const role = payload.role as string;

    if (!userId || !email || !role) {
      logger.warn(
        {
          action: "validate_token",
          reason: "invalid_structure",
        },
        "Token inválido: estructura incorrecta",
      );
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("authToken");
      addSecurityHeaders(response, nonce);
      return response;
    }

    if (
      (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
      role !== "ADMIN" //usar variable en lugar de decoded.role
    ) {
      logger.warn(
        {
          role: role,
          action: "admin_access_attempt",
          security: true,
        },
        `Usuario con rol ${role} intentó acceder a zona admin`,
      );
      if (pathname.startsWith("/api/")) {
        const response = NextResponse.json(
          { error: "Forbidden" },
          { status: 403 },
        );
        addSecurityHeaders(response, nonce);
        return response;
      }

      const response = NextResponse.redirect(new URL("/account", request.url));
      addSecurityHeaders(response, nonce);
      return response;
    }

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    addSecurityHeaders(response, nonce);
    return response;
  } catch (error) {
    const err = error as Error;
    logger.error(
      {
        err: error,
        path: pathname,
        context: "auth_middleware",
      },
      "Error del middleware de autenticación",
    );
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("authToken");
    addSecurityHeaders(response, nonce);
    return response;
  }
}

// =========================
// Encabezados de seguridad
// =========================
function addSecurityHeaders(response: NextResponse, nonce: string) {
  // CSP con nonce
  response.headers.set("Content-Security-Policy", buildCsp(nonce));

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  //response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Referrer-Policy", "no-referrer");

  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  );
}

// =========================
// Configuración de matcher
// =========================
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/socketio).*)"],
};
