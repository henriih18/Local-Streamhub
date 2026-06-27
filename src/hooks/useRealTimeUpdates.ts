"use client";

import { useEffect } from "react";
import { socket } from "@/lib/socket-client";

interface UseRealTimeUpdatesProps {
  userId?: string;
  isAdmin?: boolean;
  onUserUpdate?: (data: any) => void;
  onStockUpdate?: (data: any) => void;
  onAccountUpdate?: (data: any) => void;
  onOrderUpdate?: (data: any) => void;
  onMessageUpdate?: (data: { unreadCount: number }) => void;
  onUserBlocked?: (data: any) => void;
  onCreditsUpdated?: (data: { newCredits: number }) => void;
}

export function useRealTimeUpdates({
  userId,
  isAdmin = false,
  onUserUpdate,
  onStockUpdate,
  onAccountUpdate,
  onOrderUpdate,
  onMessageUpdate,
  onUserBlocked,
  onCreditsUpdated,
}: UseRealTimeUpdatesProps) {
  useEffect(() => {
    const handleConnect = () => {
      if (userId) socket.emit("registerUser", userId);
      if (isAdmin) socket.emit("registerAdmin");
    };

    const handleUserUpdated = (data) => onUserUpdate?.(data);
    const handleStockUpdated = (data) => onStockUpdate?.(data);
    const handleAccountUpdated = (data) => onAccountUpdate?.(data);
    const handleOrderUpdated = (data) => onOrderUpdate?.(data);
    const handleMessageUpdate = (data) => onMessageUpdate?.(data);
    const handleUserBlocked = (data) => onUserBlocked?.(data);
    const handleCreditsUpdated = (data) => onCreditsUpdated?.(data);

    socket.on("connect", handleConnect);
    socket.on("userUpdated", handleUserUpdated);
    socket.on("stockUpdated", handleStockUpdated);
    socket.on("accountUpdated", handleAccountUpdated);
    socket.on("orderUpdated", handleOrderUpdated);
    socket.on("messageUpdate", handleMessageUpdate);
    socket.on("userBlocked", handleUserBlocked);
    socket.on("creditsUpdated", handleCreditsUpdated);

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("userUpdated", handleUserUpdated);
      socket.off("stockUpdated", handleStockUpdated);
      socket.off("accountUpdated", handleAccountUpdated);
      socket.off("orderUpdated", handleOrderUpdated);
      socket.off("messageUpdate", handleMessageUpdate);
      socket.off("userBlocked", handleUserBlocked);
      socket.off("creditsUpdated", handleCreditsUpdated);
    };
  }, [
    userId,
    isAdmin,
    onUserUpdate,
    onStockUpdate,
    onAccountUpdate,
    onOrderUpdate,
    onMessageUpdate,
    onUserBlocked,
    onCreditsUpdated,
  ]);

  return {
    isConnected: socket.connected,
  };
}
