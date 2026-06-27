import { Server } from "socket.io";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { rateLimit } from "./rate-limiter";
import { logger } from "./logger";

//Helper para obtener el secret como Uint8Array
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("CRITICAL: JWT_SECRET no está definido");
  return new TextEncoder().encode(secret);
}

export const setupSocket = (io: Server) => {
  // Middleware de autenticación ANTES de io.on("connection")
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie?.match(/authToken=([^;]+)/)?.[1];

      if (!token) {
        return next(new Error("Authentication required"));
      }

      // jwtVerify de jose con algoritmo forzado
      const secret = getJwtSecret();
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        maxTokenAge: "24h",
      });

      socket.data.user = {
        userId: payload.userId as string,
        role: payload.role as string,
        email: payload.email as string,
      };
      next();
    } catch (err) {
      logger.error(
        {
          err: err,
          context: "socket_auth",
          action: "jwt_verification",
        },
        "[Socket Auth] La verificación del JWT falló.",
      );
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user;

    // Obtener IP real desde headers de Cloudflare
    const clientId =
      socket.handshake.headers["cf-connecting-ip"] ||
      socket.handshake.address ||
      "unknown";

    const limitCheck = await rateLimit({
      identifier: `socket:${clientId}`,
      limit: 50,
      windowMs: 60 * 1000,
    });

    if (!limitCheck.success) {
      logger.warn(
        { clientId, action: "rate_limit" },
        `Se ha superado el límite de tasa para ${clientId}`,
      );
      socket.disconnect(true);
      return;
    }

    // Gestionar el registro de usuarios para actualizaciones de mensajes
    socket.on("registerUser", (userId: string) => {
      if (userId !== user.userId) {
        logger.warn(
          {
            userId: user.userId,
            attemptedUserId: user.userId, // o el ID que intentó usar
            action: "register_mismatch",
            security: true,
          },
          "El usuario intentó registrarse con un ID de usuario diferente.",
        );
        socket.emit("error", { message: "Unauthorized" });
        return;
      }
      socket.join(`user:${userId}`);
    });

    // Gestionar el registro de administrador para actualizaciones en tiempo real
    socket.on("registerAdmin", () => {
      if (user.role !== "ADMIN") {
        logger.warn(
          {
            userId: user?.id || "unknown",
            email: user?.email || "unknown",
            action: "register_admin_attempt",
            security: true,
          },
          "Un usuario sin privilegios de administrador intentó registrarse como administrador.",
        );
        socket.emit("error", { message: "Unauthorized" });
        return;
      }
      socket.join("admins");
    });

    // Manejar mensajes
    socket.on("message", (msg: { text: string; senderId: string }) => {
      socket.emit("message", {
        text: `Echo: ${msg.text}`,
        senderId: "system",
        timestamp: new Date().toISOString(),
      });
    });

    // Gestionar solicitudes de estadísticas de administración
    socket.on("request-stats", async () => {
      if (user.role !== "ADMIN") {
        socket.emit("error", { message: "Unauthorized" });
        return;
      }
      try {
        const stats = await getRealTimeStats();
        socket.emit("stats-update", stats);
      } catch (error) {
        logger.error(
          {
            err: error,
            userId: user.userId,
            socketId: socket?.id || "unknown",
            context: "socket_admin",
            action: "get_stats",
          },
          "[Socket] Error al obtener estadísticas para la solicitud de administración",
        );
      }
    });

    // Manejar desconexión
    socket.on("disconnect", () => {
      // Silencioso
    });

    // Enviar mensaje de bienvenida
    socket.emit("message", {
      text: "Welcome to WebSocket Echo Server!",
      senderId: "system",
      timestamp: new Date().toISOString(),
    });
  });

  // Emitir actualizaciones de estadísticas cada 60 segundos
  setInterval(async () => {
    try {
      const stats = await getRealTimeStats();
      io.to("admins").emit("stats-update", stats);
    } catch (error) {
      logger.error(
        { err: error },
        "Error al emitir la actualización de estadísticas",
      );
    }
  }, 60000);
};

// Función para transmitir actualizaciones de stock
export const broadcastStockUpdate = (io: Server, stockData: any) => {
  io.emit("stockUpdated", stockData);
};

