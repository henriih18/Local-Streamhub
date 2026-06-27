"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket-client";

interface RealTimeStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  activeUsers: number;
  totalCredits: number;
  conversionRate: number;

  totalStock: number;
  recentActivity: Array<{
    type: string;
    description: string;
    time: string;
    icon: string;
  }>;
  timestamp: string;
}

export function useRealTimeStats() {
  const [stats, setStats] = useState<RealTimeStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  //const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (socket.connected) {
      setIsConnected(true);
      socket.emit("request-stats");
    }

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit("request-stats");
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = () => {
      setIsConnected(false);
    };

    const handleStatsUpdate = (newStats: RealTimeStats) => {
      setStats(newStats);
      setLastUpdate(new Date());
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleError);
    socket.on("stats-update", handleStatsUpdate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleError);
      socket.off("stats-update", handleStatsUpdate);
    };
  }, []);

  // Función de actualización manual
  /* const refreshStats = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("request-stats");
    }
  }; */
  const refreshStats = () => {
    if (socket.connected) {
      socket.emit("request-stats");
    }
  };

  return {
    stats,
    isConnected,
    lastUpdate,
    refreshStats,
  };
}
