import { io } from "socket.io-client";

export const socket = io({
  path: "/api/socketio",
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
});