// Función para transmitir actualizaciones de cuenta
export const broadcastAccountUpdate = (io: Server, accountData: any) => {
  io.to("admins").emit("accountUpdated", accountData);
};

export const broadcastOrderUpdate = (io: Server, orderData: any) => {
  io.to("admins").emit("orderUpdated", orderData);
};

// Función para transmitir actualizaciones de mensajes
export const broadcastMessageUpdate = (
  io: Server,
  userId: string,
  unreadCount: number,
) => {
  io.to(`user:${userId}`).emit("messageUpdate", { unreadCount });
};

// Función para obtener la instancia de IO
export const getIO = (): Server | null => {
  return (global as any).io || null;
};

let cachedStats: any = null;
let lastStatsTime = 0;
const STATS_TTL = 60 * 1000;

async function getRealTimeStats() {
  const now = Date.now();

  if (cachedStats && now - lastStatsTime < STATS_TTL) {
    return cachedStats;
  }

  try {
    const [
      totalUsers,
      totalOrders,
      orders,
      activeUsers,
      users,
      regularAccounts,
      exclusiveAccounts,
      recentOrders,
    ] = await Promise.all([
      db.user.count(),
      db.order.count(),
      db.order.findMany({ select: { totalPrice: true } }),
      db.user.count({ where: { orders: { some: {} } } }),
      db.user.findMany({ select: { credits: true } }),
      db.streamingAccount.findMany({
        include: {
          accountStocks: { where: { isAvailable: true } },
          profileStocks: { where: { isAvailable: true } },
        },
      }),
      db.exclusiveAccount.findMany({
        include: {
          exclusiveStocks: { where: { isAvailable: true } },
        },
      }),
      db.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          streamingAccount: {
            select: { name: true, type: true },
          },
        },
      }),
    ]);

    const totalRevenue = orders.reduce(
      (sum: number, o) => sum + o.totalPrice,
      0,
    );

    const totalCredits = users.reduce((sum: number, u) => sum + u.credits, 0);

    const totalRegularStock = regularAccounts.reduce(
      (sum: number, a) =>
        sum + (a.accountStocks?.length || 0) + (a.profileStocks?.length || 0),
      0,
    );

    const totalExclusiveStock = exclusiveAccounts.reduce(
      (sum: number, a) => sum + (a.exclusiveStocks?.length || 0),
      0,
    );

    const conversionRate =
      totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    const recentActivity = recentOrders.map((order) => ({
      type: "order",
      description: `Nuevo pedido: ${
        order.streamingAccount?.name || "Producto"
      }`,
      time: getRelativeTime(order.createdAt.toISOString()),
      icon: "ShoppingCart",
    }));

    cachedStats = {
      totalUsers,
      totalOrders,
      totalRevenue,
      activeUsers,
      totalCredits,
      conversionRate,
      totalStock: totalRegularStock + totalExclusiveStock,
      recentActivity,
      timestamp: new Date().toISOString(),
    };

    lastStatsTime = now;
    return cachedStats;
  } catch (error) {
    logger.error(
      { err: error },
      "Error al obtener estadisticas en tiempo real",
    );
    throw error;
  }
}

function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

export const broadcastUserBlocked = (
  io: Server,
  userId: string,
  blockData: any,
) => {
  io.to(`user:${userId}`).emit("userBlocked", {
    userId,
    reason: blockData.reason,
    blockType: blockData.blockType,
    expiresAt: blockData.expiresAt,
    timestamp: new Date().toISOString(),
    message: "Tu cuenta ha sido bloqueada por un administrador",
  });
};

export const broadcastCreditsUpdate = (
  io: Server,
  userId: string,
  newCredits: number,
) => {
  io.to(`user:${userId}`).emit("creditsUpdated", {
    userId,
    newCredits,
    timestamp: new Date().toISOString(),
  });
};

export const broadcastUserUpdate = (
  io: Server,
  userId: string,
  userData: any,
) => {
  io.to(`user:${userId}`).emit("userUpdated", {
    userId,
    ...userData,
    timestamp: new Date().toISOString(),
  });
};
