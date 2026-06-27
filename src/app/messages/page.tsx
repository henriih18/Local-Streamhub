"use client";

import { useState, useEffect } from "react";
import Navigation from "@/components/navigation";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Bell,
  Check,
  Trash2,
  AlertTriangle,
  Shield,
  Ban,
  Unlock,
  Zap,
} from "lucide-react";
import { toast } from "@/components/ui/toast-custom";
import { logger } from "@/lib/logger";

interface Message {
  id: string;
  title: string;
  content: string;
  type:
    | "GENERAL"
    | "WARNING"
    | "BLOCK_NOTICE"
    | "UNBLOCK_NOTICE"
    | "RESTRICTION_NOTICE"
    | "SYSTEM_NOTIFICATION";
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
}

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [user, setUser] = useState<any>(null);

  const [cartItems, setCartItems] = useState<any[]>([]);

  const loadCartItems = async () => {
    try {
      const response = await fetch(`/api/cart`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCartItems(data.items || []);
      }
    } catch (error) {
      //logger.error({err: error},"Error al cargar articulos del carrito");
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch("/api/messages", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        const messages = data.messages || [];

        setMessages(messages);
      } else {
      }
    } catch (error) {
      toast.error("Error al cargar los mensajes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Obtner usuario de localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchMessages();
      loadCartItems();
    }
  }, [user]);

  // Escuchar evento de login exitoso
  useEffect(() => {
    const handleUserLogin = (event: Event) => {
      const customEvent = event as CustomEvent<{
        id: string;
        email: string;
        role: string;
        [key: string]: any;
      }>;
      if (customEvent.detail) {
        setUser(customEvent.detail);
        localStorage.setItem("user", JSON.stringify(customEvent.detail));

        // Cargar mensajes y carrito cuando el usuario inicia sesión
        fetchMessages();
        loadCartItems();
      }
    };

    window.addEventListener("userLoggedIn", handleUserLogin);

    return () => {
      window.removeEventListener("userLoggedIn", handleUserLogin);
    };
  }, []);

  // Escuchar evento de logout
  useEffect(() => {
    const handleUserLogout = () => {
      setUser(null);
      setMessages([]);
      setCartItems([]);
      localStorage.removeItem("user");
    };

    window.addEventListener("userLogout", handleUserLogout);

    return () => {
      window.removeEventListener("userLogout", handleUserLogout);
    };
  }, []);

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
  };

  const markAsRead = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead: true }),
      });

      if (response.ok) {
        // Cargar localStorage
        setMessages(
          messages.map((msg) =>
            msg.id === messageId ? { ...msg, isRead: true } : msg,
          ),
        );

        // Actualizar el mensaje seleccionado si es el que está marcado como leído
        if (selectedMessage?.id === messageId) {
          setSelectedMessage((prev) =>
            prev ? { ...prev, isRead: true } : null,
          );
        }

        window.dispatchEvent(new CustomEvent("messagesUpdated"));

        // Mostrar comentarios de éxito
        toast.success("Mensaje marcado como leído");
      } else {
        let errorMessage = "Error al marcar mensaje como leído";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {}
        }

        toast.error(`Error ${response.status}: ${errorMessage}`);
      }
    } catch (error) {
      toast.error("Error de conexión al marcar como leído");
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadMessages = messages.filter((msg) => !msg.isRead);

      await Promise.all(
        unreadMessages.map((msg) =>
          fetch(`/api/messages/${msg.id}`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isRead: true }),
          }),
        ),
      );
      setMessages(messages.map((msg) => ({ ...msg, isRead: true })));
      toast.success("Todos los mensajes marcados como leídos");

      window.dispatchEvent(new CustomEvent("messagesUpdated"));
    } catch (error) {
      toast.error("Error al marcar todos los mensajes como leídos");
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setMessages(messages.filter((msg) => msg.id !== messageId));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
      toast.success("Mensaje eliminado");

      window.dispatchEvent(new CustomEvent("messagesUpdated"));
    } catch (error) {
      toast.error("Error al eliminar mensaje");
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "WARNING":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "BLOCK_NOTICE":
        return <Ban className="w-5 h-5 text-red-500" />;
      case "UNBLOCK_NOTICE":
        return <Unlock className="w-5 h-5 text-green-500" />;
      case "RESTRICTION_NOTICE":
        return <Shield className="w-5 h-5 text-orange-500" />;
      case "SYSTEM_NOTIFICATION":
        return <Bell className="w-5 h-5 text-blue-500" />;
      default:
        return <MessageSquare className="w-5 h-5 text-slate-500" />;
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case "WARNING":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "BLOCK_NOTICE":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "UNBLOCK_NOTICE":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "RESTRICTION_NOTICE":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "SYSTEM_NOTIFICATION":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const unreadCount = messages.filter((msg) => !msg.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-6">
          {/* Icono animado con temática de mensaje */}
          <div className="relative">
            <div className="w-24 h-24 relative">
              {/* Outer rotating message bubble */}
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-2xl animate-spin-slow"></div>
              <div className="absolute inset-2 border-4 border-transparent border-t-blue-500 border-r-cyan-500 rounded-2xl animate-spin"></div>

              {/* Icono de mensaje en el centro */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <MessageSquare className="w-12 h-12 text-blue-400 animate-pulse" />
                  {/* Puntos animados dentro del mensaje */}
                  <div className="absolute inset-0 flex items-center justify-center space-x-1">
                    <div
                      className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: "200ms" }}
                    ></div>
                    <div
                      className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: "400ms" }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Indicadores de mensajes en órbita */}
              <div className="absolute inset-0 animate-spin-slow-reverse">
                <div className="absolute top-0 left-1/2 w-3 h-3 bg-blue-400 rounded-full transform -translate-x-1/2 -translate-y-1.5 flex items-center justify-center">
                  <Bell className="w-2 h-2 text-white" />
                </div>
                <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-cyan-400 rounded-full transform -translate-x-1/2 translate-y-1.5 flex items-center justify-center">
                  <MessageSquare className="w-2 h-2 text-white" />
                </div>
                <div className="absolute left-0 top-1/2 w-3 h-3 bg-indigo-400 rounded-full transform -translate-y-1/2 -translate-x-1.5 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                <div className="absolute right-0 top-1/2 w-3 h-3 bg-purple-400 rounded-full transform -translate-y-1/2 translate-x-1.5 flex items-center justify-center">
                  <Zap className="w-2 h-2 text-white" />
                </div>
              </div>

              {/* Pulso de notificación */}
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping">
                <div className="w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center space-y-3">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 animate-pulse">
              Mensajes
            </h1>
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1">
                <div
                  className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
              <span className="text-slate-300 text-lg font-medium">
                Cargando mensajes
              </span>
              <div className="flex space-x-1">
                <div
                  className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: "450ms" }}
                ></div>
                <div
                  className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce"
                  style={{ animationDelay: "600ms" }}
                ></div>
                <div
                  className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "750ms" }}
                ></div>
              </div>
            </div>
            <p className="text-slate-500 text-sm">
              Recibiendo tus notificaciones...
            </p>
          </div>

          {/* Barra de progreso del mensaje */}
          <div className="w-80 h-2 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 rounded-full animate-pulse-slow relative overflow-hidden"
              style={{
                width: "70%",
                animation: "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
          </div>

          {/* Indicadores de mensajes flotantes */}
          <div className="flex space-x-4">
            <div
              className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center animate-float"
              style={{ animationDelay: "0ms" }}
            >
              <MessageSquare className="w-4 h-4 text-blue-400" />
            </div>
            <div
              className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center animate-float"
              style={{ animationDelay: "500ms" }}
            >
              <Bell className="w-4 h-4 text-cyan-400" />
            </div>
            <div
              className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center animate-float"
              style={{ animationDelay: "1000ms" }}
            >
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
        </div>

        {/* Estilos personalizados */}
        <style jsx>{`
          @keyframes spin-slow {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          @keyframes spin-slow-reverse {
            from {
              transform: rotate(360deg);
            }
            to {
              transform: rotate(0deg);
            }
          }
          @keyframes pulse-slow {
            0%,
            100% {
              opacity: 0.5;
            }
            50% {
              opacity: 1;
            }
          }
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          @keyframes float {
            0%,
            100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          .animate-spin-slow {
            animation: spin-slow 4s linear infinite;
          }
          .animate-spin-slow-reverse {
            animation: spin-slow-reverse 3s linear infinite;
          }
          .animate-pulse-slow {
            animation: pulse-slow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          .animate-shimmer {
            animation: shimmer 2s infinite;
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <Navigation
        user={user}
        cartItemsCount={(cartItems || []).length}
        /* onCartOpen={() => setIsCartOpen(true)} */

        onCartOpen={() => {}}
        onLogin={() => {}}
        /* onLogout={() => {
          setUser(null);
          localStorage.removeItem("user");
        }} */
        onLogout={async () => {
          try {
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
            });
          } catch (error) {
            //logger.error({ err: error }, "Error al cerrar sesión");
          }
          setUser(null);
          setMessages([]);
          setCartItems([]);
          localStorage.removeItem("user");
          localStorage.removeItem("tokenExpiresAt");
          window.dispatchEvent(new CustomEvent("userLogout"));
          router.push("/");
        }}
        showCart={false}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Mensajes</h1>
            <p className="text-slate-400">
              {unreadCount > 0
                ? `${unreadCount} mensaje${
                    unreadCount > 1 ? "s" : ""
                  } no leído${unreadCount > 1 ? "s" : ""}`
                : "No hay mensajes nuevos"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Marcar todos como leídos
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Lista de mensajes */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Todos los mensajes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  {messages.length === 0 ? (
                    <div className="p-8 text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-500 opacity-50" />
                      <p className="text-slate-400">No tienes mensajes</p>
                    </div>
                  ) : (
                    <div className="space-y-2 p-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-4 rounded-lg cursor-pointer transition-colors ${
                            selectedMessage?.id === message.id
                              ? "bg-slate-700 border border-slate-600"
                              : !message.isRead
                                ? "bg-slate-700/50 border border-slate-700/50 hover:bg-slate-700"
                                : "bg-slate-800/50 border border-slate-800 hover:bg-slate-700/30"
                          }`}
                          onClick={() => handleSelectMessage(message)}
                        >
                          <div className="flex items-start gap-3">
                            {getMessageIcon(message.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3
                                  className={`font-medium text-sm truncate ${
                                    message.isRead
                                      ? "text-slate-400"
                                      : "text-white"
                                  }`}
                                >
                                  {message.title}
                                </h3>
                                <div className="flex items-center gap-2">
                                  {!message.isRead && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 animate-pulse"></div>
                                  )}
                                  {/* Boton de acciones */}
                                  <div
                                    className="flex gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {!message.isRead && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markAsRead(message.id);
                                        }}
                                        className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-600/20"
                                        title="Marcar como leído"
                                      >
                                        <Check className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMessage(message.id);
                                      }}
                                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-600/20"
                                      title="Eliminar mensaje"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              <p className="text-slate-400 text-sm mb-2 line-clamp-2">
                                {message.content}
                              </p>
                              <div className="flex items-center justify-between">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getMessageTypeColor(
                                    message.type,
                                  )}`}
                                >
                                  {message.type.replace("_", " ")}
                                </Badge>
                                <span className="text-slate-500 text-xs">
                                  {new Date(
                                    message.createdAt,
                                  ).toLocaleDateString("es-CO", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Detalle de mensajes */}
          <div className="lg:col-span-3">
            {selectedMessage ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      {getMessageIcon(selectedMessage.type)}
                      <div>
                        <CardTitle className="text-white">
                          {selectedMessage.title}
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          De:{" "}
                          {selectedMessage.sender.name ||
                            selectedMessage.sender.email}
                          {selectedMessage.sender.role === "ADMIN" && (
                            <Badge className="ml-2 bg-purple-600">
                              Administrador
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!selectedMessage.isRead && (
                        <Button
                          size="sm"
                          onClick={() => markAsRead(selectedMessage.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Marcar como leído
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMessage(selectedMessage.id)}
                        className="border-red-600 text-red-400 hover:bg-red-600/20"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={getMessageTypeColor(selectedMessage.type)}
                      >
                        {selectedMessage.type.replace("_", " ")}
                      </Badge>
                      <span className="text-slate-500 text-sm">
                        {new Date(selectedMessage.createdAt).toLocaleDateString(
                          "es-CO",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>

                    <Separator className="bg-slate-700" />

                    <div className="bg-slate-700/50 rounded-lg p-6">
                      <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {selectedMessage.content}
                      </p>
                    </div>

                    {selectedMessage.type.includes("BLOCK") ||
                    selectedMessage.type.includes("RESTRICTION") ? (
                      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                        <p className="text-red-300 text-sm">
                          <strong>Importante:</strong> Si tienes preguntas sobre
                          esta acción, por favor contacta al soporte.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-600 opacity-50" />
                    <h3 className="text-white text-lg font-medium mb-2">
                      Selecciona un mensaje
                    </h3>
                    <p className="text-slate-400">
                      Elige un mensaje de la lista para ver su contenido
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
