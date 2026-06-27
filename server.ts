// server.ts - Servidor Next.js Standalone + Socket.IO
import { setupSocket } from "./src/lib/socket";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { logger } from "./src/lib/logger";

const dev = process.env.NODE_ENV !== "production";
const currentPort = 3000;
//const hostname = "127.0.0.1";
const hostname =
  process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

// Servidor personalizado con integración Socket.IO
async function createCustomServer() {
  try {
    // Crear aplicación Next.js
    const nextApp = next({
      dev,
      dir: process.cwd(),
      // En producción, usar el directorio actual donde se encuentra .next
      conf: dev ? undefined : { distDir: "./.next" },
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    // Crear servidor HTTP que manejará tanto Next.js como Socket.IO
    const server = createServer((req, res) => {
      // FIX: Ocultar versión del servidor
      res.removeHeader("X-Powered-By");
      res.setHeader("Server", "");

      // Omitir solicitudes socket.io del manejador de Next.js
      if (req.url?.startsWith("/api/socketio")) {
        return;
      }

      // ← NUEVO: Log automático al finalizar cada petición HTTP
      res.on("finish", () => {
        const start = (req as any)._start || Date.now();
        const duration = Date.now() - start;
        const level =
          res.statusCode >= 500
            ? "error"
            : res.statusCode >= 400
              ? "warn"
              : "info";

        logger[level](
          {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip:
              req.socket?.remoteAddress ||
              req.headers["x-forwarded-for"] ||
              "unknown",
          },
          "HTTP Request",
        );
      });

      // ← NUEVO: Guardar timestamp de inicio para calcular duración
      (req as any)._start = Date.now();

      handle(req, res);
    });

    // Configurar Socket.IO
    const allowedOrigins =
      process.env.NODE_ENV === "production"
        ? ["https://riyostream.com"]
        : ["http://localhost:3000"];

    const io = new Server(server, {
      path: "/api/socketio",
      transports: ["websocket"],
      //allowEIO3: true,
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
      },

      ...(process.env.NODE_ENV === "production" && {
        maxHttpBufferSize: 1e6, // Limitar tamaño de mensajes a 1MB
        pingTimeout: 60000, // Timeout de ping: 60 segundos
        pingInterval: 25000, // Intervalo de ping: 25 segundos
      }),
    });

    // ← NUEVO: Logging básico de conexiones Socket.IO
    io.on("connection", (socket) => {
      logger.info({ socketId: socket.id }, "Socket connected");
      socket.on("disconnect", () => {
        logger.info({ socketId: socket.id }, "Socket disconnected");
      });
    });

    setupSocket(io);

    // Exportar instancia IO para rutas API
    (global as any).io = io;

    // Iniciar servidor
    server.listen(currentPort, hostname, () => {
      logger.info({ port: currentPort, hostname }, "Server ready");
      logger.info({ path: "/api/socketio" }, "Socket.IO server running");
    });
  } catch (err) {
    logger.fatal({ err }, "Server startup error");
    process.exit(1);
  }
}

// Iniciar servidor
createCustomServer();
