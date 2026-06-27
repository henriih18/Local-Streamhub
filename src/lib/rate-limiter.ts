import { NextRequest } from "next/server";
import crypto from "crypto";
import { logger } from "./logger";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const inMemoryStore = new Map<string, RateLimitStore>();
const CLEANUP_INTERVAL = 10 * 60 * 1000; // limpiar cada 10 minutos

// Limpieza periódica de registros expirados
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of inMemoryStore.entries()) {
    if (record.resetTime <= now) {
      inMemoryStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

// Helper para calcular TTL restante
function getTTL(record: RateLimitStore): number {
  return Math.max(record.resetTime - Date.now(), 0);
}

// Incrementa el contador en memoria
function incrementInMemory(
  identifier: string,
  windowMs: number,
): RateLimitStore {
  const now = Date.now();
  const record = inMemoryStore.get(identifier);

  if (!record || now > record.resetTime) {
    // Nuevo registro o expirado
    const newRecord = { count: 1, resetTime: now + windowMs };
    inMemoryStore.set(identifier, newRecord);
    return newRecord;
  }

  // Incrementar contador existente
  record.count += 1;
  inMemoryStore.set(identifier, record);
  return record;
}

// Función principal de rate limiting
export async function rateLimit({
  identifier,
  limit = 10,
  windowMs = 60_000, // 1 minuto por defecto
}: {
  identifier: string;
  limit?: number;
  windowMs?: number;
}): Promise<{ success: boolean; remaining: number; resetTime: number }> {
  const record = incrementInMemory(identifier, windowMs);

  if (record.count > limit) {
    logger.warn(
      {
        identifier: identifier,
        limit: limit,
        count: record.count,
        action: "rate_limit_exceeded",
        security: true,
        
      },
      "[Rate Limit] Excedido",
    );
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  return {
    success: true,
    remaining: limit - record.count,
    resetTime: record.resetTime,
  };
}

export function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Creamos un hash para identificar de forma única pero privada al cliente
  const hashed = crypto
    .createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex");
  return hashed;
}

function getRealIP(forwarded: string | null): string {
  if (!forwarded) return "";

  // x-forwarded-for puede tener múltiples IPs: "client, proxy1, proxy2"
  // La primera es la del cliente real
  const ips = forwarded.split(",").map((ip) => ip.trim());
  const clientIP = ips[0];

  return isValidIP(clientIP) ? clientIP : "";
}

function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}
