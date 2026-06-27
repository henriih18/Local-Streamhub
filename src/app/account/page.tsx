"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  ShoppingBag,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Mail,
  Shield,
  AlertCircle,
  CheckCircle,
  Phone,
  Globe,
  TrendingUp,
  Headphones,
  MessageSquare,
  Send,
  Monitor,
  Crown,
  Filter,
} from "lucide-react";
import { toast } from "@/components/ui/toast-custom";
import { useRealTimeUpdates } from "@/hooks/useRealTimeUpdates";
import { Pagination } from "@/components/ui/pagination";

interface Order {
  id: string;
  userId: string;
  streamingAccountId?: string;
  exclusiveAccountId?: string;
  accountStockId?: string;
  accountProfileId?: string;

  exclusiveStockId?: string;
  accountEmail?: string;
  accountPassword?: string;
  profileName?: string;
  profilePin?: string;
  saleType: "FULL" | "PROFILES";
  quantity: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  totalPrice: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    email: string;
    name: string | null;
  };
  streamingAccount?: {
    id: string;
    name: string;
    description: string;
    price: number;
    type: string;
    duration: string;
    quality: string;
    screens: number;
    streamingType?: {
      name: string;
      description?: string;
    };
  };

  exclusiveAccount?: {
    id: string;
    name: string;
    description: string;
    price: number;
    type?: string;
    duration: string;
    quality?: string;
    screens?: number;
    saleType: "FULL" | "PROFILES";
    streamingType?: {
      name: string;
      description?: string;
    };
  };
}

interface SupportContact {
  id: string;
  name: string;
  number: string;
  type: string;
  description?: string;
  isActive: boolean;
  order: number;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [supportContacts, setSupportContacts] = useState<SupportContact[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [orderFilter, setOrderFilter] = useState<"active" | "expired">(
    "active",
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (error) {
          localStorage.removeItem("user");
        }
      } else {
        setUser(null);
      }
    };

    // comprobar el estado de autorización inicial
    checkAuth();

