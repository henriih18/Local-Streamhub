"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast-custom";
import {
  AlertTriangle,
  Ban,
  Unlock,
  MessageSquare,
  Clock,
  Calendar,
  User,
  Mail,
  CheckCircle,
  XCircle,
  Info,
  History,
  Send,
  Shield,
  Timer,
  UserX,
  UserCheck,
  Bell,
  BellOff,
  Settings,
  ShoppingBag,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  isBlocked: boolean;
  blockExpiresAt?: string | null;
  blockReason?: string | null;
  createdAt: string;
  _count: {
    orders: number;
  };
}

interface UserWarning {
  id: string;
  message: string;
  reason: string;
  severity: string;
  isActive: boolean;
  createdAt: string;
}

interface UserBlock {
  id: string;
  blockType: string;
  duration?: string;
  reason: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string | null;
}

interface PermissionManagerProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

export default function PermissionManager({
  user,
  isOpen,
  onClose,
  onActionComplete,
}: PermissionManagerProps) {
  const [activeTab, setActiveTab] = useState("actions");
  const [loading, setLoading] = useState(false);
  const [warningLoading, setWarningLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [warnings, setWarnings] = useState<UserWarning[]>([]);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states
  const [warningData, setWarningData] = useState({
    message: "",
    reason: "",
    severity: "MEDIUM",
    notifyUser: true,
  });

  const [blockData, setBlockData] = useState({
    blockType: "temporary",
    duration: "24",
    reason: "",
    notifyUser: true,
  });

  const [unblockData, setUnblockData] = useState({
    reason: "",
    notifyUser: true,
  });

  useEffect(() => {
    if (isOpen && user) {
      fetchUserHistory();
    }
  }, [isOpen, user]);

  const fetchUserHistory = async () => {
    setLoadingHistory(true);
    try {
      const [warningsRes, blocksRes] = await Promise.all([
        fetch(`/api/admin/users/${user.id}/warnings`, {
          credentials: "include",
        }),
        fetch(`/api/admin/users/${user.id}/blocks`, { credentials: "include" }),
      ]);

      if (warningsRes.ok && blocksRes.ok) {
        const warningsData = await warningsRes.json();
        const blocksData = await blocksRes.json();
        setWarnings(warningsData);
        setBlocks(blocksData);
      }
    } catch (error) {
      //console.error("Error fetching user history:", error);
      toast.error("Error al cargar historial del usuario");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleWarning = async () => {
    if (!warningData.message.trim() || !warningData.reason.trim()) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setWarningLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/warn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(warningData),
      });

      if (response.ok) {
        toast.success("Advertencia enviada correctamente");
        setWarningData({
          message: "",
          reason: "",
          severity: "MEDIUM",
          notifyUser: true,
        });
        fetchUserHistory();
        onActionComplete();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al enviar advertencia");
      }
    } catch (error) {
      toast.error("Error al enviar advertencia");
    } finally {
      setWarningLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!blockData.reason.trim()) {
      toast.error("Por favor especifica el motivo del bloqueo");
      return;
    }

    if (blockData.blockType === "temporary" && !blockData.duration) {
      toast.error("Por favor especifica la duración del bloqueo");
      return;
    }

    setBlockLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(blockData),
      });

      if (response.ok) {
        toast.success("Usuario bloqueado correctamente");
        setBlockData({
          blockType: "temporary",
          duration: "24",
          reason: "",
          notifyUser: true,
        });
        fetchUserHistory();
        onActionComplete();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al bloquear usuario");
      }
    } catch (error) {
      toast.error("Error al bloquear usuario");
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!unblockData.reason.trim()) {
      toast.error("Por favor especifica el motivo del desbloqueo");
      return;
    }

    setUnblockLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/unblock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unblockData),
      });

      if (response.ok) {
        toast.success("Usuario desbloqueado correctamente");
        setUnblockData({ reason: "", notifyUser: true });
        fetchUserHistory();
        onActionComplete();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al desbloquear usuario");
      }
    } catch (error) {
      toast.error("Error al desbloquear usuario");
    } finally {
      setUnblockLoading(false);
    }
  };

  const getActiveBlock = () => {
    return blocks.find((block) => block.isActive);
  };

  const getBlockStatusColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-900/50 text-red-300 border-red-800/50";
      case "MEDIUM":
        return "bg-yellow-900/50 text-yellow-300 border-yellow-800/50";
      case "LOW":
        return "bg-blue-900/50 text-blue-300 border-blue-800/50";
      default:
        return "bg-gray-800/50 text-gray-300 border-gray-700/50";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const activeBlock = getActiveBlock();
  const totalWarnings = warnings.filter((w) => w.isActive).length;
  const totalBlocks = blocks.filter((b) => b.isActive).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-2 text-white text-lg sm:text-xl">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <span className="flex-wrap">
              Gestión de Permisos - {user.name || user.email}
            </span>
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Administra advertencias, bloqueos y permisos del usuario
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-1 overflow-x-auto">
            <TabsList className="grid w-full grid-cols-3 gap-1 bg-transparent h-auto p-0 min-w-0">
              <TabsTrigger
                value="actions"
                className="flex flex-col items-center justify-center gap-1 text-slate-300 data-[state=active]:bg-slate-600 h-auto py-2 px-1 text-xs min-w-0"
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline text-white">Acciones</span>
                <span className="sm:hidden text-white">Acciones</span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="flex flex-col items-center justify-center gap-1 text-slate-300 data-[state=active]:bg-slate-600 h-auto py-2 px-1 text-xs min-w-0"
              >
                <History className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline text-white">Historial</span>
                <span className="sm:hidden text-white">Historial</span>
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="flex flex-col items-center justify-center gap-1 text-slate-300 data-[state=active]:bg-slate-600 h-auto py-2 px-1 text-xs min-w-0"
              >
                <Info className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline text-white">
                  Estadísticas
                </span>
                <span className="sm:hidden text-white">Estadisticas</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="actions" className="flex-1">
            <ScrollArea className="h-[400px]">
              <div className="space-y-6">
                {/* User Status */}
                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">
                      Estado Actual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-300" />
                        <span className="text-sm text-slate-300">
                          {user.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.isBlocked ? (
                          <>
                            <Ban className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">
                              Bloqueado
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-green-400">
                              Activo
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-slate-300">
                          {totalWarnings} advertencias activas
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-slate-300">
                          {totalBlocks} bloqueos activos
                        </span>
                      </div>
                    </div>
                    {activeBlock && (
                      <div className="mt-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
                        <div className="flex items-center gap-2 text-red-300">
                          <Timer className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            Bloqueo activo:{" "}
                            {activeBlock.blockType === "permanent"
                              ? "Permanente"
                              : `${activeBlock.duration} horas`}
                          </span>
                        </div>
                        <p className="text-xs text-red-400 mt-1">
                          {activeBlock.reason}
                        </p>
                        {activeBlock.expiresAt && (
                          <p className="text-xs text-red-400 mt-1">
                            Expira: {formatDate(activeBlock.expiresAt)}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Acción de advertencia */}
                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-white">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      Enviar Advertencia
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Envía una advertencia al usuario con un mensaje
                      personalizado
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label
                        htmlFor="warningMessage"
                        className="text-slate-300"
                      >
                        Mensaje para el usuario
                      </Label>
                      <Textarea
                        id="warningMessage"
                        placeholder="Escribe el mensaje que recibirá el usuario..."
                        value={warningData.message}
                        onChange={(e) =>
                          setWarningData({
                            ...warningData,
                            message: e.target.value,
                          })
                        }
                        rows={3}
                        className="bg-slate-600 border-slate-500 text-white placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <Label htmlFor="warningReason" className="text-slate-300">
                        Motivo interno
                      </Label>
                      <Input
                        id="warningReason"
                        placeholder="Motivo de la advertencia (para registro interno)..."
                        value={warningData.reason}
                        onChange={(e) =>
                          setWarningData({
                            ...warningData,
                            reason: e.target.value,
                          })
                        }
                        className="bg-slate-600 border-slate-500 text-white placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="warningSeverity"
                        className="text-slate-300"
                      >
                        Severidad
                      </Label>
                      <Select
                        value={warningData.severity}
                        onValueChange={(value) =>
                          setWarningData({ ...warningData, severity: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="LOW" className="text-slate-300">
                            Baja
                          </SelectItem>
                          <SelectItem value="MEDIUM" className="text-slate-300">
                            Media
                          </SelectItem>
                          <SelectItem value="HIGH" className="text-slate-300">
                            Alta
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="warningNotify"
                        checked={warningData.notifyUser}
                        onChange={(e) =>
                          setWarningData({
                            ...warningData,
                            notifyUser: e.target.checked,
                          })
                        }
                      />
                      <Label
                        htmlFor="warningNotify"
                        className="flex items-center gap-2 text-slate-300"
                      >
                        <Bell className="w-4 h-4 text-yellow-400" />
                        Notificar al usuario por mensaje interno
                      </Label>
                    </div>
                    <Button
                      onClick={handleWarning}
                      disabled={warningLoading}
                      className="w-full"
                    >
                      {warningLoading ? (
                        <>Enviando...</>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar Advertencia
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Accion de bloqueo */}
                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-white">
                      <Ban className="w-5 h-5 text-red-400" />
                      Bloquear Usuario
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Bloquea el acceso del usuario a la plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="blockType" className="text-slate-300">
                        Tipo de bloqueo
                      </Label>
                      <Select
                        value={blockData.blockType}
                        onValueChange={(value) =>
                          setBlockData({ ...blockData, blockType: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem
                            value="temporary"
                            className="text-slate-300"
                          >
                            Temporal
                          </SelectItem>
                          <SelectItem
                            value="permanent"
                            className="text-slate-300"
                          >
                            Permanente
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {blockData.blockType === "temporary" && (
                      <div>
                        <Label
                          htmlFor="blockDuration"
                          className="text-slate-300"
                        >
                          Duración (horas)
                        </Label>
                        <Select
                          value={blockData.duration}
                          onValueChange={(value) =>
                            setBlockData({ ...blockData, duration: value })
                          }
                        >
                          <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-700 border-slate-600">
                            <SelectItem value="1" className="text-slate-300">
                              1 hora
                            </SelectItem>
                            <SelectItem value="6" className="text-slate-300">
                              6 horas
                            </SelectItem>
                            <SelectItem value="12" className="text-slate-300">
                              12 horas
                            </SelectItem>
                            <SelectItem value="24" className="text-slate-300">
                              24 horas
                            </SelectItem>
                            <SelectItem value="48" className="text-slate-300">
                              48 horas
                            </SelectItem>
                            <SelectItem value="72" className="text-slate-300">
                              72 horas
                            </SelectItem>
                            <SelectItem value="168" className="text-slate-300">
                              1 semana
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label htmlFor="blockReason" className="text-slate-300">
                        Motivo del bloqueo
                      </Label>
                      <Textarea
                        id="blockReason"
                        placeholder="Describe el motivo del bloqueo..."
                        value={blockData.reason}
                        onChange={(e) =>
                          setBlockData({ ...blockData, reason: e.target.value })
                        }
                        rows={3}
                        className="bg-slate-600 border-slate-500 text-white placeholder-slate-400"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="blockNotify"
                        checked={blockData.notifyUser}
                        onChange={(e) =>
                          setBlockData({
                            ...blockData,
                            notifyUser: e.target.checked,
                          })
                        }
                      />
                      <Label
                        htmlFor="blockNotify"
                        className="flex items-center gap-2 text-slate-300"
                      >
                        <Bell className="w-4 h-4 text-yellow-400" />
                        Notificar al usuario por mensaje interno
                      </Label>
                    </div>
                    <Button
                      onClick={handleBlock}
                      disabled={blockLoading || user.isBlocked}
                      className="w-full"
                      variant="destructive"
                    >
                      {blockLoading ? (
                        <>Bloqueando...</>
                      ) : (
                        <>
                          <Ban className="w-4 h-4 mr-2" />
                          {user.isBlocked
                            ? "Usuario ya está bloqueado"
                            : "Bloquear Usuario"}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Acciones de desbloqueo */}
                {user.isBlocked && (
                  <Card className="bg-slate-700 border-slate-600">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 font-semibold text-white">
                        <Unlock className="w-5 h-5 text-green-400" />
                        Desbloquear Usuario
                      </CardTitle>
                      <CardDescription className="text-slate-300">
                        Restablece el acceso del usuario a la plataforma
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label
                          className="font-semibold text-white"
                          htmlFor="unblockReason"
                        >
                          Motivo del desbloqueo
                        </Label>
                        <Textarea
                          className="text-slate-200"
                          id="unblockReason"
                          placeholder="Describe el motivo del desbloqueo..."
                          value={unblockData.reason}
                          onChange={(e) =>
                            setUnblockData({
                              ...unblockData,
                              reason: e.target.value,
                            })
                          }
                          rows={3}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="unblockNotify"
                          checked={unblockData.notifyUser}
                          onChange={(e) =>
                            setUnblockData({
                              ...unblockData,
                              notifyUser: e.target.checked,
                            })
                          }
                        />
                        <Label
                          htmlFor="unblockNotify"
                          className="flex items-center gap-2"
                        >
                          <Bell className="w-4 h-4 font-semibold text-yellow-400" />
                          Notificar al usuario por mensaje interno
                        </Label>
                      </div>
                      <Button
                        onClick={handleUnblock}
                        disabled={unblockLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {unblockLoading ? (
                          <>Desbloqueando...</>
                        ) : (
                          <>
                            <Unlock className="w-4 h-4 mr-2" />
                            Desbloquear Usuario
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1">
            <ScrollArea className="h-[400px]">
              <div className="space-y-6 bg-slate-800">
                {/* Warnings History */}
                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 font-semibold text-white">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      Historial de Advertencias ({warnings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingHistory ? (
                      <div className="text-center py-4">
                        Cargando historial...
                      </div>
                    ) : warnings.length === 0 ? (
                      <div className="text-center py-4 text-slate-300">
                        No hay advertencias registradas
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {warnings.map((warning) => (
                          <div
                            key={warning.id}
                            className="p-3 border rounded-lg"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge
                                    className={getBlockStatusColor(
                                      warning.severity,
                                    )}
                                  >
                                    {warning.severity}
                                  </Badge>
                                  {warning.isActive ? (
                                    <Badge className="bg-green-800/50 text-green-300 border-green-700/50">
                                      Activa
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">Inactiva</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-300 mb-1">
                                  {warning.message}
                                </p>
                                <p className="text-xs text-slate-300 mb-2">
                                  Motivo: {warning.reason}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(warning.createdAt)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Historial de bloqueos */}
                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 font-semibold text-white">
                      <Ban className="w-5 h-5 text-red-400" />
                      Historial de Bloqueos ({blocks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingHistory ? (
                      <div className="text-center py-4">
                        Cargando historial...
                      </div>
                    ) : blocks.length === 0 ? (
                      <div className="text-center py-4 text-slate-300">
                        No hay bloqueos registrados
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {blocks.map((block) => (
                          <div key={block.id} className="p-3 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge
                                    className={
                                      block.isActive
                                        ? "bg-red-800/50 text-red-300 border-red-700/50"
                                        : "bg-gray-800/50 text-gray-300 border-gray-700/50"
                                    }
                                  >
                                    {block.blockType === "permanent"
                                      ? "Permanente"
                                      : `${block.duration} horas`}
                                  </Badge>
                                  {block.isActive ? (
                                    <Badge className="bg-red-800/50 text-red-300 border-red-700/50">
                                      Activo
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">Inactivo</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-300 mb-2">
                                  {block.reason}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-300">
                                  <div className="flex items-center gap-1 ">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(block.createdAt)}
                                  </div>
                                  {block.expiresAt && (
                                    <div className="flex items-center gap-1">
                                      <Timer className="w-3 h-3" />
                                      Expira: {formatDate(block.expiresAt)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stats" className="flex-1">
            <ScrollArea className="h-[400px]">
              <div className="space-y-6">
                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-white">
                      Resumen de Permisos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-yellow-900/30 border border-yellow-800/50 rounded-lg">
                        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-yellow-300">
                          {totalWarnings}
                        </div>
                        <div className="text-sm text-yellow-400">
                          Advertencias Activas
                        </div>
                      </div>
                      <div className="text-center p-4 bg-red-900/30 border border-red-800/50 rounded-lg">
                        <Ban className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-red-300">
                          {totalBlocks}
                        </div>
                        <div className="text-sm text-red-400">
                          Bloqueos Activos
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-white">
                      Información del Usuario
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 font-semibold text-slate-300" />
                        <span className="text-sm text-slate-300">
                          Email: {user.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 font-semibold text-white" />
                        <span className="text-sm text-slate-300">
                          Pedidos: {user._count.orders}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 font-semibold text-white" />
                        <span className="text-sm text-slate-300">
                          Miembro desde: {formatDate(user.createdAt)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