    // Escuchar los cambios de almacenamiento (para la sincronización entre tablas cruzadas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user") {
        checkAuth();
      }
    };

    // Escuchar el evento de cierre de sesión personalizado
    const handleLogout = () => {
      setUser(null);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("userLogout", handleLogout);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("userLogout", handleLogout);
    };
  }, []);

  // Obtener contactos de soporte
  const fetchSupportContacts = async () => {
    try {
      const response = await fetch("/api/support-contacts");
      if (response.ok) {
        const data = await response.json();
        setSupportContacts(data.contacts || []);
      }
    } catch (error) {
      //console.error('Error al obtener los contactos de soporte:', error)
    }
  };

  // Obtener pedidos de usuarios
  const fetchUserOrders = async (
    page: number = currentPage,
    filter: string = orderFilter,
  ) => {
    if (!user) return;

    setLoadingOrders(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        filter: filter,
      });

      const response = await fetch(`/api/orders?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalOrders(data.pagination?.total || 0);
      } else {
        //console.error("No se pudieron obtener los pedidos:", response.status);
      }
    } catch (error) {
      //console.error("Error al obtener pedidos:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Obtener pedidos y contactos de soporte cuando el usuario cambia
  useEffect(() => {
    if (user) {
      setCurrentPage(1);
      fetchUserOrders(1, orderFilter);
      fetchSupportContacts();
      loadCartItems();
    } else {
      setOrders([]);
      setSupportContacts([]);
      setCartItems([]);
      setTotalOrders(0);
    }
  }, [user, orderFilter]);

  // Cargar artículos del carrito

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
      /* console.error("Error al cargar articulos del carrito", error); */
    }
  };
  useRealTimeUpdates({
    userId: user?.id,
    onCreditsUpdated: (creditsData) => {
      setUser((prevUser: any) => {
        if (!prevUser) return prevUser;
        const updatedUser = { ...prevUser, credits: creditsData.newCredits };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        return updatedUser;
      });

      toast.success("Tus créditos han sido actualizados");
    },
    onUserUpdate: (data) => {
      setUser((prevUser: any) => {
        if (!prevUser) return prevUser;
        const updatedUser = { ...prevUser, ...data };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        return updatedUser;
      });
    },
  });
  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const isOrderActive = (order: Order) => {
    if (order.status !== "COMPLETED") return false;
    if (!order.expiresAt) return true;
    return new Date(order.expiresAt) > new Date();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            No has iniciado sesión
          </h2>
          <p className="text-slate-400 mb-6">
            Por favor inicia sesión para ver tu cuenta
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navigation
        user={user}
        cartItemsCount={(cartItems || []).length}
        onCartOpen={() => {}}
        onLogin={() => {
          router.push("/login");
        }}
        /* onLogout={() => {
          setUser(null);
          localStorage.removeItem("user");
          router.push("/");
        }} */
        onLogout={() => {
          fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
          }).catch(() => {});
          setUser(null);
          localStorage.removeItem("user");
          localStorage.removeItem("tokenExpiresAt");
          router.push("/");
        }}
        showCart={false}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Mi Cuenta</h1>
            <p className="text-slate-400">
              Gestiona tu perfil y tus cuentas de streaming
            </p>
          </div>

          {/* User Profile Card */}
          <Card className="bg-slate-800 border-slate-700 mb-8">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">
                    {user.fullName?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2
                      className="text-xl font-bold text-white truncate"
                      title={user.fullName}
                    >
                      {user.fullName || "Usuario"}
                    </h2>
                  </div>
                  <div className="space-y-2">
                    <Badge
                      className={`${
                        user.role === "ADMIN"
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : user.role === "VENDEDOR"
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {user.role === "ADMIN"
                        ? "Administrador"
                        : user.role === "VENDEDOR"
                          ? "Vendedor"
                          : "Usuario"}
                    </Badge>
                    {/* Nombre de Usuario */}
                    {user.username && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span
                          className="text-sm truncate"
                          title={user.username}
                        >
                          Usuario: {user.username}
                        </span>
                      </div>
                    )}
                    {/* Email */}
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm break-all" title={user.email}>
                        {user.email}
                      </span>
                    </div>
                    {/* Teléfono */}
                    {user.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm break-all" title={user.phone}>
                          {user.phone}
                        </span>
                      </div>
                    )}
                    {/* País */}
                    {user.country && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Globe className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">{user.country}</span>
                      </div>
                    )}

                    <div className="text-sm text-slate-400 truncate">
                      Miembro desde{" "}
                      {new Date(user.createdAt).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  ${user.credits?.toLocaleString("es-CO") || "0"}
                </div>
                <div className="text-slate-400 text-sm">Créditos</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <ShoppingBag className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {totalOrders}
                </div>
                <div className="text-slate-400 text-sm">Pedidos</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {orderFilter === "active" ? totalOrders : "—"}
                </div>
                <div className="text-slate-400 text-sm">
                  {orderFilter === "active" ? "Activos" : "Vencidos"}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  <span className="text-emerald-400">Activo</span>
                </div>
                <div className="text-slate-400 text-sm">Estado</div>
              </CardContent>
            </Card>
          </div>

          {/* Support Contacts */}
          <Card className="bg-slate-800 border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-3">
                <Headphones className="w-5 h-5 text-emerald-400" />
                Contacto y soporte
              </CardTitle>
              <CardDescription className="text-slate-400">
                Contacta con nosotros
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(supportContacts || []).filter((contact) => contact.isActive)
                .length === 0 ? (
                <div className="text-center py-8">
                  <Headphones className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Soporte no disponible
                  </h3>
                  <p className="text-slate-400">
                    No hay contactos de soporte configurados
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supportContacts
                    .filter((contact) => contact.isActive)
                    .sort((a, b) => a.order - b.order)
                    .map((contact) => (
                      <div
                        key={contact.id}
                        className="bg-slate-700 rounded-lg p-4 border border-slate-600"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                            <span className="text-xl">
                              {contact.type === "whatsapp"
                                ? "💬"
                                : contact.type === "phone"
                                  ? "📞"
                                  : contact.type === "telegram"
                                    ? "✈️"
                                    : "💬"}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-white font-semibold">
                              {contact.name}
                            </h4>
                            <Badge className="bg-emerald-600/20 text-emerald-300 text-xs">
                              {contact.type === "whatsapp"
                                ? "WhatsApp"
                                : contact.type === "phone"
                                  ? "Teléfono"
                                  : contact.type === "telegram"
                                    ? "Telegram"
                                    : "SMS"}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-emerald-400 font-medium mb-2">
                          {contact.number}
                        </p>
                        {contact.description && (
                          <p className="text-slate-400 text-sm mb-3">
                            {contact.description}
                          </p>
                        )}
                        <Button
                          size="sm"
                          className={`w-full ${
                            contact.type === "whatsapp"
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                          onClick={() => {
                            let url = "";
                            if (contact.type === "whatsapp") {
                              const cleanNumber = contact.number.replace(
                                /[^\d+]/g,
                                "",
                              );
                              url = `https://wa.me/${cleanNumber}`;
                            } else if (contact.type === "telegram") {
                              url = `https://t.me/${contact.number.replace(
                                "@",
                                "",
                              )}`;
                            } else {
                              url = `tel:${contact.number}`;
                            }
                            window.open(url, "_blank");
                          }}
                        >
                          {contact.type === "whatsapp" ? (
                            <>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              WhatsApp
                            </>
                          ) : contact.type === "telegram" ? (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Telegram
                            </>
                          ) : (
                            <>
                              <Phone className="w-4 h-4 mr-2" />
                              Llamar
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders Section */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Mis Pedidos
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Historial de compras
                  </CardDescription>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => setOrderFilter("active")}
                  className={`flex-1 transition-all ${
                    orderFilter === "active"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                  }`}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Activos
                </Button>

                <Button
                  onClick={() => setOrderFilter("expired")}
                  className={`flex-1 transition-all ${
                    orderFilter === "expired"
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Vencidos
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {loadingOrders ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-slate-400">Cargando pedidos...</div>
                </div>
              ) : (
                (() => {
                  if (orders.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                          {orderFilter === "active" ? (
                            <CheckCircle className="w-8 h-8 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-8 h-8 text-red-500" />
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {orderFilter === "active"
                            ? "No tienes pedidos activos"
                            : "No tienes pedidos vencidos"}
                        </h3>
                        <p className="text-slate-400 mb-6">
                          {orderFilter === "active"
                            ? "Explora nuestro catálogo y adquiere tu primera cuenta"
                            : "¡Excelente! No tienes pedidos vencidos"}
                        </p>
                        {orderFilter === "active" && (
                          <Button
                            onClick={() => router.push("/#accounts")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Explorar Cuentas
                          </Button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className={`rounded-lg p-6 border ${
                            orderFilter === "active"
                              ? "bg-slate-700 border-slate-600"
                              : "bg-red-950/30 border-red-900/30"
                          }`}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                {/* Título del pedido */}
                                <h3 className="font-semibold text-white text-lg">
                                  {order.streamingAccount?.name ||
                                    order.exclusiveAccount?.name ||
                                    "Cuenta de Streaming"}
                                </h3>

                                {/* Badge de cuenta exclusiva */}
                                {order.exclusiveAccount && (
                                  <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 px-3 py-1 text-xs font-bold shadow-lg shadow-amber-500/30">
                                    <Crown className="w-3 h-3 mr-1" />
                                    EXCLUSIVO
                                  </Badge>
                                )}

                                {/* {order.status === "COMPLETED" && (
                                  <Badge className="bg-green-600 text-white">
                                    Activo
                                  </Badge>
                                )} */}
                                {order.status === "COMPLETED" &&
                                  isOrderActive(order) && (
                                    <Badge className="bg-green-600 text-white">
                                      Activo
                                    </Badge>
                                  )}
                                {order.status === "COMPLETED" &&
                                  !isOrderActive(order) && (
                                    <Badge className="bg-red-600 text-white">
                                      Expirado
                                    </Badge>
                                  )}
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xl font-bold text-emerald-400 mb-1">
                                    ${order.totalPrice.toLocaleString("es-CO")}
                                  </p>
                                  <p className="text-slate-400">
                                    {order.saleType === "FULL"
                                      ? "Cuenta Completa"
                                      : "Perfil"}{" "}
                                    •{" "}
                                    {order.streamingAccount?.duration ||
                                      order.exclusiveAccount?.duration}
                                  </p>
                                </div>

                                <div className="text-right">
                                  <div className="text-slate-400 text-sm mb-2">
                                    {new Date(
                                      order.createdAt,
                                    ).toLocaleDateString("es-CO")}
                                  </div>
                                  {/* {order.status === "COMPLETED" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-slate-400 hover:text-white hover:bg-slate-600"
                                      onClick={() =>
                                        toggleOrderExpansion(order.id)
                                      } */}
                                  {isOrderActive(order) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-slate-400 hover:text-white hover:bg-slate-600"
                                      onClick={() =>
                                        toggleOrderExpansion(order.id)
                                      }
                                    >
                                      {expandedOrders.has(order.id) ? (
                                        <>
                                          <ChevronUp className="w-4 h-4 mr-1" />
                                          Menos
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="w-4 h-4 mr-1" />
                                          Más
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Credentials - Solo para pedidos activos */}
                          {/* {order.status === "COMPLETED" && ( */}
                          {/* Credentials - Solo para pedidos activos */}
                          {isOrderActive(order) && (
                            <>
                              {(order.accountEmail ||
                                order.accountPassword ||
                                order.profileName ||
                                order.profilePin) && (
                                <div className="mb-4 p-5 bg-gradient-to-r from-emerald-600/5 to-emerald-500/5 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
                                  <p className="text-emerald-400 mb-4 font-semibold flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    Credenciales de Acceso:
                                  </p>
                                  <div className="space-y-3">
                                    {order.accountEmail && (
                                      <div className="group relative overflow-hidden rounded-lg border border-emerald-500/20 bg-slate-800/50 backdrop-blur-sm transition-all hover:border-emerald-500/40 hover:bg-slate-800/70">
                                        <div className="flex items-center justify-between p-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                            <span className="text-slate-300 font-medium">
                                              Email
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-emerald-300 font-mono font-semibold">
                                              {order.accountEmail}
                                            </span>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
                                              onClick={() => {
                                                navigator.clipboard.writeText(
                                                  order.accountEmail!,
                                                );
                                                toast.success(
                                                  "Email copiado al portapapeles",
                                                );
                                              }}
                                            >
                                              <CreditCard className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {order.accountPassword && (
                                      <div className="group relative overflow-hidden rounded-lg border border-emerald-500/20 bg-slate-800/50 backdrop-blur-sm transition-all hover:border-emerald-500/40 hover:bg-slate-800/70">
                                        <div className="flex items-center justify-between p-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                            <span className="text-slate-300 font-medium">
                                              Contraseña
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-emerald-300 font-mono font-semibold">
                                              {order.accountPassword}
                                            </span>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
                                              onClick={() => {
                                                navigator.clipboard.writeText(
                                                  order.accountPassword!,
                                                );
                                                toast.success(
                                                  "Contraseña copiada al portapapeles",
                                                );
                                              }}
                                            >
                                              <CreditCard className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {order.profileName && (
                                      <div className="group relative overflow-hidden rounded-lg border border-emerald-500/20 bg-slate-800/50 backdrop-blur-sm transition-all hover:border-emerald-500/40 hover:bg-slate-800/70">
                                        <div className="flex items-center justify-between p-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                            <span className="text-slate-300 font-medium">
                                              Perfil
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-emerald-300 font-semibold">
                                              {order.profileName}
                                            </span>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
                                              onClick={() => {
                                                navigator.clipboard.writeText(
                                                  order.profileName!,
                                                );
                                                toast.success(
                                                  "Nombre de perfil copiado",
                                                );
                                              }}
                                            >
                                              <CreditCard className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {order.profilePin && (
                                      <div className="group relative overflow-hidden rounded-lg border border-emerald-500/20 bg-slate-800/50 backdrop-blur-sm transition-all hover:border-emerald-500/40 hover:bg-slate-800/70">
                                        <div className="flex items-center justify-between p-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                            <span className="text-slate-300 font-medium">
                                              PIN
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-emerald-300 font-mono font-semibold">
                                              {order.profilePin}
                                            </span>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
                                              onClick={() => {
                                                navigator.clipboard.writeText(
                                                  order.profilePin!,
                                                );
                                                toast.success(
                                                  "PIN copiado al portapapeles",
                                                );
                                              }}
                                            >
                                              <CreditCard className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Quick Actions */}
                                  <div className="flex gap-3 mt-6 pt-4 border-t border-emerald-500/20">
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 transition-all hover:shadow-emerald-600/40"
                                      onClick={() => {
                                        const credentials: string[] = [];
                                        if (order.accountEmail)
                                          credentials.push(
                                            `Email: ${order.accountEmail}`,
                                          );
                                        if (order.accountPassword)
                                          credentials.push(
                                            `Contraseña: ${order.accountPassword}`,
                                          );
                                        if (order.profileName)
                                          credentials.push(
                                            `Perfil: ${order.profileName}`,
                                          );
                                        if (order.profilePin)
                                          credentials.push(
                                            `PIN: ${order.profilePin}`,
                                          );

                                        navigator.clipboard.writeText(
                                          credentials.join("\n"),
                                        );
                                        toast.success(
                                          "Todas las credenciales copiadas",
                                        );
                                      }}
                                    >
                                      <CreditCard className="w-4 h-4 mr-2" />
                                      Copiar Todo
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Expanded Order Details - Solo para pedidos activos */}
                              {/* {expandedOrders.has(order.id) &&
                                order.status === "COMPLETED" && ( */}
                              {expandedOrders.has(order.id) &&
                                isOrderActive(order) && (
                                  <div className="pt-4 border-t border-slate-600">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      {/* Order Information */}
                                      <div>
                                        <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                          <ShoppingBag className="w-4 h-4 text-blue-400" />
                                          Información del Pedido
                                        </h4>

                                        <div className="space-y-3">
                                          <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                            <label className="text-slate-400 text-sm">
                                              ID del Pedido
                                            </label>
                                            <div className="text-white font-mono text-sm">
                                              {order.id}
                                            </div>
                                          </div>

                                          <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                            <label className="text-slate-400 text-sm">
                                              Tipo de Venta
                                            </label>
                                            <div className="text-white">
                                              {order.saleType === "FULL"
                                                ? "Cuenta Completa"
                                                : "Perfil Individual"}
                                            </div>
                                          </div>

                                          <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                            <label className="text-slate-400 text-sm">
                                              Cantidad
                                            </label>
                                            <div className="text-white">
                                              {order.quantity}{" "}
                                              {order.quantity === 1
                                                ? "unidad"
                                                : "unidades"}
                                            </div>
                                          </div>

                                          <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                            <label className="text-slate-400 text-sm">
                                              Precio Unitario
                                            </label>
                                            <div className="text-white">
                                              ${" "}
                                              {(
                                                order.totalPrice /
                                                order.quantity
                                              ).toLocaleString("es-CO")}
                                            </div>
                                          </div>

                                          <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                            <label className="text-slate-400 text-sm">
                                              Fecha de Compra
                                            </label>
                                            <div className="text-white text-sm">
                                              {new Date(
                                                order.createdAt,
                                              ).toLocaleDateString("es-CO")}
                                            </div>
                                          </div>

                                          {order.expiresAt && (
                                            <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                              <label className="text-slate-400 text-sm">
                                                Fecha de Expiración
                                              </label>
                                              <div className="text-white text-sm">
                                                {new Date(
                                                  order.expiresAt,
                                                ).toLocaleDateString("es-CO")}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Streaming Account Details */}
                                      {order.streamingAccount && (
                                        <div>
                                          <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                            <Monitor className="w-4 h-4 text-purple-400" />
                                            Detalles del Servicio
                                          </h4>

                                          <div className="space-y-3">
                                            <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                              <label className="text-slate-400 text-sm">
                                                Calidad
                                              </label>
                                              <div className="text-white font-semibold">
                                                {order.streamingAccount
                                                  .quality || "N/A"}
                                              </div>
                                            </div>

                                            <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                              <label className="text-slate-400 text-sm">
                                                Pantallas
                                              </label>
                                              <div className="text-white font-semibold">
                                                {order.streamingAccount
                                                  .screens || "N/A"}
                                              </div>
                                            </div>

                                            <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                              <label className="text-slate-400 text-sm">
                                                Duración
                                              </label>
                                              <div className="text-white font-semibold">
                                                {order.streamingAccount
                                                  .duration || "N/A"}
                                              </div>
                                            </div>

                                            {order.streamingAccount
                                              .description && (
                                              <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                                <label className="text-slate-400 text-sm">
                                                  Descripción
                                                </label>
                                                <div className="text-white text-sm">
                                                  {
                                                    order.streamingAccount
                                                      .description
                                                  }
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Exclusive Account Details */}
                                      {order.exclusiveAccount && (
                                        <div>
                                          <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                            <Monitor className="w-4 h-4 text-amber-400" />
                                            Detalles del Servicio Exclusivo
                                          </h4>

                                          <div className="space-y-3">
                                            <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                              <label className="text-slate-400 text-sm">
                                                Tipo de Cuenta
                                              </label>
                                              <div className="text-white font-semibold">
                                                {order.exclusiveAccount
                                                  .saleType === "FULL"
                                                  ? "Cuenta Completa"
                                                  : "Perfil Individual"}
                                              </div>
                                            </div>

                                            <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                              <label className="text-slate-400 text-sm">
                                                Duración
                                              </label>
                                              <div className="text-white font-semibold">
                                                {order.exclusiveAccount
                                                  .duration || "N/A"}
                                              </div>
                                            </div>

                                            {order.exclusiveAccount.quality && (
                                              <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                                <label className="text-slate-400 text-sm">
                                                  Calidad
                                                </label>
                                                <div className="text-white font-semibold">
                                                  {
                                                    order.exclusiveAccount
                                                      .quality
                                                  }
                                                </div>
                                              </div>
                                            )}

                                            {order.exclusiveAccount.screens && (
                                              <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                                <label className="text-slate-400 text-sm">
                                                  Pantallas
                                                </label>
                                                <div className="text-white font-semibold">
                                                  {
                                                    order.exclusiveAccount
                                                      .screens
                                                  }
                                                </div>
                                              </div>
                                            )}

                                            {order.exclusiveAccount
                                              .description && (
                                              <div className="p-3 bg-slate-800 rounded border border-slate-600">
                                                <label className="text-slate-400 text-sm">
                                                  Descripción
                                                </label>
                                                <div className="text-white text-sm">
                                                  {
                                                    order.exclusiveAccount
                                                      .description
                                                  }
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
              {totalPages > 1 && orders.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    fetchUserOrders(page, orderFilter);
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
