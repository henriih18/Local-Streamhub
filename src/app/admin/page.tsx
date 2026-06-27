"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import Navigation from "@/components/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/toast-custom";
import ImageGallery from "@/components/admin/image-gallery";
import PermissionManager from "@/components/admin/PermissionManager";
import {
  UserManagementSkeleton,
  OrderManagementSkeleton,
  AnalyticsSkeleton,
} from "@/components/admin/lazy-components";
import {
  Users,
  ShoppingBag,
  CreditCard,
  Package,
  TrendingUp,
  Star,
  Plus,
  Eye,
  Gift,
  Crown,
  Settings,
  Lock,
  Unlock,
  AlertTriangle,
  Shield,
  Ban,
  History,
  CheckCircle,
  XCircle,
  Info,
  User,
  Mail,
  Filter,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  RefreshCw,
  Activity,
  DollarSign,
  ChevronDown,
  Edit,
  ChevronUp,
  BarChart3,
  PieChart,
  ShoppingCart,
  Headphones,
  X,
  Percent,
  Save,
} from "lucide-react";
import { ProfitsCard } from "@/components/profits-card";

import { useRealTimeStats } from "@/hooks/useRealTimeStats";
import { Pagination } from "@/components/ui/pagination";

import router from "next/router";

interface User {
  id: string;
  email: string;
  name: string | null;
  credits: number;
  totalSpent: number;
  role: string;
  createdAt: string;
  isActive: boolean;
  isBlocked: boolean;
  blockExpiresAt?: string | null;
  blockReason?: string | null;
  telegramChatId?: string | null;
  _count: {
    orders: number;
  };
}

interface StreamingType {
  id: string;
  name: string;

  icon?: string;
  color?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
}

interface StreamingAccount {
  id: string;
  name: string;
  type: string;
  price: number;

  duration: string;
  quality: string;
  screens: number;
  isActive: boolean;
  saleType: string;

  order: number;
  _count: {
    accountStocks: number;
    profileStocks: number;
    orders: number;
  };
}

interface Order {
  id: string;
  user: {
    email: string;
    name: string | null;
  };
  streamingAccount: {
    id: true;
    name: string;
    type: string;
    price: number;
    duration: string;
    quality: string;
    screens: number;
  } | null;
  totalPrice: number;
  status: string;
  saleType: string;
  quantity: number;
  createdAt: string;
  accountEmail?: string;
  accountPassword?: string;
  profileName?: string;
  profilePin?: string;
  expiresAt: string;
  renewalCount: number;
  lastRenewedAt?: string;
  deliveryStatus?: "PENDING" | "DELIVERED" | "FAILED";
  deliveryAttempts?: number;
  lastDeliveryAttempt?: string;
}

interface SpecialOffer {
  id: string;
  user: {
    email: string;
    name: string | null;
  };
  streamingAccount: {
    name: string;
    type: string;
    price: number;
  };
  discountPercentage: number;
  isActive: boolean;
  expiresAt: string | null;

  createdAt: string;
}

interface ExclusiveAccount {
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
  duration: number;
  quality?: string;
  screens?: string;
  saleType: string;
  maxProfiles?: number;
  pricePerProfile?: number;
  isPublic: boolean;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  allowedUsers: Array<{
    id: string;
    name: string | null;
    email: string;
  }>;
  exclusiveStocks?: Array<{
    id: string;
    email: string;
    password: string;
    pin?: string;
    profileName?: string;
    isAvailable: boolean;
    soldToUserId?: string;
    soldAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  _count: {
    orders: number;
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
  createdAt: string;
  updatedAt: string;
}

interface StockByAccount {
  id: string;
  name: string;
  type: "REGULAR" | "EXCLUSIVE";
  streamingType: string;
  color: string;
  saleType: string;
  price: number;
  duration: string;
  quality: string;
  screens: string | number;
  accountStock: number;
  profileStock: number;
  totalStock: number;
  isActive: boolean;
  maxProfiles?: number;
  pricePerProfile?: number;
}

interface StockSummary {
  totalAccounts: number;
  totalProfiles: number;
  totalStock: number;
  activeAccounts: number;
  totalAccountTypes: number;
}

interface StockByStreamingType {
  streamingType: string;
  color: string;
  accounts: number;
  profiles: number;
  totalStock: number;
  accountCount: number;
}

interface StockBySaleType {
  saleType: string;
  accounts: number;
  profiles: number;
  totalStock: number;
  accountCount: number;
}

interface StockData {
  summary: StockSummary;
  byAccount: StockByAccount[];
  byStreamingType: StockByStreamingType[];
  bySaleType: StockBySaleType[];
}

interface AdvancedStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  topUsers: User[];
  revenueByMonth: Array<{ month: string; revenue: number; orders: number }>;
  salesByType: Array<{ type: string; count: number; revenue: number }>;
  recentActivity: Array<{
    type: string;
    description: string;
    time: string;
    icon: string;
  }>;
  topProducts: Array<{
    name: string;
    type: string;
    sales: number;
    revenue: number;
  }>;
  userGrowth: Array<{ month: string; users: number; newUsers: number }>;
  averageOrderValue: number;
  conversionRate: number;
  activeUsers: number;
  totalCredits: number;
}

export default function AdminPage() {
  // estadísticas en tiempo real
  const {
    stats: realTimeStats,
    isConnected,
    lastUpdate,
    refreshStats,
  } = useRealTimeStats();

  const [activeTab, setActiveTab] = useState("resumen");
  const [streamingTypes, setStreamingTypes] = useState<StreamingType[]>([]);
  const [accounts, setAccounts] = useState<StreamingAccount[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expirationFilter, setExpirationFilter] = useState<
    "all" | "vigente" | "rehabilitado" | "expirado"
  >("all");
  const [renewalFilter, setRenewalFilter] = useState<
    "all" | "renewed" | "not_renewed"
  >("all");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
  const [exclusiveAccounts, setExclusiveAccounts] = useState<
    ExclusiveAccount[]
  >([]);
  const [supportContacts, setSupportContacts] = useState<SupportContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserOrders, setShowUserOrders] = useState(false);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [rechargeAmount, setRechargeAmount] = useState<string>("50000");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedOrdersInGeneral, setExpandedOrdersInGeneral] = useState<
    Set<string>
  >(new Set());
  const [expandedExclusiveAccounts, setExpandedExclusiveAccounts] = useState<
    Set<string>
  >(new Set());
  const [expandedSpecialOffers, setExpandedSpecialOffers] = useState<
    Set<string>
  >(new Set());

  // Estados del carrito
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [orderCurrentPage, setOrderCurrentPage] = useState(1);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [ordersPage, setOrdersPage] = useState<Order[]>([]);
  const ORDERS_PER_PAGE = 30;

  // Estados del historial de recarga
  const [showRechargeHistory, setShowRechargeHistory] = useState(false);
  const [rechargeHistory, setRechargeHistory] = useState<any[]>([]);
  const [loadingRechargeHistory, setLoadingRechargeHistory] = useState(false);
  const [, setSelectedUserForRechargeHistory] = useState<string | null>(null);
  const [userActionCounts, setUserActionCounts] = useState<
    Record<string, number>
  >({});

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [usersPage, setUsersPage] = useState<User[]>([]);
  const USERS_PER_PAGE = 10;

  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [selectedInventoryAccount, setSelectedInventoryAccount] =
    useState<any>(null);
  const [inventoryStocks, setInventoryStocks] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [selectedUsersForOffer, setSelectedUsersForOffer] = useState<string[]>(
    [],
  );
  const [selectedUsersForExclusive, setSelectedUsersForExclusive] = useState<
    string[]
  >([]);
  const [topBuyers, setTopBuyers] = useState<any[]>([]);
  const [topVendors, setTopVendors] = useState<any[]>([]);
  const [showPermissionManager, setShowPermissionManager] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] =
    useState<User | null>(null);

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState({
    title: "",
    content: "",
    type: "GENERAL" as "GENERAL" | "WARNING" | "SYSTEM_NOTIFICATION",
    sendToTelegram: true,
  });

  // Estado de los menús desplegables de información de registro de usuario
  const [expandedUserRegistration, setExpandedUserRegistration] = useState<
    Set<string>
  >(new Set());
  const [userRegistrationData, setUserRegistrationData] = useState<
    Record<string, any>
  >({});
  const [editingUserRegistration, setEditingUserRegistration] = useState<
    string | null
  >(null);
  const [loadingUserRegistration, setLoadingUserRegistration] = useState<
    Set<string>
  >(new Set());

  const [editingAccount, setEditingAccount] = useState<StreamingAccount | null>(
    null,
  );
  const [editingType, setEditingType] = useState<StreamingType | null>(null);
  const [showEditAccountDialog, setShowEditAccountDialog] = useState(false);
  const [showEditTypeDialog, setShowEditTypeDialog] = useState(false);

  const [roleFilter, setRoleFilter] = useState<
    "ALL" | "ADMIN" | "VENDEDOR" | "USER"
  >("ALL");

  const [newAccount, setNewAccount] = useState({
    name: "",
    description: "",
    type: "",
    price: "",
    duration: "",
    quality: "4K HDR",
    screens: "",
    saleType: "FULL",
  });

  const [newStreamingType, setNewStreamingType] = useState({
    name: "",
    description: "",
    imageUrl: "",
    color: "#3B82F6",
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  const [newSpecialOffer, setNewSpecialOffer] = useState({
    streamingAccountId: "",
    discountPercentage: "",
    expiresAt: "",
  });

  const [newExclusiveAccount, setNewExclusiveAccount] = useState({
    name: "",
    description: "",
    type: "",
    price: "",
    duration: "",
    quality: "4K HDR",
    screens: "",
    saleType: "FULL",
    isPublic: "false",
    expiresAt: "",
  });

  const [newSupportContact, setNewSupportContact] = useState({
    name: "",
    number: "",
    type: "whatsapp",
    description: "",
    isActive: true,
    order: 0,
  });

  const [stockData, setStockData] = useState({
    accountType: "regular",
    streamingAccountId: "",
    exclusiveAccountId: "",
    saleType: "FULL",
    accounts: "",
    profiles: "",
    email: "",
    password: "",
    profileName: "",
    pin: "",
    notes: "",
  });

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showEditOrderDialog, setShowEditOrderDialog] = useState(false);
  const [editedOrderData, setEditedOrderData] = useState({
    accountEmail: "",
    accountPassword: "",
    profileName: "",
    profilePin: "",
  });

  const [stats, setStats] = useState<AdvancedStats>({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    topUsers: [],
    revenueByMonth: [],
    salesByType: [],
    recentActivity: [],
    topProducts: [],
    userGrowth: [],
    averageOrderValue: 0,
    conversionRate: 0,
    activeUsers: 0,
    totalCredits: 0,
  });

  const [stockStatsData, setStockStatsData] = useState<StockData>({
    summary: {
      totalAccounts: 0,
      totalProfiles: 0,
      totalStock: 0,
      activeAccounts: 0,
      totalAccountTypes: 0,
    },
    byAccount: [],
    byStreamingType: [],
    bySaleType: [],
  });

  const [showBannerModal, setShowBannerModal] = useState(false);
  const [bannerData, setBannerData] = useState({
    text: "",
    isActive: true,
    speed: 20,
    backgroundColor: "#10b981",
    textColor: "#ffffff",
    sendToTelegram: true,
    targetRoles: ["USER", "VENDEDOR"] as string[],
  });
  const [loadingBanner, setLoadingBanner] = useState(false);

  const [vendorPricing, setVendorPricing] = useState<{
    [key: string]: { vendorPrice: number; discountPercentage: number };
  }>({});
  const [showVendorPricingModal, setShowVendorPricingModal] = useState(false);
  const [loadingVendorPricing, setLoadingVendorPricing] = useState(false);

  const [enabledVendorInputs, setEnabledVendorInputs] = useState<Set<string>>(
    new Set(),
  );

  const [applyToAllUsers, setApplyToAllUsers] = useState(false);
  const [rechargingUserId, setRechargingUserId] = useState<string | null>(null);
  const [isRecharging, setIsRecharging] = useState(false);

  const checkAuth = (): boolean => {
    if (!user?.id) {
      toast.error("Usuario no autenticado");
      return false;
    }
    return true;
  };

  // Función para actualizar el inventario manualmente
  const refreshInventory = async () => {
    try {
      if (!checkAuth()) return;

      // Usar adminFetch como hace fetchData() para autenticación
      const [accountsRes, exclusiveRes] = await Promise.all([
        adminFetch("/api/admin/streaming-accounts"),
        adminFetch("/api/admin/exclusive-accounts"),
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData);
      }

      if (exclusiveRes.ok) {
        const exclusiveData = await exclusiveRes.json();
        setExclusiveAccounts(exclusiveData);
      }

      // Cargar precios de vendedor una sola vez si alguna petición fue exitosa
      if (accountsRes.ok || exclusiveRes.ok) {
        loadVendorPricing();
      }

      toast.success("Inventario actualizado");
    } catch (error) {
      toast.error("No se pudo actualizar el inventario");
    }
  };

  // Función para actualizar métricas de negocio
  const refreshBusinessMetrics = async () => {
    try {
      if (!checkAuth()) return;

      // Simplemente recargar las estadísticas del backend
      await fetchStatsData(true); // 👈 Forzar refresh

      toast.success("Las métricas de negocio se han actualizado correctamente");
    } catch (error) {
      toast.error("No se pudieron actualizar las métricas");
    }
  };

  const handleSaveBanner = async () => {
    if (!bannerData.text.trim()) {
      toast.error("El texto del banner no puede estar vacío");
      return;
    }

    setLoadingBanner(true);
    try {
      const response = await fetch("/api/announcement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bannerData),
      });

      if (response.ok) {
        const data = await response.json();
        const telegramSent = data.telegramSent || 0;
        const telegramFailed = data.telegramFailed || 0;

        if (telegramSent > 0 || telegramFailed > 0) {
          toast.success(
            `Banner configurado. Telegram: ${telegramSent} enviados${telegramFailed > 0 ? `, ${telegramFailed} fallidos` : ""}`,
          );
        } else if (bannerData.sendToTelegram) {
          toast.success(
            "Banner configurado. No hay usuarios verificados en Telegram.",
          );
        } else {
          toast.success("Banner configurado exitosamente");
        }
        setShowBannerModal(false);

        setBannerData({
          text: "",
          isActive: true,
          speed: 20,
          backgroundColor: "#10b981",
          textColor: "#ffffff",
          sendToTelegram: true,
          targetRoles: ["USER", "VENDEDOR"],
        });
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al configurar el banner");
      }
    } catch (error) {
      toast.error("Error al configurar el banner");
    } finally {
      setLoadingBanner(false);
    }
  };

  const loadBannerData = async () => {
    try {
      const response = await fetch("/api/announcement");
      if (response.ok) {
        const data = await response.json();
        if (data.id) {
          setBannerData({
            text: data.text || "",
            isActive: data.isActive !== undefined ? data.isActive : true,
            speed: data.speed || 20,
            backgroundColor: "#10b981",
            textColor: "#ffffff",
            sendToTelegram: true,
            targetRoles: ["USER", "VENDEDOR"],
          });
        }
      }
    } catch (error) {}
  };

  useEffect(() => {
    // Cargar el usuario desde localStorage y verificar primero los permisos de administrador
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);

        const isAdmin = parsedUser?.role === "ADMIN";

        if (!isAdmin) {
          toast.error("No tienes permisos de administrador");
          // Redirigir a los usuarios no administradores inmediatamente

          router.replace("/");
          return;
        }

        setUser(parsedUser);
        setLoading(false);
      } catch (error) {
        localStorage.removeItem("user");

        router.replace("/login");
      }
    } else {
      router.replace("/login");
    }
  }, []);

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
        const isAdmin = customEvent.detail.role === "ADMIN";

        if (!isAdmin) {
          toast.error("No tienes permisos de administrador");
          return;
        }

        setUser(customEvent.detail);
        localStorage.setItem("user", JSON.stringify(customEvent.detail));
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
      localStorage.removeItem("user");
      router.replace("/login");
    };

    window.addEventListener("userLogout", handleUserLogout);

    return () => {
      window.removeEventListener("userLogout", handleUserLogout);
    };
  }, []);

  const handleLogin = () => {
    // Redirigir a la página de inicio de sesión o mostrar el modal de inicio de sesión
    window.location.href = "/login";
  };

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(
      () => {},
    );
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("tokenExpiresAt");
    toast.success("Sesión cerrada correctamente");
    window.location.href = "/";
  };

  // Cargar datos según el módulo activo
  useEffect(() => {
    if (loading || !user?.id) {
      return;
    }

    const loadDataByModule = async () => {
      switch (activeTab) {
        case "resumen":
          await fetchStatsData();
          break;
        case "tipos":
          await fetchTypesData();
          break;
        case "cuentas":
          await Promise.all([fetchTypesData(), fetchAccountsData()]);
          break;
        case "stock":
          await Promise.all([fetchAccountsData(), fetchExclusiveData()]);
          await fetchStockData(user);
          break;
        case "pedidos":
          setOrderCurrentPage(1);
          await fetchOrdersData();
          break;
        case "usuarios":
          setUserCurrentPage(1);
          await fetchUsersData();
          break;
        case "ofertas":
          await Promise.all([
            fetchOffersData(),
            fetchTopUsers(),
            fetchAccountsData(),
          ]);
          break;

        case "exclusivas":
          await Promise.all([
            fetchExclusiveData(),
            fetchTopUsers(),
            fetchTypesData(),
          ]);
          break;

        case "soporte":
          await fetchSupportContactsData();
          break;
        default:
          break;
      }
    };

    loadDataByModule();
  }, [activeTab, user?.id]);

  // Re-fetch usuarios cuando cambia la página de usuarios
  useEffect(() => {
    if (activeTab === "usuarios" && userCurrentPage > 0) {
      fetchUsersData();
    }
  }, [userCurrentPage]);

  // Resetear a página 1 y re-fetch cuando cambian filtros
  useEffect(() => {
    if (activeTab === "usuarios") {
      setUserCurrentPage((prev) => {
        if (prev !== 1) return 1; // Se dispara el useEffect de userCurrentPage
        // Si ya estaba en 1, no cambia → forzamos fetch manualmente
        fetchUsersData();
        return 1;
      });
    }
  }, [roleFilter, userSearchQuery, statusFilter]);

  // Re-fetch pedidos cuando cambia la página
  useEffect(() => {
    if (activeTab === "pedidos" && orderCurrentPage > 0) {
      fetchOrdersData();
    }
  }, [orderCurrentPage]);

  // Resetear a página 1 y re-fetch cuando cambian filtros de pedidos
  useEffect(() => {
    if (activeTab === "pedidos") {
      setOrderCurrentPage((prev) => {
        if (prev !== 1) return 1;
        fetchOrdersData();
        return 1;
      });
    }
  }, [renewalFilter]);

  // Funciones de utilidad
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Sin fecha de expiración";
    return new Date(dateString).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) {
      return "$0";
    }
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const isOrderExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const getExpirationStatus = (expiresAt: string) => {
    const expired = isOrderExpired(expiresAt);
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (expired) {
      return {
        status: "Expirado",
        color: "text-red-400",
        bgColor: "bg-red-600/20 border-red-600/30",
        days: Math.abs(diffDays),
        filterCategory: "expirado" as const,
      };
    } else if (diffDays <= 3) {
      return {
        status: `Por expirar (${diffDays}d)`,
        color: "text-yellow-400",
        bgColor: "bg-yellow-600/20 border-yellow-600/30",
        days: diffDays,
        filterCategory: "por_expirar" as const,
      };
    } else {
      return {
        status: `Vigente (${diffDays}d)`,
        color: "text-green-400",
        bgColor: "bg-green-600/20 border-green-600/30",
        days: diffDays,
        filterCategory: "vigente" as const,
      };
    }
  };

  const filteredOrders = useMemo(() => {
    let result = ordersPage;

    // Filtro por expiración (cliente - dinámico)
    // Filtro por expiración (cliente - dinámico)
    if (expirationFilter !== "all") {
      result = result.filter((order) => {
        if (expirationFilter === "rehabilitado") {
          return order.status === "REHABILITATED";
        }
        const status = getExpirationStatus(order.expiresAt);
        return status.filterCategory === expirationFilter;
      });
    }

    // Filtro por búsqueda de email (cliente - datos desencriptados)
    if (orderSearchQuery.trim() !== "") {
      const searchQuery = orderSearchQuery.toLowerCase().trim();
      result = result.filter((order) => {
        if (
          order.accountEmail &&
          order.accountEmail.toLowerCase().includes(searchQuery)
        ) {
          return true;
        }
        return false;
      });
    }

    return result;
  }, [ordersPage, expirationFilter, orderSearchQuery]);

  const fetchInventoryStocks = async (account: any, isExclusive: boolean) => {
    setSelectedInventoryAccount(account);
    setInventoryModalOpen(true);
    setInventoryLoading(true);

    try {
      const exclusiveParam = isExclusive ? "?exclusive=true" : "";
      const endpoint = isExclusive
        ? `/api/admin/streaming-accounts/${account.id}/stocks${exclusiveParam}`
        : `/api/admin/streaming-accounts/${account.id}/stocks`;

      const res = await adminFetch(endpoint);
      const data = await res.json();
      setInventoryStocks(data);
    } catch (error) {
      toast.error("Error al cargar cuentas");
    } finally {
      setInventoryLoading(false);
    }
  };

  const filteredUsers = usersPage;

  const loadVendorPricing = async () => {
    try {
      const response = await fetch("/api/admin/vendor-pricing");
      if (response.ok) {
        const pricingData = await response.json();
        const formattedPricing: {
          [key: string]: { vendorPrice: number; discountPercentage: number };
        } = {};

        pricingData.forEach((item: any) => {
          formattedPricing[item.streamingAccountId] = {
            vendorPrice: item.vendorPrice,
            discountPercentage: 0,
          };
        });

        setVendorPricing(formattedPricing);
      }
    } catch (error) {
      //console.error("Error al cargar precios de vendedor:", error);
    }
  };

  const saveVendorPricing = async () => {
    setLoadingVendorPricing(true);
    try {
      const response = await fetch("/api/admin/vendor-pricing", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pricing: Object.fromEntries(
            Object.entries(vendorPricing).map(([id, data]) => [
              id,
              {
                vendorPrice: data.vendorPrice,
              },
            ]),
          ),
        }),
      });

      if (response.ok) {
        toast.success("Precios de vendedor actualizados correctamente");
        setShowVendorPricingModal(false);
      } else {
        toast.error("Error al actualizar precios de vendedor");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoadingVendorPricing(false);
    }
  };

  // Obtener contactos de soporte
  const fetchSupportContacts = async () => {
    try {
      const response = await fetch("/api/support-contacts");
      if (response.ok) {
        const data = await response.json();
        setSupportContacts(data.contacts || []);
      }
    } catch (error) {}
  };

  // Agregar contacto de soporte
  const addSupportContact = async () => {
    try {
      const response = await fetch("/api/support-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSupportContact),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setNewSupportContact({
          name: "",
          number: "",
          type: "whatsapp",
          description: "",
          isActive: true,
          order: 0,
        });
        fetchSupportContacts();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Error al agregar contacto");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  // Eliminar contacto de soporte
  const deleteSupportContact = async (id: string) => {
    try {
      const response = await fetch(`/api/support-contacts?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchSupportContacts();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Error al eliminar contacto");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  // Activar o desactivar el estado activo del contacto de soporte
  const toggleSupportContact = async (id: string) => {
    try {
      const response = await fetch(`/api/support-contacts/${id}/toggle`, {
        method: "PATCH",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchSupportContacts();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Error al actualizar contacto");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const fetchStockData = async (userOverride?: any) => {
    try {
      const currentUser = userOverride || user;

      const tempAdminFetch = async (url: string, options: RequestInit = {}) => {
        if (!currentUser?.id) {
          throw new Error("Usuario no autenticado");
        }

        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              "Content-Type": "application/json",
              "x-user-id": currentUser.id,
              ...options.headers,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response;
        } catch (error) {
          //console.error("tempAdminFetch error para", url, ":", error);
          throw error;
        }
      };

      const stockRes = await tempAdminFetch("/api/admin/stock-by-account");
      if (stockRes.ok) {
        const stockResult = await stockRes.json();
        if (stockResult.success) {
          setStockStatsData(stockResult.data);
        }
      }
    } catch (error) {
      //console.error("Error fetching stock data:", error);
    }
  };

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  };

  // Cargar página de usuarios (paginado con filtros) para la lista visible
  const fetchUsersData = async () => {
    try {
      if (!user?.id) {
        toast.error("Usuario no autenticado");
        return;
      }

      // Llamar con paginación y filtros
      const params = new URLSearchParams({
        page: userCurrentPage.toString(),
        limit: USERS_PER_PAGE.toString(),
        role: roleFilter,
        status: statusFilter,
        search: userSearchQuery.trim(),
        paginated: "true",
      });

      const res = await adminFetch(
        `/api/admin/users-search?${params.toString()}`,
      );
      const data = await res.json();

      if (data.success && data.paginated) {
        setUsersPage(data.data.users);
        setUserActionCounts(data.data.actionCounts);
        setUserTotalPages(data.data.pagination.totalPages);
        setTotalUsersCount(data.data.pagination.totalUsers);
      } else {
        toast.error("Error al cargar usuarios");
      }
    } catch (error) {
      toast.error("Error al cargar usuarios");
    }
  };

  const fetchTopUsers = async () => {
    try {
      const res = await adminFetch(
        "/api/admin/users?topBuyers=10&topVendors=10",
      );
      const data = await res.json();
      setTopBuyers(data.topBuyers || []);
      setTopVendors(data.topVendors || []);
    } catch (error) {
      console.error("Error fetching top users:", error);
    }
  };

  const fetchTypesData = async () => {
    try {
      if (!checkAuth()) return;

      const res = await adminFetch("/api/admin/streaming-types");
      const data = await res.json();
      setStreamingTypes(data);
    } catch (error) {
      toast.error("Error al cargar tipos de streaming");
    }
  };

  const fetchAccountsData = async () => {
    try {
      if (!checkAuth()) return;

      const res = await adminFetch("/api/admin/streaming-accounts");
      const data = await res.json();
      setAccounts(data);
    } catch (error) {
      toast.error("Error al cargar cuentas");
    }
  };

  // Cargar página de pedidos (paginado con filtros) para la lista visible
  const fetchOrdersData = async () => {
    try {
      if (!checkAuth()) return;

      const params = new URLSearchParams({
        page: orderCurrentPage.toString(),
        limit: ORDERS_PER_PAGE.toString(),
        renewal: renewalFilter,

        paginated: "true",
      });

      const res = await adminFetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.paginated) {
        setOrdersPage(data.data.orders);
        setOrderTotalPages(data.data.pagination.totalPages);
        setTotalOrdersCount(data.data.pagination.totalOrders);
      } else {
        toast.error("Error al cargar pedidos");
      }
    } catch (error) {
      toast.error("Error al cargar pedidos");
    }
  };

  const fetchOffersData = async () => {
    try {
      if (!checkAuth()) return;

      const res = await adminFetch("/api/admin/special-offers");
      const data = await res.json();
      setSpecialOffers(data);
    } catch (error) {
      toast.error("Error al cargar ofertas");
    }
  };

  const fetchExclusiveData = async () => {
    try {
      if (!checkAuth()) return;

      const res = await adminFetch("/api/admin/exclusive-accounts");
      const data = await res.json();
      setExclusiveAccounts(data);
    } catch (error) {
      toast.error("Error al cargar cuentas exclusivas");
    }
  };

  const fetchSupportContactsData = async () => {
    try {
      const res = await adminFetch("/api/admin/support-contacts");
      const data = await res.json();
      setSupportContacts(data || []);
    } catch (error) {
      toast.error("Error al cargar contactos de soporte");
    }
  };

  const fetchStatsData = async (forceRefresh = false) => {
    try {
      if (!checkAuth()) return;

      const url = forceRefresh
        ? "/api/admin/stats?refresh=true"
        : "/api/admin/stats";

      const res = await adminFetch(url);
      const data = await res.json();
      setStats(data);
    } catch (error) {
      toast.error("Error al cargar estadísticas");
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        // Si estamos editando, actualizar el editingType
        if (editingType) {
          setEditingType((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              imageUrl: data.url,
            };
          });
        } else {
          // Si estamos creando, actualizar el newStreamingType
          setNewStreamingType((prev) => ({
            ...prev,
            imageUrl: data.url,
          }));
        }

        toast.success("Imagen subida exitosamente");
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al subir imagen");
      }
    } catch (error) {
      toast.error("Error al subir imagen");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateStreamingType = async () => {
    // Validar que se haya subido una imagen
    if (!newStreamingType.name) {
      toast.error("El nombre es requerido");
      return;
    }

    if (!newStreamingType.imageUrl) {
      toast.error("Debes subir una imagen para el tipo");
      return;
    }

    try {
      const response = await adminFetch("/api/admin/streaming-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStreamingType),
      });

      if (response.ok) {
        toast.success("Tipo de streaming creado exitosamente");
        setNewStreamingType({
          name: "",
          description: "",
          imageUrl: "",
          color: "#3B82F6",
        });
        //fetchData();
        await fetchTypesData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error creando tipo de streaming");
      }
    } catch (error) {
      toast.error("Error creando tipo de streaming");
    }
  };

  const handleCreateAccount = async () => {
    try {
      const response = await adminFetch("/api/admin/streaming-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAccount),
      });

      if (response.ok) {
        toast.success("Cuenta creada exitosamente");
        setNewAccount({
          name: "",
          description: "",
          type: "",
          price: "",
          duration: "",
          quality: "4K HDR",
          screens: "",
          saleType: "FULL",
        });
        //fetchData();
        await fetchAccountsData();
      } else {
        toast.error("Error al crear cuenta");
      }
    } catch (error) {
      toast.error("Error al crear cuenta");
    }
  };

  const handleAddStock = async () => {
    try {
      const response = await adminFetch("/api/admin/add-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stockData),
      });

      if (response.ok) {
        toast.success("Stock agregado exitosamente");
        setStockData({
          accountType: "regular",
          streamingAccountId: "",
          exclusiveAccountId: "",
          saleType: "FULL",
          accounts: "",
          profiles: "",
          email: "",
          password: "",
          profileName: "",
          pin: "",
          notes: "",
        });
        //fetchData();
        await Promise.all([fetchAccountsData(), fetchStockData(user)]);
        refreshInventory();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || "Error al agregar stock");
      }
    } catch (error) {
      toast.error("Error al agregar stock");
    }
  };

  const handleAddExclusiveStock = async () => {
    if (
      !stockData.exclusiveAccountId ||
      !stockData.email ||
      !stockData.password
    ) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    try {
      const response = await adminFetch("/api/admin/exclusive-accounts/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exclusiveAccountId: stockData.exclusiveAccountId,
          email: stockData.email,
          password: stockData.password,
          profileName: stockData.profileName || undefined,
          pin: stockData.pin || undefined,
          notes: stockData.notes || undefined,
        }),
      });

      if (response.ok) {
        toast.success("Stock de cuenta exclusiva agregado exitosamente");
        setStockData({
          accountType: "regular",
          streamingAccountId: "",
          exclusiveAccountId: "",
          saleType: "FULL",
          accounts: "",
          profiles: "",
          email: "",
          password: "",
          profileName: "",
          pin: "",
          notes: "",
        });
        //fetchData();
        await Promise.all([fetchExclusiveData(), fetchStockData(user)]);
        refreshInventory();
      } else {
        const error = await response.json();
        toast.error(error.message || "Error al agregar stock exclusivo");
      }
    } catch (error) {
      toast.error("Error al agregar stock exclusivo");
    }
  };

  const handleCreateSpecialOffer = async () => {
    try {
      // Validar que los usuarios estén seleccionados (si no se aplica a todos)
      if (!applyToAllUsers && selectedUsersForOffer.length === 0) {
        toast.error(
          "Por favor selecciona al menos un usuario de las estadísticas o marca la opción de aplicar a todos",
        );
        return;
      }

      // Validar que la fecha de vencimiento sea futura (solo si se proporciona)
      if (
        newSpecialOffer.expiresAt &&
        newSpecialOffer.expiresAt.trim() !== ""
      ) {
        const expirationDate = new Date(newSpecialOffer.expiresAt);

        expirationDate.setHours(23, 59, 59, 999);
        if (expirationDate <= new Date()) {
          toast.error("La fecha de expiración debe ser en el futuro");
          return;
        }
      }

      // Convertir usuarios seleccionados en una matriz para API
      const offerData = {
        userIds: applyToAllUsers ? [] : selectedUsersForOffer,
        streamingAccountId: newSpecialOffer.streamingAccountId,
        discountPercentage: newSpecialOffer.discountPercentage,
        expiresAt: newSpecialOffer.expiresAt,
        applyToAllUsers: applyToAllUsers,
      };

      const response = await adminFetch("/api/admin/special-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offerData),
      });

      if (response.ok) {
        toast.success("Oferta especial creada exitosamente");
        setNewSpecialOffer({
          streamingAccountId: "",
          discountPercentage: "",
          expiresAt: "",
        });
        setSelectedUsersForOffer([]);

        await fetchOffersData();
      } else {
        toast.error("Error al crear oferta especial");
      }
    } catch (error) {
      toast.error("Error al crear oferta especial");
    }
  };

  const handleDeleteSpecialOffer = async (offerId: string) => {
    try {
      const response = await adminFetch(
        `/api/admin/special-offers/${offerId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        toast.success("Oferta eliminada exitosamente");

        await fetchOffersData();
      } else {
        toast.error("Error al eliminar oferta");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const isOfferExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getOfferStatus = (offer: any) => {
    if (!offer.isActive) return { status: "Inactiva", color: "bg-slate-600" };
    if (isOfferExpired(offer.expiresAt))
      return { status: "Expirada", color: "bg-red-600" };
    return { status: "Activa", color: "bg-green-600" };
  };

  const isExclusiveAccountExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getExclusiveAccountStatus = (account: any) => {
    if (!account.isActive) return { status: "Inactiva", color: "bg-slate-600" };
    if (isExclusiveAccountExpired(account.expiresAt))
      return { status: "Expirada", color: "bg-red-600" };
    return { status: "Activa", color: "bg-green-600" };
  };

  const handleCreateExclusiveAccount = async () => {
    try {
      // Validar que los usuarios estén seleccionados
      if (selectedUsersForExclusive.length === 0) {
        toast.error(
          "Por favor selecciona al menos un usuario de las estadísticas",
        );
        return;
      }

      // Validar que la fecha de vencimiento sea futura (solo si se proporciona)
      if (
        newExclusiveAccount.expiresAt &&
        newExclusiveAccount.expiresAt.trim() !== ""
      ) {
        const expirationDate = new Date(newExclusiveAccount.expiresAt);

        expirationDate.setHours(23, 59, 59, 999);
        if (expirationDate <= new Date()) {
          toast.error("La fecha de expiración debe ser en el futuro");
          return;
        }
      }

      const response = await adminFetch("/api/admin/exclusive-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newExclusiveAccount.name,
          description: newExclusiveAccount.description,
          type: newExclusiveAccount.type,
          price: parseFloat(newExclusiveAccount.price),
          duration: newExclusiveAccount.duration,
          quality: newExclusiveAccount.quality,
          screens: newExclusiveAccount.screens,
          saleType: newExclusiveAccount.saleType,
          isPublic: newExclusiveAccount.isPublic === "true",
          expiresAt: newExclusiveAccount.expiresAt || undefined,
          maxSlots: selectedUsersForExclusive.length || 1,
          allowedUsers:
            selectedUsersForExclusive.length > 0
              ? selectedUsersForExclusive
              : undefined,
        }),
      });

      if (response.ok) {
        toast.success("Cuenta exclusiva creada exitosamente");
        setNewExclusiveAccount({
          name: "",
          description: "",
          type: "",
          price: "",
          duration: "",
          quality: "4K HDR",
          screens: "",
          saleType: "FULL",

          isPublic: "false",
          expiresAt: "",
        });

        await fetchExclusiveData();
      } else {
        toast.error("Error al crear cuenta exclusiva");
      }
    } catch (error) {
      toast.error("Error al crear cuenta exclusiva");
    }
  };

  const handleDeleteExclusiveAccount = async (accountId: string) => {
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar esta cuenta exclusiva? Esta acción no se puede deshacer y eliminará todo el stock asociado.",
      )
    )
      return;

    try {
      const response = await adminFetch(
        `/api/admin/exclusive-accounts/${accountId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        toast.success("Cuenta exclusiva eliminada exitosamente");

        await fetchExclusiveData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Error al eliminar cuenta exclusiva");
      }
    } catch (error) {
      toast.error("Error al eliminar cuenta exclusiva");
    }
  };

  const handleViewUserOrders = async (user: User) => {
    try {
      const response = await adminFetch(`/api/admin/users/${user.id}/orders`);

      if (!response.ok) {
        const errorData = await response.json();

        toast.error(errorData.error || "Error al obtener pedidos del usuario");
        setUserOrders([]);
        setSelectedUser(user);
        setShowUserOrders(true);
        return;
      }

      const orders = await response.json();

      const ordersArray = Array.isArray(orders) ? orders : [];
      setUserOrders(ordersArray);
      setSelectedUser(user);
      setShowUserOrders(true);
      setExpandedOrders(new Set());
    } catch (error) {
      toast.error("Error al obtener pedidos del usuario");
      setUserOrders([]);
    }
  };

  const handleRechargeCredits = async (userId: string, amount: number) => {
    setIsRecharging(true);
    try {
      const response = await adminFetch("/api/admin/credit-recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount }),
      });

      if (response.ok) {
        toast.success("Créditos recargados exitosamente");
        setRechargingUserId(null);
        await fetchUsersData();
      } else {
        toast.error("Error al recargar créditos");
      }
    } catch (error) {
      toast.error("Error al recargar créditos");
    } finally {
      setIsRecharging(false);
    }
  };

  const handleCustomRecharge = (userId: string) => {
    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Por favor ingresa un monto válido");
      return;
    }
    handleRechargeCredits(userId, amount);
  };

  const fetchRechargeHistory = async (userId: string) => {
    setLoadingRechargeHistory(true);
    setSelectedUserForRechargeHistory(userId);

    try {
      const response = await adminFetch(
        `/api/admin/users/${userId}/recharge-history`,
      );
      if (response.ok) {
        const data = await response.json();
        setRechargeHistory(data.recharges || []);
        setShowRechargeHistory(true);
      } else {
        toast.error("Error al cargar el historial de recargas");
      }
    } catch (error) {
      toast.error("Error de conexión al cargar el historial");
    } finally {
      setLoadingRechargeHistory(false);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleOrderExpansionInGeneral = (orderId: string) => {
    const newExpanded = new Set(expandedOrdersInGeneral);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrdersInGeneral(newExpanded);
  };

  const handleRenewOrder = async (order: Order) => {
    if (
      !confirm(
        `¿Estás seguro de que quieres renovar esta cuenta?\n\n` +
          `Usuario: ${order.user.name || order.user.email}\n` +
          `Servicio: ${order.streamingAccount?.name || "Exclusive Account"}\n` +
          `Costo de renovación: ${formatCurrency(
            order.streamingAccount?.price || 0,
          )}\n\n` +
          `Se descontarán los créditos del usuario automáticamente.`,
      )
    ) {
      return;
    }

    try {
      const response = await adminFetch(`/api/admin/orders/${order.id}/renew`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          `Cuenta renovada exitosamente\n` +
            `Nueva fecha de vencimiento: ${new Date(
              data.order.newExpiresAt,
            ).toLocaleDateString()}\n` +
            `Total de renovaciones: ${data.order.renewalCount}`,
        );
        await fetchOrdersData();
      } else {
        toast.error(data.error || "Error al renovar la cuenta");
      }
    } catch (error) {
      toast.error("Error al renovar la cuenta");
    }
  };

  // Funciones de edición y eliminación de cuentas
  const handleEditAccount = (account: StreamingAccount) => {
    setEditingAccount(account);
    setShowEditAccountDialog(true);
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount) return;

    try {
      const response = await adminFetch(
        `/api/admin/streaming-accounts/${editingAccount.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingAccount),
        },
      );

      if (response.ok) {
        toast.success("Cuenta actualizada exitosamente");

        await fetchAccountsData();
        setShowEditAccountDialog(false);
        setEditingAccount(null);
      } else {
        toast.error("Error al actualizar cuenta");
      }
    } catch (error) {
      toast.error("Error al actualizar cuenta");
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar esta cuenta? Esta acción no se puede deshacer.",
      )
    )
      return;

    try {
      const response = await adminFetch(
        `/api/admin/streaming-accounts/${accountId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        toast.success("Cuenta eliminada exitosamente");

        await fetchAccountsData();
      } else {
        const errorData = await response.json();
        if (
          response.status === 400 &&
          errorData.error.includes("órdenes asociadas")
        ) {
          toast.error(
            `${errorData.error}. Órdenes afectadas: ${errorData.count}`,
          );
        } else {
          toast.error(errorData.error || "Error al eliminar cuenta");
        }
      }
    } catch (error) {
      toast.error("Error de conexión al eliminar cuenta");
    }
  };

  const handleToggleAccountStatus = async (
    accountId: string,
    currentStatus: boolean,
  ) => {
    const action = currentStatus ? "desactivar" : "activar";
    const confirmMessage = `¿Estás seguro de que quieres ${action} esta cuenta?${
      currentStatus
        ? " No aparecerá en el catálogo."
        : " Aparecerá en el catálogo nuevamente."
    }`;

    if (!confirm(confirmMessage)) return;

    try {
      const response = await adminFetch(
        `/api/admin/streaming-accounts/${accountId}/toggle-status`,
        {
          method: "PUT",
        },
      );

      if (response.ok) {
        const statusText = currentStatus ? "desactivada" : "activada";
        toast.success(`Cuenta ${statusText} exitosamente`);

        await fetchAccountsData();
      } else {
        toast.error("Error al cambiar estado de la cuenta");
      }
    } catch (error) {
      toast.error("Error al cambiar estado de la cuenta");
    }
  };

  // Ordenar funciones de rehabilitación.
  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setEditedOrderData({
      accountEmail: order.accountEmail || "",
      accountPassword: order.accountPassword || "",
      profileName: order.profileName || "",
      profilePin: order.profilePin || "",
    });
    setShowEditOrderDialog(true);
  };

  const handleUpdateOrderCredentials = async () => {
    if (!editingOrder) return;

    try {
      const response = await adminFetch(
        `/api/admin/orders/${editingOrder.id}/credentials`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editedOrderData),
        },
      );

      if (response.ok) {
        toast.success("Credenciales actualizadas exitosamente");

        await fetchOrdersData();
        setShowEditOrderDialog(false);
        setEditingOrder(null);
      } else {
        toast.error("Error al actualizar credenciales");
      }
    } catch (error) {
      toast.error("Error al actualizar credenciales");
    }
  };

  const handleRehabilitateOrder = async (order: Order) => {
    const isExpired = new Date(order.expiresAt) < new Date();
    const confirmMessage = `¿Estás seguro de que quieres rehabilitar este ${
      order.saleType === "FULL" ? "cuenta" : "perfil"
    } al stock?${
      isExpired ? " El pedido ha expirado." : " El pedido aún no ha expirado."
    }`;

    if (!confirm(confirmMessage)) return;

    try {
      const response = await adminFetch(
        `/api/admin/orders/${order.id}/rehabilitate`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountEmail: order.accountEmail,
            accountPassword: order.accountPassword,
            profileName: order.profileName,
            profilePin: order.profilePin,
            saleType: order.saleType,
            streamingAccountId: order.streamingAccount?.id || "",
          }),
        },
      );

      if (response.ok) {
        toast.success(
          `${
            order.saleType === "FULL" ? "Cuenta" : "Perfil"
          } rehabilitado exitosamente`,
        );

        await fetchOrdersData();
      } else {
        toast.error("Error al rehabilitar");
      }
    } catch (error) {
      toast.error("Error al rehabilitar");
    }
  };

  // Editar y eliminar funciones para tipos
  const handleEditType = (type: StreamingType) => {
    setEditingType(type);
    setShowEditTypeDialog(true);
  };

  const handleUpdateType = async () => {
    if (!editingType) return;

    try {
      const response = await adminFetch(
        `/api/admin/streaming-types/${editingType.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingType),
        },
      );

      if (response.ok) {
        toast.success("Tipo actualizado exitosamente");

        await fetchTypesData();
        setShowEditTypeDialog(false);
        setEditingType(null);
      } else {
        toast.error("Error al actualizar tipo");
      }
    } catch (error) {
      toast.error("Error al actualizar tipo");
    }
  };

  const handleDeleteType = async (typeId: string) => {
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar este tipo? Esta acción no se puede deshacer.",
      )
    )
      return;

    try {
      const response = await adminFetch(
        `/api/admin/streaming-types/${typeId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        toast.success("Tipo eliminado exitosamente");

        await fetchTypesData();
      } else {
        const errorData = await response.json();
        if (
          response.status === 400 &&
          errorData.error.includes("cuentas asociadas")
        ) {
          toast.error(
            `${errorData.error}. Cuentas afectadas: ${errorData.count}`,
          );
        } else {
          toast.error(errorData.error || "Error al eliminar tipo");
        }
      }
    } catch (error) {
      toast.error("Error de conexión al eliminar tipo");
    }
  };

  // Funciones mejoradas de gestión de permisos
  const openPermissionManager = (user: User) => {
    setSelectedUserForPermissions(user);
    setShowPermissionManager(true);
  };

  const handleBroadcastMessage = async () => {
    if (!broadcastMessage.title.trim() || !broadcastMessage.content.trim()) {
      toast.error("Por favor completa el título y el contenido del mensaje");
      return;
    }

    try {
      const response = await adminFetch("/api/admin/broadcast-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: broadcastMessage.title,
          content: broadcastMessage.content,
          type: broadcastMessage.type,
          sendToTelegram: broadcastMessage.sendToTelegram,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          `Mensaje enviado a ${data.messageCount} usuarios exitosamente`,
        );
        setShowBroadcastModal(false);
        setBroadcastMessage({
          title: "",
          content: "",
          type: "GENERAL",
          sendToTelegram: true,
        });
      } else {
        const errorData = await response.json();
        //console.error("Broadcast message error:", errorData);

        if (errorData.debug) {
          toast.error(
            `${errorData.error}. Debug: ${JSON.stringify(errorData.debug)}`,
          );
        } else {
          toast.error(errorData.error || "Error al enviar mensaje");
        }
      }
    } catch (error) {
      toast.error("Error de conexión al enviar mensaje");
    }
  };

  // Funciones para manejar la información de registro de usuarios
  const toggleUserRegistration = async (userId: string) => {
    const isExpanded = expandedUserRegistration.has(userId);

    if (isExpanded) {
      // Colapsar
      setExpandedUserRegistration((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      setUserRegistrationData((prev) => {
        const newData = { ...prev };
        delete newData[userId];
        return newData;
      });
      setEditingUserRegistration(null);
    } else {
      // Expandir y cargar datos
      setExpandedUserRegistration((prev) => new Set(prev).add(userId));
      setLoadingUserRegistration((prev) => new Set(prev).add(userId));

      try {
        const response = await adminFetch(
          `/api/admin/users/${userId}/registration-info`,
        );
        //console.log("Response status:", response.status);
        if (response.ok) {
          const data = await response.json();
          //console.log("Datos recibidos:", data);
          setUserRegistrationData((prev) => ({
            ...prev,
            [userId]: data.registrationInfo || {
              fullName: "",
              username: "",
              email: "",
              phone: "",
              credits: 0,
              role: "USER",
              password: "",
              confirmPassword: "",
            },
          }));
        } else {
          const errorData = await response.json();
          //console.error("Error response:", errorData);
          toast.error("Error al cargar información de registro");
        }
      } catch (error) {
        //console.error("Error en toggleUserRegistration:", error);
        toast.error("Error de conexión");
      } finally {
        setLoadingUserRegistration((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    }
  };

  const handleUpdateRegistrationInfo = async (userId: string) => {
    const registrationInfo = userRegistrationData[userId];
    if (!registrationInfo) return;

    // Validaciones básicas
    if (!registrationInfo.fullName?.trim()) {
      toast.error("El nombre completo es requerido");
      return;
    }
    if (!registrationInfo.email?.trim()) {
      toast.error("El email es requerido");
      return;
    }
    if (!registrationInfo.username?.trim()) {
      toast.error("El nombre de usuario es requerido");
      return;
    }
    if (!registrationInfo.phone?.trim()) {
      toast.error("El telefono es necesario");
      return;
    }

    setLoadingUserRegistration((prev) => new Set(prev).add(userId));

    try {
      const response = await adminFetch(
        `/api/admin/users/${userId}/registration-info`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: registrationInfo.fullName,
            username: registrationInfo.username,
            email: registrationInfo.email,
            phone: registrationInfo.phone,
            credits: registrationInfo.credits || 0,
            role: registrationInfo.role || "USER",
            password: registrationInfo.password || undefined,
            confirmPassword: registrationInfo.confirmPassword || undefined,
          }),
        },
      );

      if (response.ok) {
        toast.success("Información de registro actualizada exitosamente");
        setEditingUserRegistration(null);

        await fetchUsersData();
      } else {
        if (response.ok) {
          toast.success("Información de registro actualizada exitosamente");
          setEditingUserRegistration(null);

          await fetchUsersData();
        } else {
          const errorData = await response.json();
          if (errorData.code === "PHONE_LOCKED_BY_TELEGRAM") {
            toast.error(
              "⚠️ No se puede modificar el teléfono de un usuario verificado por Telegram.",
            );
          } else {
            toast.error(errorData.error || "Error al actualizar información");
          }
        }
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoadingUserRegistration((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleRegistrationInputChange = (
    userId: string,
    field: string,
    value: string,
  ) => {
    setUserRegistrationData((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-6">
          {/* Logotipo/icono animado */}
          <div className="relative">
            <div className="w-20 h-20 relative">
              {/* Anillo giratorio exterior */}
              <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-spin-slow"></div>
              <div className="absolute inset-2 border-4 border-transparent border-t-emerald-500 border-r-teal-500 rounded-full animate-spin"></div>

              {/* Contenido del centro */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg animate-pulse"></div>
              </div>

              {/* Puntos en órbita */}
              <div className="absolute inset-0 animate-spin-slow">
                <div className="absolute top-0 left-1/2 w-2 h-2 bg-emerald-400 rounded-full transform -translate-x-1/2 -translate-y-1"></div>
                <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-teal-400 rounded-full transform -translate-x-1/2 translate-y-1"></div>
                <div className="absolute left-0 top-1/2 w-2 h-2 bg-cyan-400 rounded-full transform -translate-y-1/2 -translate-x-1"></div>
                <div className="absolute right-0 top-1/2 w-2 h-2 bg-blue-400 rounded-full transform -translate-y-1/2 translate-x-1"></div>
              </div>
            </div>
          </div>

          {/*texto de carga */}
          <div className="flex flex-col items-center space-y-2">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 animate-pulse">
              RiyoStream Admin
            </h1>
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div
                  className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
              <span className="text-slate-300 text-sm font-medium">
                Cargando panel
              </span>
              <div className="flex space-x-1">
                <div
                  className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                  style={{ animationDelay: "450ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                  style={{ animationDelay: "600ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                  style={{ animationDelay: "750ms" }}
                ></div>
              </div>
            </div>
            <p className="text-slate-500 text-xs">
              Preparando el sistema de administración...
            </p>
          </div>

          {/* Barra de progreso */}
          <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full animate-pulse-slow"
              style={{
                width: "60%",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            ></div>
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
          @keyframes pulse-slow {
            0%,
            100% {
              opacity: 0.4;
            }
            50% {
              opacity: 1;
            }
          }
          .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
          }
          .animate-pulse-slow {
            animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}</style>
      </div>
    );
  }

  // Comprobación de administrador adicional para la protección en tiempo de renderizado
  const isAdmin = user?.role === "ADMIN";

  // Mostrar cargando o redirigir si no es administrador
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Acceso Restringido
          </h2>
          <p className="text-slate-400 mb-6">
            No tienes permisos para acceder a esta área
          </p>
          <Button
            onClick={() => (window.location.href = "/")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Ir al Inicio
          </Button>
        </div>
      </div>
    );
  }

  const handleMoveAccount = async (
    accountId: string,
    currentOrder: number,
    direction: "up" | "down",
  ) => {
    try {
      // Ordenar cuentas por order, luego por id para estabilidad
      const sortedAccounts = [...accounts].sort(
        (a, b) => a.order - b.order || a.id.localeCompare(b.id),
      );
      const currentIndex = sortedAccounts.findIndex((a) => a.id === accountId);

      if (currentIndex === -1) return;

      // No mover la primera hacia arriba ni la última hacia abajo
      if (direction === "up" && currentIndex === 0) {
        toast.error("Esta cuenta ya está en la primera posición");
        return;
      }
      if (direction === "down" && currentIndex === sortedAccounts.length - 1) {
        toast.error("Esta cuenta ya está en la última posición");
        return;
      }

      const adjacentIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const adjacentAccount = sortedAccounts[adjacentIndex];

      // Intercambiar: la adyacente toma el order actual, y la actual toma el order de la adyacente
      await adminFetch(
        `/api/admin/streaming-accounts/${adjacentAccount.id}/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: currentOrder }),
        },
      );

      const response = await adminFetch(
        `/api/admin/streaming-accounts/${accountId}/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: adjacentAccount.order }),
        },
      );

      if (response.ok) {
        toast.success(
          direction === "up" ? "Cuenta movida arriba" : "Cuenta movida abajo",
        );
        fetchAccountsData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Error al reordenar");
      }
    } catch (error) {
      toast.error("Error al reordenar");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <Navigation
        user={user}
        cartItemsCount={cartItems.length}
        onCartOpen={() => setIsCartOpen(true)}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex-wrad items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  Panel de Administración
                </h1>
                <p className="text-slate-400">
                  Gestiona tu sistema de streaming
                </p>
              </div>
              <Button
                onClick={async () => {
                  await loadBannerData();
                  setShowBannerModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configurar Banner
              </Button>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-1 overflow-x-auto">
              {/* <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-1 bg-transparent h-auto p-0"> */}
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-1 bg-transparent h-auto p-0">
                <TabsTrigger
                  value="resumen"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="hidden sm:inline">Resumen</span>
                  <span className="sm:hidden">Resumen</span>
                </TabsTrigger>
                <TabsTrigger
                  value="tipos"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Tipos</span>
                  <span className="sm:hidden">Tipos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="cuentas"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <Package className="w-4 h-4" />
                  <span className="hidden sm:inline">Cuentas</span>
                  <span className="sm:hidden">Cuentas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="stock"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">Stock</span>
                  <span className="sm:hidden">Stock</span>
                </TabsTrigger>
                <TabsTrigger
                  value="pedidos"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="hidden sm:inline">Pedidos</span>
                  <span className="sm:hidden">Pedidos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="usuarios"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Usuarios</span>
                  <span className="sm:hidden">Usuarios</span>
                </TabsTrigger>
                <TabsTrigger
                  value="ofertas"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <Gift className="w-4 h-4" />
                  <span className="hidden sm:inline">Ofertas</span>
                  <span className="sm:hidden">Ofertas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="exclusivas"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <Crown className="w-4 h-4" />
                  <span className="hidden sm:inline">Exclusivas</span>
                  <span className="sm:hidden">Exclusivas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="soporte"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 flex-col gap-0.5 h-auto py-0.5 px-2 text-xs md:text-sm"
                >
                  <Headphones className="w-4 h-4" />
                  <span className="hidden sm:inline">Soporte</span>
                  <span className="sm:hidden">Soporte</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Resumen */}
            <Suspense fallback={<AnalyticsSkeleton />}>
              <TabsContent value="resumen" className="space-y-8">
                {/* KPIs Principales */}
                <div>
                  <div className="flex-wrap items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Indicadores Clave de Rendimiento
                    </h2>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                          isConnected
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isConnected ? "bg-emerald-400" : "bg-red-400"
                          } animate-pulse`}
                        />
                        {isConnected ? "En vivo" : "Desconectado"}
                      </div>
                      {lastUpdate && (
                        <span className="text-xs text-slate-400">
                          Actualizado: {lastUpdate.toLocaleTimeString()}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={refreshStats}
                        className="border-slate-600 text-slate-300 hover:bg-slate-600"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Actualizar
                      </Button>
                    </div>
                  </div>
                  {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"> */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-400">
                              Total Usuarios
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                              {realTimeStats?.totalUsers?.toLocaleString() ||
                                stats.totalUsers.toLocaleString()}
                            </p>
                            <p className="text-xs text-emerald-400 mt-1">
                              {realTimeStats?.activeUsers || stats.activeUsers}{" "}
                              activos
                            </p>
                          </div>
                          <div className="bg-emerald-500/20 p-3 rounded-lg">
                            <Users className="h-6 w-6 text-emerald-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-400">
                              Total Pedidos
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                              {realTimeStats?.totalOrders?.toLocaleString() ||
                                stats.totalOrders.toLocaleString()}
                            </p>
                            <p className="text-xs text-blue-400 mt-1">
                              Ingresos:{" "}
                              {formatCurrency(realTimeStats?.totalRevenue || 0)}
                            </p>
                          </div>
                          <div className="bg-blue-500/20 p-3 rounded-lg">
                            <ShoppingBag className="h-6 w-6 text-blue-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-400">
                              Tasa Conversión
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                              {formatPercent(
                                realTimeStats?.conversionRate ||
                                  stats.conversionRate,
                              )}
                            </p>
                            <p className="text-xs text-purple-400 mt-1">
                              {realTimeStats?.activeUsers || stats.activeUsers}{" "}
                              usuarios activos
                            </p>
                          </div>
                          <div className="bg-purple-500/20 p-3 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-purple-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-400">
                              Créditos
                            </p>
                            <p className="text-2xl font-bold text-blue-400 mt-1">
                              {formatCurrency(
                                realTimeStats?.totalCredits ||
                                  stats.totalCredits,
                              )}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Disponibles
                            </p>
                          </div>
                          <div className="bg-blue-500/20 p-3 rounded-lg">
                            <CreditCard className="h-6 w-6 text-blue-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Inventario */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Package className="h-4 w-4 text-emerald-400" />
                      Inventario
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {accounts.length + exclusiveAccounts.length} cuentas
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshInventory}
                        className="h-8 px-3 text-xs border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Actualizar
                      </Button>
                    </div>
                  </div>

                  {/* <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2"> */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {/* Cuentas Regulares */}
                    {accounts.map((account) => {
                      const totalStock =
                        (account._count.accountStocks || 0) +
                        (account._count.profileStocks || 0);

                      return (
                        <div
                          key={account.id}
                          className="bg-slate-900/50 border border-slate-700 rounded-lg p-2 hover:bg-slate-900/70 transition-colors cursor-pointer"
                          onClick={() => fetchInventoryStocks(account, false)}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-1">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                account.isActive
                                  ? "bg-emerald-400"
                                  : "bg-red-400"
                              }`}
                            />
                            {account.saleType === "EXCLUSIVE" && (
                              <span className="px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[8px]">
                                E
                              </span>
                            )}
                          </div>

                          {/* Nombre */}
                          <div
                            className="text-sm font-medium text-white mb-1 truncate"
                            title={account.name}
                          >
                            {account.name}
                          </div>

                          {/* Tipo */}
                          <div className="text-xs text-slate-400 mb-1">
                            {account.type}
                          </div>

                          {/* Stock */}
                          <div
                            className={`text-lg font-bold text-center mb-1 ${
                              totalStock === 0
                                ? "text-red-400"
                                : totalStock <= 2
                                  ? "text-yellow-400"
                                  : totalStock <= 5
                                    ? "text-blue-400"
                                    : "text-emerald-400"
                            }`}
                          >
                            {totalStock}
                          </div>

                          <div className="text-xs text-slate-500 text-center mb-1">
                            unidades
                          </div>

                          {/* Precio */}
                          <div className="text-sm text-emerald-400 text-center mb-1">
                            {formatCurrency(account.price)}
                          </div>

                          {/* Cuentas/Perfiles */}
                          <div className="text-xs text-slate-400 text-center mb-1">
                            {account._count.accountStocks || 0}/
                            {account._count.profileStocks || 0}
                          </div>

                          {/* Estado */}
                          <div
                            className={`px-2 py-1 rounded text-xs text-center w-full ${
                              account.isActive
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {account.isActive ? "Activa" : "Inactiva"}
                          </div>
                        </div>
                      );
                    })}

                    {/* Cuentas Exclusivas */}
                    {exclusiveAccounts.map((account) => {
                      // Calcular stock disponible: stocks totales - stocks vendidos
                      const totalStock = account.exclusiveStocks?.length || 0;
                      const soldStock =
                        account.exclusiveStocks?.filter(
                          (stock) => !stock.isAvailable,
                        ).length || 0;
                      const availableStock = totalStock - soldStock;

                      return (
                        <div
                          key={account.id}
                          className="bg-gradient-to-br from-amber-900/20 to-yellow-900/20 border border-amber-500/30 rounded-lg p-2 hover:from-amber-900/30 hover:to-yellow-900/30 transition-all relative cursor-pointer"
                          onClick={() => fetchInventoryStocks(account, true)}
                        >
                          {/* Efecto de brillo dorado */}
                          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-yellow-600/10 to-orange-600/10 rounded-lg"></div>

                          {/* Header */}
                          <div className="flex items-center justify-between mb-1 relative">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                account.isActive ? "bg-amber-400" : "bg-red-400"
                              }`}
                            />
                            <span className="px-1 py-0.5 bg-amber-500/30 text-yellow-300 rounded text-[8px] border border-amber-400/50">
                              EXCL
                            </span>
                          </div>

                          {/* Nombre */}
                          <div
                            className="text-sm font-medium text-white mb-1 truncate relative"
                            title={account.name}
                          >
                            {account.name}
                          </div>

                          {/* Tipo */}
                          <div className="text-xs text-amber-200 mb-1 relative">
                            {account.type}
                          </div>

                          {/* Stock */}
                          <div
                            className={`text-lg font-bold text-center mb-1 relative ${
                              availableStock === 0
                                ? "text-red-400"
                                : availableStock <= 2
                                  ? "text-yellow-300"
                                  : availableStock <= 5
                                    ? "text-amber-300"
                                    : "text-yellow-200"
                            }`}
                          >
                            {availableStock}
                          </div>

                          <div className="text-xs text-amber-300/70 text-center mb-1 relative">
                            unidades
                          </div>

                          {/* Precio */}
                          <div className="text-sm text-yellow-300 text-center mb-1 relative">
                            {formatCurrency(account.price)}
                          </div>

                          {/* Cuentas/Perfiles */}
                          <div className="text-xs text-amber-200/70 text-center mb-1 relative">
                            {soldStock} vendidas
                          </div>

                          {/* Estado */}
                          <div
                            className={`px-2 py-1 rounded text-xs text-center w-full relative ${
                              account.isActive
                                ? "bg-amber-500/30 text-yellow-300 border border-amber-400/50"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {account.isActive ? "Activa" : "Inactiva"}
                          </div>
                        </div>
                      );
                    })}

                    {accounts.length === 0 &&
                      exclusiveAccounts.length === 0 && (
                        <div className="col-span-full text-center py-8 text-slate-400 text-sm">
                          No hay cuentas registradas
                        </div>
                      )}
                  </div>
                </div>

                <div>
                  <div>
                    <ProfitsCard />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Activity className="h-5 w-5 mr-2 mt-2" />
                    Actividad Reciente
                  </h2>
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">
                          Últimas transacciones
                        </h3>
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                            isConnected
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              isConnected ? "bg-emerald-400" : "bg-red-400"
                            } animate-pulse`}
                          />
                          En vivo
                        </div>
                      </div>
                      <div className="space-y-3">
                        {(realTimeStats?.recentActivity || stats.recentActivity)
                          .slice(0, 5)
                          .map((activity, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
                            >
                              <div className="flex-shrink-0">
                                {activity.icon === "ShoppingCart" && (
                                  <ShoppingCart className="h-4 w-4 text-blue-400" />
                                )}
                                {activity.icon === "Users" && (
                                  <Users className="h-4 w-4 text-emerald-400" />
                                )}
                                {activity.icon === "CreditCard" && (
                                  <CreditCard className="h-4 w-4 text-purple-400" />
                                )}
                                {![
                                  "ShoppingCart",
                                  "Users",
                                  "CreditCard",
                                ].includes(activity.icon) && (
                                  <Activity className="h-4 w-4 text-orange-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-white">
                                  {activity.description}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {activity.time}
                                </p>
                              </div>
                            </div>
                          ))}
                        {!realTimeStats?.recentActivity?.length &&
                          !stats.recentActivity?.length && (
                            <div className="text-center py-8">
                              <Activity className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                              <p className="text-slate-400 text-sm">
                                Sin actividad reciente
                              </p>
                            </div>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Métricas del Negocio */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Métricas del Negocio
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshBusinessMetrics}
                      className="h-8 px-3 text-xs border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Actualizar
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <PieChart className="h-5 w-5 text-emerald-400" />
                          Ventas por Tipo
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          Distribución de ventas por plataforma
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <div className="space-y-4 pr-4">
                            {stats.salesByType.map((type, index) => {
                              const colors = [
                                "bg-red-500",
                                "bg-blue-500",
                                "bg-purple-500",
                                "bg-orange-500",
                                "bg-green-500",
                              ];
                              const color = colors[index % colors.length];
                              const totalRevenue = stats.salesByType.reduce(
                                (sum, t) => sum + t.revenue,
                                0,
                              );
                              const percentage =
                                totalRevenue > 0
                                  ? (type.revenue / totalRevenue) * 100
                                  : 0;

                              return (
                                <div
                                  key={index}
                                  className="flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-3 h-3 rounded-full ${color}`}
                                    ></div>
                                    <span className="text-sm text-slate-300">
                                      {type.type}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 w-24">
                                      <div className="bg-slate-700 rounded-full h-4 relative overflow-hidden">
                                        <div
                                          className={`${color} h-full rounded-full transition-all duration-500`}
                                          style={{
                                            width: `${Math.max(
                                              percentage,
                                              5,
                                            )}%`,
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm text-white font-medium">
                                        {formatCurrency(type.revenue)}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {type.count} pedidos
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Star className="h-5 w-5 text-emerald-400" />
                          Productos Más Vendidos
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          Los productos con más ventas este mes
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <div className="space-y-3 pr-4">
                            {stats.topProducts
                              .slice(0, 5)
                              .map((product, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-white">
                                        {product.name}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {product.type}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-white">
                                      {product.sales} ventas
                                    </div>
                                    <div className="text-xs text-emerald-400">
                                      {formatCurrency(product.revenue)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                {/* Modal de Inventario */}
                <Dialog
                  open={inventoryModalOpen}
                  onOpenChange={setInventoryModalOpen}
                >
                  <DialogContent className="max-w-3xl w-[97vw] max-h-[80vh] overflow-hidden bg-slate-800 border-slate-700">
                    <DialogHeader>
                      <DialogTitle className="text-white text-lg">
                        <Package className="w-5 h-5 inline mr-2" />
                        {selectedInventoryAccount?.name || "Cuenta"} -
                        Inventario
                      </DialogTitle>
                      <DialogDescription className="text-slate-400">
                        {selectedInventoryAccount?.type} -{" "}
                        {inventoryStocks.length} cuentas en total
                      </DialogDescription>
                    </DialogHeader>

                    <div className="overflow-y-auto max-h-[60vh]">
                      {inventoryLoading ? (
                        <div className="text-center py-8 text-slate-400">
                          Cargando...
                        </div>
                      ) : inventoryStocks.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          No hay cuentas registradas
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {inventoryStocks.map((stock) => (
                            <div
                              key={stock.id}
                              className="flex items-center justify-between p-3 rounded-lg border"
                            >
                              <div className="flex-1">
                                <p className="text-sm text-white font-medium font-mono">
                                  {stock.email}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {new Date(stock.createdAt).toLocaleDateString(
                                    "es-CO",
                                    {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                  {stock.type && ` · ${stock.type}`}
                                </p>
                              </div>
                              <div>
                                {stock.isAvailable ? (
                                  <Badge className="bg-green-600">
                                    Disponible
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-600">Vendida</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </Suspense>

            {/* Tipos de Streaming */}
            <TabsContent value="tipos" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  Tipos de Streaming
                </h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Tipo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-800 border-slate-700">
                    <DialogHeader>
                      <DialogTitle className="text-white">
                        Crear Nuevo Tipo de Streaming
                      </DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Agrega un nuevo tipo de servicio de streaming
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="typeName" className="text-slate-300">
                          Nombre
                        </Label>
                        <Input
                          id="typeName"
                          value={newStreamingType.name}
                          onChange={(e) =>
                            setNewStreamingType({
                              ...newStreamingType,
                              name: e.target.value,
                            })
                          }
                          placeholder="Netflix"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>

                      <div>
                        <div>
                          <Label htmlFor="typeImage" className="text-slate-300">
                            Imagen del Tipo *
                          </Label>
                          <div className="space-y-3">
                            {/* Opciones de imagen */}
                            <div className="grid grid-cols-1 gap-3">
                              {/* Opción 1: Subir nueva imagen */}
                              <div className="space-y-2">
                                <Label className="text-xs text-slate-400">
                                  Opción 1: Subir nueva imagen
                                </Label>
                                <Input
                                  id="typeImage"
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                  onChange={handleImageUpload}
                                  disabled={uploadingImage}
                                  className="bg-slate-700 border-slate-600 text-white file:bg-slate-600 file:text-white file:border-0"
                                />
                                {uploadingImage && (
                                  <div className="flex items-center space-x-2 text-sm text-slate-400">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Subiendo imagen...</span>
                                  </div>
                                )}
                              </div>

                              {/* Opción 2: Usar galería */}
                              <div className="space-y-2">
                                <Label className="text-xs text-slate-400">
                                  Opción 2: Seleccionar de la galería
                                </Label>
                                <ImageGallery
                                  onSelectImage={(base64) => {
                                    setNewStreamingType((prev) => ({
                                      ...prev,
                                      imageUrl: base64,
                                    }));
                                    toast.success(
                                      "Imagen seleccionada de la galería",
                                    );
                                  }}
                                  currentImage={newStreamingType.imageUrl}
                                />
                              </div>
                            </div>

                            {/* Vista previa de la imagen seleccionada */}
                            {newStreamingType.imageUrl && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-3 p-3 bg-slate-700 rounded-lg border border-slate-600">
                                  <img
                                    src={newStreamingType.imageUrl}
                                    alt="Preview"
                                    className="w-16 h-16 object-cover rounded-lg border-2 border-slate-500"
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm text-green-400 font-medium">
                                      ✓ Imagen seleccionada
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      Lista para usar
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setNewStreamingType((prev) => ({
                                        ...prev,
                                        imageUrl: "",
                                      }))
                                    }
                                    className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {!newStreamingType.imageUrl && !uploadingImage && (
                              <p className="text-sm text-amber-400">
                                ⚠ Debes seleccionar una imagen (subir nueva o de
                                la galería)
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="typeColor" className="text-slate-300">
                          Color del Tema
                        </Label>
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Input
                              id="typeColor"
                              type="color"
                              value={newStreamingType.color}
                              onChange={(e) =>
                                setNewStreamingType({
                                  ...newStreamingType,
                                  color: e.target.value,
                                })
                              }
                              className="bg-slate-700 border-slate-600 text-white h-12 w-20 rounded cursor-pointer"
                              style={{
                                backgroundColor: newStreamingType.color,
                                borderColor: newStreamingType.color,
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <Input
                              type="text"
                              value={newStreamingType.color}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                  setNewStreamingType({
                                    ...newStreamingType,
                                    color: value,
                                  });
                                }
                              }}
                              placeholder="#000000"
                              className="bg-slate-700 border-slate-600 text-white font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Color para las tarjetas de este servicio
                            </p>
                          </div>
                        </div>
                        <div
                          className="mt-2 h-8 rounded border border-slate-600"
                          style={{ backgroundColor: newStreamingType.color }}
                        ></div>
                      </div>
                      <Button
                        onClick={handleCreateStreamingType}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Crear Tipo
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-6">
                {streamingTypes.map((type) => (
                  <Card key={type.id} className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {type.imageUrl ? (
                            <img
                              src={type.imageUrl}
                              alt={type.name}
                              className="w-12 h-12 rounded-lg object-cover border-2 border-slate-600"
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                              style={{ backgroundColor: type.color + "20" }}
                            >
                              📺
                            </div>
                          )}
                          <div>
                            <CardTitle className="text-white">
                              {type.name}
                            </CardTitle>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={type.isActive ? "default" : "secondary"}
                            className={
                              type.isActive ? "bg-green-600" : "bg-slate-600"
                            }
                          >
                            {type.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditType(type)}
                            className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteType(type.id)}
                            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Cuentas */}
            <TabsContent value="cuentas" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Crear Nueva Cuenta
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Agrega nuevas cuentas de streaming al catálogo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name" className="text-slate-300">
                        Nombre
                      </Label>
                      <Input
                        id="name"
                        value={newAccount.name}
                        onChange={(e) =>
                          setNewAccount({ ...newAccount, name: e.target.value })
                        }
                        placeholder="Netflix Premium"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description" className="text-slate-300">
                        Descripción
                      </Label>
                      <Input
                        id="description"
                        value={newAccount.description}
                        onChange={(e) =>
                          setNewAccount({
                            ...newAccount,
                            description: e.target.value,
                          })
                        }
                        placeholder="Acceso completo a todo el catálogo"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="type" className="text-slate-300">
                        Tipo
                      </Label>
                      <Select
                        value={newAccount.type}
                        onValueChange={(value) =>
                          setNewAccount({ ...newAccount, type: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue placeholder="Selecciona el tipo" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {streamingTypes.map((type) => (
                            <SelectItem
                              key={type.id}
                              value={type.name}
                              className="text-white"
                            >
                              <div className="flex items-center space-x-2">
                                {type.imageUrl ? (
                                  <img
                                    src={type.imageUrl}
                                    alt={type.name}
                                    className="w-5 h-5 rounded object-cover"
                                  />
                                ) : (
                                  <span>📺</span>
                                )}
                                <span>{type.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="price" className="text-slate-300">
                        Precio (COP)
                      </Label>
                      <Input
                        id="price"
                        type="number"
                        value={newAccount.price}
                        onChange={(e) =>
                          setNewAccount({
                            ...newAccount,
                            price: e.target.value,
                          })
                        }
                        placeholder="50000"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="duration" className="text-slate-300">
                        Duración
                      </Label>
                      <Select
                        value={newAccount.duration}
                        onValueChange={(value) =>
                          setNewAccount({ ...newAccount, duration: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue placeholder="Selecciona la duración" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="1 mes" className="text-white">
                            1 Mes
                          </SelectItem>
                          <SelectItem value="3 meses" className="text-white">
                            3 Meses
                          </SelectItem>
                          <SelectItem value="6 meses" className="text-white">
                            6 Meses
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="quality" className="text-slate-300">
                        Calidad
                      </Label>
                      <Select
                        value={newAccount.quality}
                        onValueChange={(value) =>
                          setNewAccount({ ...newAccount, quality: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue placeholder="Selecciona la calidad" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="HD" className="text-white">
                            HD (720p)
                          </SelectItem>
                          <SelectItem value="Full HD" className="text-white">
                            Full HD (1080p)
                          </SelectItem>
                          <SelectItem value="4K UHD" className="text-white">
                            4K UHD (2160p)
                          </SelectItem>
                          <SelectItem value="4K HDR" className="text-white">
                            4K HDR
                          </SelectItem>
                          <SelectItem value="8K" className="text-white">
                            8K (4320p)
                          </SelectItem>
                          <SelectItem value="SD" className="text-white">
                            SD (480p)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="screens" className="text-slate-300">
                        Pantallas
                      </Label>
                      <Select
                        value={newAccount.screens}
                        onValueChange={(value) =>
                          setNewAccount({ ...newAccount, screens: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue placeholder="Selecciona número de pantallas" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="1" className="text-white">
                            1 pantalla
                          </SelectItem>
                          <SelectItem value="2" className="text-white">
                            2 pantallas
                          </SelectItem>
                          <SelectItem value="3" className="text-white">
                            3 pantallas
                          </SelectItem>
                          <SelectItem value="4" className="text-white">
                            4 pantallas
                          </SelectItem>
                          <SelectItem value="5" className="text-white">
                            5 pantallas
                          </SelectItem>
                          <SelectItem value="6" className="text-white">
                            6 pantallas
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="saleType" className="text-slate-300">
                        Tipo de Venta
                      </Label>
                      <Select
                        value={newAccount.saleType}
                        onValueChange={(value) =>
                          setNewAccount({ ...newAccount, saleType: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="FULL" className="text-white">
                            Cuenta Completa
                          </SelectItem>
                          <SelectItem value="PROFILES" className="text-white">
                            Por Perfiles
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateAccount}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Cuenta
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex justify-between">
                  <CardTitle className="text-white">
                    Cuentas Existentes
                  </CardTitle>
                  <div className="flex justify-between items-center mb-6">
                    {/* <h2 className="text-2xl font-bold">Cuentas de Streaming</h2> */}
                    <div className="flex gap-2">
                      <Button
                        onClick={async () => {
                          setShowVendorPricingModal(true);
                          await loadVendorPricing();
                        }}
                        variant="outline"
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 hover:text-white border-none font-bold text-white"
                      >
                        <Percent className="w-4 h-4 font-bold text-white" />
                        Precios Vendedores
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      // Calcular posiciones para habilitar/deshabilitar botones de reorder
                      const sortedForPosition = [...accounts].sort(
                        (a, b) => a.order - b.order || a.id.localeCompare(b.id),
                      );
                      const positionMap = new Map(
                        sortedForPosition.map((a, i) => [a.id, i]),
                      );
                      return accounts.map((account) => {
                        const streamType = streamingTypes.find(
                          (t) => t.name === account.type,
                        );
                        const posIndex = positionMap.get(account.id) ?? 0;
                        const isFirst = posIndex === 0;
                        const isLast =
                          posIndex === sortedForPosition.length - 1;
                        return (
                          <div
                            key={account.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-700 rounded-lg border-l-4"
                            style={{
                              borderLeftColor: streamType?.color || "#475569",
                            }}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {streamType?.imageUrl ? (
                                <img
                                  src={streamType.imageUrl}
                                  alt={account.type}
                                  className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                                />
                              ) : streamType?.icon ? (
                                <span className="text-2xl">
                                  {streamType.icon}
                                </span>
                              ) : null}
                              <div className="min-w-0">
                                <h3 className="font-semibold text-white truncate">
                                  {account.name}
                                </h3>
                                <p className="text-sm text-slate-400">
                                  {account.type} • {account.duration}
                                </p>
                                <p className="text-sm text-slate-400">
                                  {account.quality} • {account.screens}{" "}
                                  pantallas
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <p className="font-bold text-white">
                                  {formatCurrency(account.price)}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <Badge
                                    variant={
                                      account.isActive ? "default" : "secondary"
                                    }
                                    className={
                                      account.isActive
                                        ? "bg-green-600"
                                        : "bg-red-500 text-white"
                                    }
                                  >
                                    {account.isActive ? "Activa" : "Inactiva"}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="border-slate-600 text-slate-300"
                                  >
                                    {account.saleType}
                                  </Badge>
                                </div>
                                <span className="text-xs text-slate-400">
                                  Stock: {account._count.accountStocks} |
                                  Perfiles: {account._count.profileStocks}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleToggleAccountStatus(
                                      account.id,
                                      account.isActive,
                                    )
                                  }
                                  className={
                                    account.isActive
                                      ? "border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white"
                                      : "border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
                                  }
                                  title={
                                    account.isActive
                                      ? "Desactivar cuenta"
                                      : "Activar cuenta"
                                  }
                                >
                                  {account.isActive ? (
                                    <Lock className="w-4 h-4" />
                                  ) : (
                                    <Unlock className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditAccount(account)}
                                  className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleDeleteAccount(account.id)
                                  }
                                  className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                                <div className="w-px h-4 bg-slate-400/50 hidden sm:block" />
                                <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-md border border-slate-600">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isFirst}
                                    onClick={() =>
                                      handleMoveAccount(
                                        account.id,
                                        account.order,
                                        "up",
                                      )
                                    }
                                    className="border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white disabled:opacity-30"
                                    title="Subir en el catálogo"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isLast}
                                    onClick={() =>
                                      handleMoveAccount(
                                        account.id,
                                        account.order,
                                        "down",
                                      )
                                    }
                                    className="border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white disabled:opacity-30"
                                    title="Bajar en el catálogo"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stock */}
            <TabsContent value="stock" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Agregar Stock</CardTitle>
                  <CardDescription className="text-slate-400">
                    Agrega cuentas y perfiles al inventario
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Selector de tipo de cuenta */}
                  <div>
                    <Label className="text-slate-300">Tipo de Cuenta</Label>
                    <Select
                      value={stockData.accountType || "regular"}
                      onValueChange={(value) =>
                        setStockData({
                          ...stockData,
                          accountType: value,
                          streamingAccountId: "",
                          exclusiveAccountId: "",
                        })
                      }
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Selecciona el tipo de cuenta" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="regular" className="text-white">
                          Cuentas Regulares
                        </SelectItem>
                        <SelectItem value="exclusive" className="text-white">
                          Cuentas Exclusivas
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selector de cuenta específica */}
                  <div>
                    <Label htmlFor="stockAccount" className="text-slate-300">
                      {stockData.accountType === "exclusive"
                        ? "Cuenta Exclusiva"
                        : "Cuenta Regular"}
                    </Label>
                    <Select
                      value={
                        stockData.accountType === "exclusive"
                          ? stockData.exclusiveAccountId
                          : stockData.streamingAccountId
                      }
                      onValueChange={(value) =>
                        setStockData({
                          ...stockData,
                          ...(stockData.accountType === "exclusive"
                            ? {
                                exclusiveAccountId: value,
                                streamingAccountId: "",
                              }
                            : {
                                streamingAccountId: value,
                                exclusiveAccountId: "",
                                saleType:
                                  accounts.find((a) => a.id === value)
                                    ?.saleType || "FULL",
                              }),
                        })
                      }
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue
                          placeholder={`Selecciona la ${
                            stockData.accountType === "exclusive"
                              ? "cuenta exclusiva"
                              : "cuenta regular"
                          }`}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {stockData.accountType === "exclusive"
                          ? exclusiveAccounts.map((account) => (
                              <SelectItem
                                key={account.id}
                                value={account.id}
                                className="text-white"
                              >
                                👑 {account.name} - {account.type}
                              </SelectItem>
                            ))
                          : accounts.map((account) => (
                              <SelectItem
                                key={account.id}
                                value={account.id}
                                className="text-white"
                              >
                                {account.name} - {account.type}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Formulario para cuentas exclusivas */}
                  {stockData.accountType === "exclusive" && (
                    <div className="space-y-4 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                      <h4 className="text-yellow-400 font-medium">
                        Stock para Cuenta Exclusiva
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label
                            htmlFor="exclusiveEmail"
                            className="text-slate-300"
                          >
                            Email
                          </Label>
                          <Input
                            id="exclusiveEmail"
                            type="email"
                            value={stockData.email || ""}
                            onChange={(e) =>
                              setStockData({
                                ...stockData,
                                email: e.target.value,
                              })
                            }
                            placeholder="email@ejemplo.com"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="exclusivePassword"
                            className="text-slate-300"
                          >
                            Contraseña
                          </Label>
                          <Input
                            id="exclusivePassword"
                            type="password"
                            value={stockData.password || ""}
                            onChange={(e) =>
                              setStockData({
                                ...stockData,
                                password: e.target.value,
                              })
                            }
                            placeholder="contraseña"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="exclusiveProfileName"
                            className="text-slate-300"
                          >
                            Nombre del Perfil (opcional)
                          </Label>
                          <Input
                            id="exclusiveProfileName"
                            value={stockData.profileName || ""}
                            onChange={(e) =>
                              setStockData({
                                ...stockData,
                                profileName: e.target.value,
                              })
                            }
                            placeholder="Perfil 1"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="exclusivePin"
                            className="text-slate-300"
                          >
                            PIN (opcional)
                          </Label>
                          <Input
                            id="exclusivePin"
                            value={stockData.pin || ""}
                            onChange={(e) =>
                              setStockData({
                                ...stockData,
                                pin: e.target.value,
                              })
                            }
                            placeholder="1234"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <Label
                          htmlFor="exclusiveNotes"
                          className="text-slate-300"
                        >
                          Notas (opcional)
                        </Label>
                        <Textarea
                          id="exclusiveNotes"
                          value={stockData.notes || ""}
                          onChange={(e) =>
                            setStockData({
                              ...stockData,
                              notes: e.target.value,
                            })
                          }
                          placeholder="Notas adicionales sobre esta cuenta..."
                          rows={3}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Formulario para cuentas regulares */}
                  {stockData.accountType === "regular" && (
                    <>
                      {stockData.saleType === "FULL" ? (
                        <div className="md:col-span-2">
                          <Label htmlFor="accounts" className="text-slate-300">
                            Cuentas (email:password, una por línea)
                          </Label>
                          <Textarea
                            id="accounts"
                            value={stockData.accounts}
                            onChange={(e) =>
                              setStockData({
                                ...stockData,
                                accounts: e.target.value,
                              })
                            }
                            placeholder="usuario1@ejemplo.com:contraseña1&#10;usuario2@ejemplo.com:contraseña2"
                            rows={6}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      ) : (
                        <div className="md:col-span-2">
                          <Label htmlFor="profiles" className="text-slate-300">
                            Perfiles (email:password:perfil:pin, uno por línea)
                          </Label>
                          <Textarea
                            id="profiles"
                            value={stockData.profiles}
                            onChange={(e) =>
                              setStockData({
                                ...stockData,
                                profiles: e.target.value,
                              })
                            }
                            placeholder="cuenta@netflix.com:password:Perfil1:1234&#10;cuenta@netflix.com:password:Perfil2:5678"
                            rows={6}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      )}
                    </>
                  )}

                  <Button
                    onClick={
                      stockData.accountType === "exclusive"
                        ? handleAddExclusiveStock
                        : handleAddStock
                    }
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Stock
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pedidos */}
            <Suspense fallback={<OrderManagementSkeleton />}>
              <TabsContent value="pedidos" className="space-y-6">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex flex-col space-y-4">
                      <div>
                        <CardTitle className="text-white">
                          Historial de Pedidos
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          Click en la flecha para ver detalles completos
                        </CardDescription>
                      </div>

                      {/* Filtro de Estado de Expiración */}
                      <div className="flex flex-col space-y-2">
                        <Label className="text-slate-300 text-sm font-medium">
                          Filtro por Estado de Expiración
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={
                              expirationFilter === "all" ? "default" : "outline"
                            }
                            onClick={() => setExpirationFilter("all")}
                            className={`${
                              expirationFilter === "all"
                                ? "bg-slate-600 hover:bg-slate-700 text-white"
                                : "border-slate-600 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            <Filter className="w-4 h-4 mr-1" />
                            Todos
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              expirationFilter === "vigente"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setExpirationFilter("vigente")}
                            className={`${
                              expirationFilter === "vigente"
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "border-green-600 text-green-400 hover:bg-green-600/20"
                            }`}
                          >
                            <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                            Vigentes
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              expirationFilter === "rehabilitado"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setExpirationFilter("rehabilitado")}
                            className={`${
                              expirationFilter === "rehabilitado"
                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                : "border-blue-600 text-blue-400 hover:bg-blue-600/20"
                            }`}
                          >
                            <div className="w-2 h-2 bg-blue-400 rounded-full mr-1"></div>
                            Rehabilitados
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              expirationFilter === "expirado"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setExpirationFilter("expirado")}
                            className={`${
                              expirationFilter === "expirado"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "border-red-600 text-red-400 hover:bg-red-600/20"
                            }`}
                          >
                            <div className="w-2 h-2 bg-red-400 rounded-full mr-1"></div>
                            Expirados
                          </Button>
                        </div>
                        {expirationFilter !== "all" && (
                          <p className="text-xs text-slate-400">
                            {expirationFilter === "vigente" &&
                              "Mostrando pedidos con más de 3 días para vencer"}
                            {expirationFilter === "rehabilitado" &&
                              "Mostrando pedidos que fueron rehabilitados al stock"}
                            {expirationFilter === "expirado" &&
                              "Mostrando pedidos ya vencidos"}
                          </p>
                        )}
                      </div>

                      {/* Filtro de Renovaciones */}
                      <div className="flex flex-col space-y-2">
                        <Label className="text-slate-300 text-sm font-medium">
                          Filtro por Renovaciones
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={
                              renewalFilter === "all" ? "default" : "outline"
                            }
                            onClick={() => setRenewalFilter("all")}
                            className={`${
                              renewalFilter === "all"
                                ? "bg-slate-600 hover:bg-slate-700 text-white"
                                : "border-slate-600 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            <History className="w-4 h-4 mr-1" />
                            Todos
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              renewalFilter === "renewed"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setRenewalFilter("renewed")}
                            className={`${
                              renewalFilter === "renewed"
                                ? "bg-purple-600 hover:bg-purple-700 text-white"
                                : "border-purple-600 text-purple-400 hover:bg-purple-600/20"
                            }`}
                          >
                            <div className="w-2 h-2 bg-purple-400 rounded-full mr-1"></div>
                            Renovados
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              renewalFilter === "not_renewed"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setRenewalFilter("not_renewed")}
                            className={`${
                              renewalFilter === "not_renewed"
                                ? "bg-slate-600 hover:bg-slate-700 text-white"
                                : "border-slate-600 text-slate-400 hover:bg-slate-600/20"
                            }`}
                          >
                            <div className="w-2 h-2 bg-slate-400 rounded-full mr-1"></div>
                            No Renovados
                          </Button>
                        </div>
                        {renewalFilter !== "all" && (
                          <p className="text-xs text-slate-400">
                            {renewalFilter === "renewed" &&
                              "Mostrando pedidos que han sido renovados al menos una vez"}
                            {renewalFilter === "not_renewed" &&
                              "Mostrando pedidos que nunca han sido renovados"}
                          </p>
                        )}
                      </div>

                      {/* Buscador por Email de Cuenta/Perfil */}
                      <div className="flex flex-col space-y-2">
                        <Label className="text-slate-300 text-sm font-medium">
                          Buscar por Email de Cuenta/Perfil
                        </Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <Input
                            placeholder="ejemplo@dominio.com"
                            value={orderSearchQuery}
                            onChange={(e) =>
                              setOrderSearchQuery(e.target.value)
                            }
                            className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pl-10"
                          />
                          {orderSearchQuery && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setOrderSearchQuery("")}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white p-1 h-auto"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {orderSearchQuery && (
                          <p className="text-xs text-slate-400">
                            Buscando pedidos con email que contenga: "
                            {orderSearchQuery}"
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {filteredOrders.length > 0 ? (
                        <>
                          {(expirationFilter !== "all" ||
                            renewalFilter !== "all" ||
                            orderSearchQuery.trim() !== "") && (
                            <div className="text-sm text-slate-400 text-center py-2">
                              Mostrando {filteredOrders.length} de{" "}
                              {orders.length} pedidos
                              {expirationFilter !== "all" &&
                                renewalFilter !== "all" &&
                                orderSearchQuery.trim() !== "" &&
                                " (con filtros combinados y búsqueda)"}
                              {expirationFilter !== "all" &&
                                renewalFilter === "all" &&
                                orderSearchQuery.trim() === "" &&
                                " (por estado de expiración)"}
                              {expirationFilter === "all" &&
                                renewalFilter !== "all" &&
                                orderSearchQuery.trim() === "" &&
                                " (por renovaciones)"}
                              {expirationFilter === "all" &&
                                renewalFilter === "all" &&
                                orderSearchQuery.trim() !== "" &&
                                ` (por email: "${orderSearchQuery}")`}
                              {expirationFilter !== "all" &&
                                renewalFilter === "all" &&
                                orderSearchQuery.trim() !== "" &&
                                " (por estado y email)"}
                              {expirationFilter === "all" &&
                                renewalFilter !== "all" &&
                                orderSearchQuery.trim() !== "" &&
                                " (por renovaciones y email)"}
                            </div>
                          )}
                          {filteredOrders.map((order) => (
                            <div
                              key={order.id}
                              className="p-4 bg-slate-700 rounded-lg"
                            >
                              {/* Header con información básica y flecha */}
                              <div
                                className="flex-wrap items-start justify-between cursor-pointer"
                                onClick={() =>
                                  toggleOrderExpansionInGeneral(order.id)
                                }
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <h3 className="font-semibold text-white text-lg">
                                      {order.streamingAccount?.name ||
                                        "Exclusive Account"}
                                    </h3>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-slate-400 hover:text-white hover:bg-slate-600 p-1 h-auto"
                                    >
                                      {expandedOrdersInGeneral.has(order.id) ? (
                                        <ChevronUp className="w-5 h-5" />
                                      ) : (
                                        <ChevronDown className="w-5 h-5" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge
                                      variant="outline"
                                      className="border-slate-600 text-slate-300"
                                    >
                                      {order.streamingAccount?.type ||
                                        "EXCLUSIVE"}
                                    </Badge>
                                    <Badge
                                      variant={
                                        order.status === "COMPLETED"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className={
                                        order.status === "REHABILITATED"
                                          ? "bg-blue-600 text-white"
                                          : order.status === "COMPLETED"
                                            ? (() => {
                                                const expired = isOrderExpired(
                                                  order.expiresAt,
                                                );
                                                return expired
                                                  ? "bg-red-600"
                                                  : "bg-green-600";
                                              })()
                                            : "bg-slate-600"
                                      }
                                    >
                                      {order.status === "REHABILITATED"
                                        ? "Rehabilitado"
                                        : order.status === "COMPLETED"
                                          ? isOrderExpired(order.expiresAt)
                                            ? "Expirado"
                                            : "Completado"
                                          : order.status}
                                    </Badge>
                                    {order.status === "COMPLETED" &&
                                      order.renewalCount > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="border-purple-500 text-purple-400"
                                        >
                                          Renovado {order.renewalCount} vez
                                          {order.renewalCount > 1 ? "es" : ""}
                                        </Badge>
                                      )}

                                    {order.deliveryStatus && (
                                      <Badge
                                        variant="outline"
                                        className={
                                          order.deliveryStatus === "DELIVERED"
                                            ? "border-green-600 text-green-400"
                                            : order.deliveryStatus === "FAILED"
                                              ? "border-red-600 text-red-400"
                                              : "border-yellow-600 text-yellow-400"
                                        }
                                      >
                                        Entrega: {order.deliveryStatus}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-white text-lg">
                                    {formatCurrency(order.totalPrice)}
                                  </p>
                                  <p className="text-sm text-slate-400">
                                    Cantidad: {order.quantity}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {order.user.name || order.user.email}
                                  </p>
                                </div>
                              </div>

                              {/* Credenciales siempre visibles */}
                              {(order.accountEmail || order.profileName) &&
                                (() => {
                                  const status = getExpirationStatus(
                                    order.expiresAt,
                                  );
                                  const colors =
                                    order.status === "REHABILITATED"
                                      ? {
                                          bg: "bg-blue-600/20",
                                          border: "border-blue-600/30",
                                          text: "text-blue-400",
                                          span: "text-blue-300",
                                        }
                                      : order.status === "COMPLETED" &&
                                          order.renewalCount > 0
                                        ? {
                                            bg: "bg-purple-600/20",
                                            border: "border-purple-600/30",
                                            text: "text-purple-400",
                                            span: "text-purple-300",
                                          }
                                        : status.filterCategory === "expirado"
                                          ? {
                                              bg: "bg-red-600/20",
                                              border: "border-red-600/30",
                                              text: "text-red-400",
                                              span: "text-red-300",
                                            }
                                          : {
                                              bg: "bg-emerald-600/20",
                                              border: "border-emerald-600/30",
                                              text: "text-emerald-400",
                                              span: "text-emerald-300",
                                            };

                                  return (
                                    <div
                                      className={`mt-3 p-3 ${colors.bg} border ${colors.border} rounded text-sm`}
                                    >
                                      <p
                                        className={`${colors.text} mb-2 font-medium`}
                                      >
                                        Credenciales Entregadas:
                                      </p>
                                      <div className="font-mono text-xs text-white space-y-1">
                                        {order.accountEmail && (
                                          <p>
                                            Email:{" "}
                                            <span
                                              className={`${colors.span} font-semibold`}
                                            >
                                              {order.accountEmail}
                                            </span>
                                          </p>
                                        )}
                                        {order.accountPassword && (
                                          <p>
                                            Contraseña:{" "}
                                            <span
                                              className={`${colors.span} font-semibold`}
                                            >
                                              {order.accountPassword}
                                            </span>
                                          </p>
                                        )}
                                        {order.profileName && (
                                          <p>
                                            Perfil:{" "}
                                            <span
                                              className={`${colors.span} font-semibold`}
                                            >
                                              {order.profileName}
                                            </span>
                                          </p>
                                        )}
                                        {order.profilePin && (
                                          <p>
                                            PIN:{" "}
                                            <span
                                              className={`${colors.span} font-semibold`}
                                            >
                                              {order.profilePin}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}

                              {/* Detalles expandibles */}
                              {expandedOrdersInGeneral.has(order.id) && (
                                <div className="mt-4 pt-4 border-t border-slate-600 space-y-4">
                                  {/* Información básica del pedido */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-slate-400 mb-1">
                                        Cliente:
                                      </p>
                                      <p className="text-white font-medium">
                                        {order.user.name || order.user.email}
                                      </p>
                                      <p className="text-slate-400 text-xs">
                                        {order.user.email}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400 mb-1">
                                        Tipo de Venta:
                                      </p>
                                      <p className="text-white font-medium">
                                        {order.saleType === "FULL"
                                          ? "Cuenta Completa"
                                          : "Perfil Individual"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400 mb-1">
                                        Fecha del Pedido:
                                      </p>
                                      <p className="text-white">
                                        {formatDate(order.createdAt)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400 mb-1">
                                        Vence:
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-white">
                                          {new Date(
                                            order.expiresAt,
                                          ).toLocaleDateString()}
                                        </p>
                                        <Badge
                                          variant="outline"
                                          className={`border-current ${
                                            getExpirationStatus(order.expiresAt)
                                              .bgColor
                                          } ${
                                            getExpirationStatus(order.expiresAt)
                                              .color
                                          }`}
                                        >
                                          {
                                            getExpirationStatus(order.expiresAt)
                                              .status
                                          }
                                        </Badge>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-slate-400 mb-1">
                                        ID del Pedido:
                                      </p>
                                      <p className="text-white font-mono text-xs">
                                        {order.id}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Detalles del producto si existe streamingAccount */}
                                  {order.streamingAccount && (
                                    <div className="p-3 bg-slate-600/50 rounded text-sm">
                                      <p className="text-slate-400 mb-2">
                                        Detalles del Producto:
                                      </p>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                        <div>
                                          <span className="text-slate-400">
                                            Duración:
                                          </span>
                                          <p className="text-white">
                                            {order.streamingAccount.duration}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">
                                            Calidad:
                                          </span>
                                          <p className="text-white">
                                            {order.streamingAccount.quality}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">
                                            Pantallas:
                                          </span>
                                          <p className="text-white">
                                            {order.streamingAccount.screens}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">
                                            Precio Unitario:
                                          </span>
                                          <p className="text-white">
                                            {formatCurrency(
                                              order.streamingAccount.price,
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Intentos de entrega */}
                                  {order.deliveryAttempts &&
                                    order.deliveryAttempts > 0 && (
                                      <div className="p-3 bg-slate-600/50 rounded text-sm">
                                        <p className="text-slate-400 mb-1">
                                          Intentos de Entrega:
                                        </p>
                                        <p className="text-white">
                                          {order.deliveryAttempts} intentos
                                        </p>
                                        {order.lastDeliveryAttempt && (
                                          <p className="text-xs text-slate-400">
                                            Último intento:{" "}
                                            {formatDate(
                                              order.lastDeliveryAttempt,
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    )}

                                  {/* Acciones de rehabilitación y renovación */}
                                  {(order.accountEmail ||
                                    order.profileName) && (
                                    <div className="p-3 bg-slate-600/50 rounded text-sm">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-slate-400">
                                          Acciones:
                                        </p>
                                        {order.renewalCount > 0 && (
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                            <span className="text-blue-400 text-xs font-medium">
                                              Renovado {order.renewalCount} vez
                                              {order.renewalCount > 1
                                                ? "es"
                                                : ""}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditOrder(order)}
                                          className="border-amber-500 text-amber-300 hover:bg-amber-500 hover:text-white"
                                          title="Editar credenciales antes de rehabilitar"
                                        >
                                          <Edit className="w-4 h-4 mr-1" />
                                          Editar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleRehabilitateOrder(order)
                                          }
                                          className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                                          title={`Rehabilitar ${
                                            order.saleType === "FULL"
                                              ? "cuenta"
                                              : "perfil"
                                          } al stock`}
                                        >
                                          <RefreshCw className="w-4 h-4 mr-1" />
                                          Rehabilitar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleRenewOrder(order)
                                          }
                                          className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
                                          title={`Renovar cuenta por ${formatCurrency(
                                            order.streamingAccount?.price || 0,
                                          )}`}
                                        >
                                          <RefreshCw className="w-4 h-4 mr-1" />
                                          Renovar
                                        </Button>
                                      </div>
                                      <div className="mt-2 space-y-1">
                                        <p className="text-xs text-slate-400">
                                          {isOrderExpired(order.expiresAt)
                                            ? "Este pedido ha expirado y puede ser rehabilitado al stock."
                                            : `Este pedido expirará en ${
                                                getExpirationStatus(
                                                  order.expiresAt,
                                                ).days
                                              } días.`}
                                        </p>
                                        {order.lastRenewedAt && (
                                          <p className="text-xs text-purple-400">
                                            Última renovación:{" "}
                                            {new Date(
                                              order.lastRenewedAt,
                                            ).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-slate-400">
                            {expirationFilter === "all" &&
                            renewalFilter === "all" &&
                            orderSearchQuery.trim() === "" ? (
                              <>
                                <p className="text-lg font-medium mb-2">
                                  No hay pedidos registrados
                                </p>
                                <p className="text-sm">
                                  Los pedidos aparecerán aquí cuando los
                                  usuarios realicen compras
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-lg font-medium mb-2">
                                  No hay pedidos con estos filtros
                                </p>
                                <p className="text-sm mb-3">
                                  {expirationFilter !== "all" &&
                                    renewalFilter !== "all" &&
                                    orderSearchQuery.trim() !== "" &&
                                    "No hay pedidos que coincidan con los filtros de estado, renovaciones y búsqueda de email seleccionados"}
                                  {expirationFilter !== "all" &&
                                    renewalFilter === "all" &&
                                    orderSearchQuery.trim() === "" && (
                                      <>
                                        {expirationFilter === "vigente" &&
                                          "No hay pedidos vigentes (con más de 3 días para vencer)"}
                                        {expirationFilter === "rehabilitado" &&
                                          "No hay pedidos rehabilitados"}
                                        {expirationFilter === "expirado" &&
                                          "No hay pedidos expirados"}
                                      </>
                                    )}
                                  {expirationFilter === "all" &&
                                    renewalFilter !== "all" &&
                                    orderSearchQuery.trim() === "" && (
                                      <>
                                        {renewalFilter === "renewed" &&
                                          "No hay pedidos que hayan sido renovados"}
                                        {renewalFilter === "not_renewed" &&
                                          "No hay pedidos sin renovar"}
                                      </>
                                    )}
                                  {expirationFilter === "all" &&
                                    renewalFilter === "all" &&
                                    orderSearchQuery.trim() !== "" &&
                                    `No hay pedidos con email que contenga: "${orderSearchQuery}"`}
                                  {expirationFilter !== "all" &&
                                    renewalFilter === "all" &&
                                    orderSearchQuery.trim() !== "" &&
                                    `No hay pedidos con el estado seleccionado y email que contenga: "${orderSearchQuery}"`}
                                  {expirationFilter === "all" &&
                                    renewalFilter !== "all" &&
                                    orderSearchQuery.trim() !== "" &&
                                    `No hay pedidos con el filtro de renovaciones seleccionado y email que contenga: "${orderSearchQuery}"`}
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                  {expirationFilter !== "all" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setExpirationFilter("all")}
                                      className="border-slate-600 text-slate-300 hover:bg-slate-600"
                                    >
                                      <Filter className="w-4 h-4 mr-1" />
                                      Quitar filtro de expiración
                                    </Button>
                                  )}
                                  {renewalFilter !== "all" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setRenewalFilter("all")}
                                      className="border-slate-600 text-slate-300 hover:bg-slate-600"
                                    >
                                      <History className="w-4 h-4 mr-1" />
                                      Quitar filtro de renovaciones
                                    </Button>
                                  )}
                                  {orderSearchQuery.trim() !== "" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setOrderSearchQuery("")}
                                      className="border-slate-600 text-slate-300 hover:bg-slate-600"
                                    >
                                      <Search className="w-4 h-4 mr-1" />
                                      Quitar búsqueda
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setExpirationFilter("all");
                                      setRenewalFilter("all");
                                      setOrderSearchQuery("");
                                    }}
                                    className="border-slate-600 text-slate-300 hover:bg-slate-600"
                                  >
                                    Mostrar todos los pedidos
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {orderTotalPages > 1 && (
                      <Pagination
                        currentPage={orderCurrentPage}
                        totalPages={orderTotalPages}
                        onPageChange={(page) => setOrderCurrentPage(page)}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Suspense>

            {/* Usuarios */}
            <Suspense fallback={<UserManagementSkeleton />}>
              <TabsContent value="usuarios" className="space-y-6">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4 sm:items-center">
                      <div className="flex-1 min-w-[200px]">
                        <CardTitle className="text-white">
                          Gestión de Usuarios
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          Ver detalles, recargar créditos y gestionar permisos
                        </CardDescription>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRoleFilter("ALL")}
                              className={`${
                                roleFilter === "ALL"
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                                  : "bg-transparent border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white"
                              }`}
                            >
                              Todos
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRoleFilter("ADMIN")}
                              className={`${
                                roleFilter === "ADMIN"
                                  ? "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                                  : "bg-transparent border-yellow-600 text-yellow-400 hover:bg-yellow-600 hover:text-white"
                              }`}
                            >
                              <Crown className="w-4 h-4 mr-1" />
                              Admin
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRoleFilter("VENDEDOR")}
                              className={`${
                                roleFilter === "VENDEDOR"
                                  ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                  : "bg-transparent border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                              }`}
                            >
                              <TrendingUp className="w-4 h-4 mr-1" />
                              Vendedor
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRoleFilter("USER")}
                              className={`${
                                roleFilter === "USER"
                                  ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                                  : "bg-transparent border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
                              }`}
                            >
                              <User className="w-4 h-4 mr-1" />
                              Usuario
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusFilter("ALL")}
                            className={`${
                              statusFilter === "ALL"
                                ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                                : "bg-transparent border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
                            }`}
                          >
                            <Activity className="w-4 h-4 mr-1" />
                            Todos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusFilter("ACTIVE")}
                            className={`${
                              statusFilter === "ACTIVE"
                                ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                                : "bg-transparent border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
                            }`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Activos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusFilter("BLOCKED")}
                            className={`${
                              statusFilter === "BLOCKED"
                                ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                                : "bg-transparent border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                            }`}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Bloqueados
                          </Button>
                        </div>
                        <div className="text-sm text-slate-400 mt-2">
                          Mostrando {filteredUsers.length} de {totalUsersCount}{" "}
                          usuarios
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:flex-nowrap">
                        <Input
                          placeholder="Buscar usuarios por nombre o email..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 flex-1 min-w-[180px] sm:w-64"
                        />

                        <Button
                          onClick={() => {
                            adminFetch("/api/admin/update-total-spent", {
                              method: "POST",
                            })
                              .then((res) => res.json())
                              .then(async (data) => {
                                if (data.success) {
                                  toast.success(
                                    `Actualizado: ${data.updatedUsers} usuarios`,
                                  );

                                  await fetchUsersData();
                                } else {
                                  toast.error(
                                    "Error al actualizar total gastado",
                                  );
                                }
                              })
                              .catch(() =>
                                toast.error(
                                  "Error al actualizar total gastado",
                                ),
                              );
                          }}
                          size="sm"
                          variant="outline"
                          className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white flex-shrink-0"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Actualizar Total
                        </Button>

                        <Button
                          onClick={() => setShowBroadcastModal(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                          size="sm"
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      {/* {filteredUsers.map((user) => ( */}
                      {/* {users
                        .filter(
                          (user) =>
                            roleFilter === "ALL" || user.role === roleFilter,
                        )
                        .map((user) => ( */}
                      {filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className="p-4 bg-slate-700 rounded-lg"
                        >
                          {/* Cabecera */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="font-semibold text-white break-words">
                                  {user.name || user.email}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {user.isBlocked ? (
                                    <Badge
                                      variant="destructive"
                                      className="bg-red-600"
                                    >
                                      <Ban className="w-3 h-3 mr-1" />
                                      BLOQUEADO
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-green-600">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      ACTIVO
                                    </Badge>
                                  )}
                                  {user.role === "ADMIN" && (
                                    <Badge
                                      variant="outline"
                                      className="border-yellow-600 text-yellow-400"
                                    >
                                      <Crown className="w-3 h-3 mr-1" />
                                      ADMIN
                                    </Badge>
                                  )}

                                  {user.role === "VENDEDOR" && (
                                    <Badge
                                      variant="outline"
                                      className="border-blue-600 text-blue-400"
                                    >
                                      <TrendingUp className="w-3 h-3 mr-1" />
                                      VENDEDOR
                                    </Badge>
                                  )}

                                  {user.role === "USER" && (
                                    <Badge
                                      variant="outline"
                                      className="border-emerald-600 text-emerald-400"
                                    >
                                      <User className="w-3 h-3 mr-1" />
                                      USUARIO
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-slate-400 mb-1 break-all">
                                {user.email}
                              </p>
                              <p className="text-xs text-slate-500">
                                Registrado:{" "}
                                {new Date(user.createdAt).toLocaleDateString()}
                              </p>

                              {user.isBlocked && (
                                <div className="mt-2 p-2 bg-red-900/30 border border-red-700/50 rounded text-xs">
                                  <p className="text-red-400 font-medium">
                                    <Ban className="w-3 h-3 inline mr-1" />
                                    Usuario Bloqueado
                                  </p>
                                  {user.blockExpiresAt &&
                                    new Date(user.blockExpiresAt) >
                                      new Date() && (
                                      <p className="text-red-300 mt-1">
                                        Hasta: {formatDate(user.blockExpiresAt)}
                                      </p>
                                    )}
                                  {user.blockReason && (
                                    <p className="text-red-300 mt-1">
                                      Motivo: {user.blockReason}
                                    </p>
                                  )}
                                </div>
                              )}

                              {!user.isBlocked && user.blockReason && (
                                <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs">
                                  <p className="text-yellow-400 font-medium">
                                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                                    Advertencia previa
                                  </p>
                                  <p className="text-yellow-300 mt-1">
                                    Motivo: {user.blockReason}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="text-left sm:text-right flex-shrink-0 flex items-start gap-3">
                              {user.telegramChatId && (
                                <span
                                  title="Verificado por Telegram"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.25)]"
                                >
                                  <svg
                                    className="w-3 h-3 text-emerald-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span className="text-emerald-300">
                                    Verificado
                                  </span>
                                </span>
                              )}
                              <div>
                                <p className="font-bold text-white text-lg">
                                  {formatCurrency(user.credits)}
                                </p>
                                <p className="text-sm text-slate-400">
                                  Créditos
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Total gastado:{" "}
                                  {formatCurrency(user.totalSpent)}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {user._count.orders} pedidos
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Botones */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewUserOrders(user)}
                              className="border-slate-600 text-slate-300 hover:bg-slate-600 flex-1 sm:flex-none"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Pedidos
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleUserRegistration(user.id)}
                              className="border-slate-600 text-slate-300 hover:bg-slate-600 flex-1 sm:flex-none"
                            >
                              {expandedUserRegistration.has(user.id) ? (
                                <>
                                  <ChevronUp className="w-4 h-4 mr-1" />
                                  Ocultar Registro
                                </>
                              ) : (
                                <>
                                  <User className="w-4 h-4 mr-1" />
                                  Ver Registro
                                </>
                              )}
                            </Button>

                            <Dialog
                              open={rechargingUserId === user.id}
                              onOpenChange={(open) => {
                                if (open) {
                                  setRechargingUserId(user.id);
                                } else {
                                  setRechargingUserId(null);
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none"
                                >
                                  <CreditCard className="w-4 h-4 mr-1" />
                                  Recargar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-800 border-slate-700 max-w-md w-[90%] sm:w-full">
                                <DialogHeader>
                                  <DialogTitle className="text-white">
                                    Recargar Créditos
                                  </DialogTitle>
                                  <DialogDescription className="text-slate-400">
                                    Recargar créditos para{" "}
                                    {user.name || user.email}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label
                                      htmlFor="rechargeAmount"
                                      className="text-slate-300"
                                    >
                                      Monto a recargar (COP)
                                    </Label>
                                    <Input
                                      id="rechargeAmount"
                                      type="number"
                                      value={rechargeAmount}
                                      onChange={(e) =>
                                        setRechargeAmount(e.target.value)
                                      }
                                      placeholder="50000"
                                      className="bg-slate-700 border-slate-600 text-white"
                                    />
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setRechargeAmount("10000")}
                                      className="border-slate-600 text-slate-300 hover:bg-slate-600 flex-1 sm:flex-none"
                                    >
                                      $10.000
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setRechargeAmount("20000")}
                                      className="border-slate-600 text-slate-300 hover:bg-slate-600 flex-1 sm:flex-none"
                                    >
                                      $20.000
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setRechargeAmount("50000")}
                                      className="border-slate-600 text-slate-300 hover:bg-slate-600 flex-1 sm:flex-none"
                                    >
                                      $50.000
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setRechargeAmount("100000")
                                      }
                                      className="border-slate-600 text-slate-300 hover:bg-slate-600 flex-1 sm:flex-none"
                                    >
                                      $100.000
                                    </Button>
                                  </div>
                                  <Button
                                    onClick={() =>
                                      handleCustomRecharge(user.id)
                                    }
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                    disabled={isRecharging}
                                  >
                                    {isRecharging ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Recargando...
                                      </>
                                    ) : (
                                      <>
                                        Recargar{" "}
                                        {formatCurrency(
                                          parseFloat(rechargeAmount) || 0,
                                        )}
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fetchRechargeHistory(user.id)}
                              className="border-slate-600 text-slate-300 hover:bg-slate-600 flex-1 sm:flex-none"
                            >
                              <History className="w-4 h-4 mr-1" />
                              Recargas
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPermissionManager(user)}
                              className="border-slate-600 text-slate-300 hover:bg-slate-600 relative flex-1 sm:flex-none"
                            >
                              <Shield className="w-4 h-4 mr-1" />
                              Gestión de Permisos
                              {userActionCounts[user.id] > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                  {userActionCounts[user.id]}
                                </span>
                              )}
                            </Button>
                          </div>

                          {/* Desplegable de Información de Registro */}
                          {expandedUserRegistration.has(user.id) && (
                            <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-600 overflow-visible">
                              <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                                <h4 className="text-white font-semibold flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  Información de Registro
                                </h4>
                                {editingUserRegistration === user.id ? (
                                  <div className="flex gap-2 flex-wrap">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleUpdateRegistrationInfo(user.id)
                                      }
                                      disabled={loadingUserRegistration.has(
                                        user.id,
                                      )}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      {loadingUserRegistration.has(user.id) ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <CheckCircle className="w-4 h-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setEditingUserRegistration(null)
                                      }
                                      className="border-slate-600 text-slate-300"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setEditingUserRegistration(user.id)
                                    }
                                    className="border-slate-600 text-slate-300"
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Editar
                                  </Button>
                                )}
                              </div>

                              {loadingUserRegistration.has(user.id) ? (
                                <div className="flex items-center justify-center py-8">
                                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Nombre Completo */}
                                  <div className="space-y-2">
                                    <Label className="text-slate-300 text-sm">
                                      Nombre Completo
                                    </Label>
                                    {editingUserRegistration === user.id ? (
                                      <Input
                                        disabled
                                        value={
                                          userRegistrationData[user.id]
                                            ?.fullName || ""
                                        }
                                        onChange={(e) =>
                                          handleRegistrationInputChange(
                                            user.id,
                                            "fullName",
                                            e.target.value,
                                          )
                                        }
                                        className="bg-slate-700 border-slate-600 text-white"
                                        placeholder="Nombre completo"
                                      />
                                    ) : (
                                      <p className="text-white bg-slate-700/50 p-2 rounded">
                                        {userRegistrationData[user.id]
                                          ?.fullName || "No especificado"}
                                      </p>
                                    )}
                                  </div>

                                  {/* Nombre de Usuario */}
                                  <div className="space-y-2">
                                    <Label className="text-slate-300 text-sm">
                                      Nombre de Usuario
                                    </Label>
                                    {editingUserRegistration === user.id ? (
                                      <Input
                                        disabled
                                        value={
                                          userRegistrationData[user.id]
                                            ?.username || ""
                                        }
                                        onChange={(e) =>
                                          handleRegistrationInputChange(
                                            user.id,
                                            "username",
                                            e.target.value,
                                          )
                                        }
                                        className="bg-slate-700 border-slate-600 text-white"
                                        placeholder="Nombre de usuario"
                                      />
                                    ) : (
                                      <p className="text-white bg-slate-700/50 p-2 rounded">
                                        {userRegistrationData[user.id]
                                          ?.username || "No especificado"}
                                      </p>
                                    )}
                                  </div>

                                  {/* Email */}
                                  <div className="space-y-2">
                                    <Label className="text-slate-300 text-sm">
                                      Email
                                    </Label>
                                    {editingUserRegistration === user.id ? (
                                      <Input
                                        type="email"
                                        value={
                                          userRegistrationData[user.id]
                                            ?.email || ""
                                        }
                                        onChange={(e) =>
                                          handleRegistrationInputChange(
                                            user.id,
                                            "email",
                                            e.target.value,
                                          )
                                        }
                                        className="bg-slate-700 border-slate-600 text-white"
                                        placeholder="email@ejemplo.com"
                                      />
                                    ) : (
                                      <p className="text-white bg-slate-700/50 p-2 rounded">
                                        {userRegistrationData[user.id]?.email ||
                                          "No especificado"}
                                      </p>
                                    )}
                                  </div>

                                  {/* Teléfono */}
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Label className="text-slate-300 text-sm">
                                        Teléfono
                                      </Label>
                                      {userRegistrationData[user.id]
                                        ?.telegramChatId && (
                                        <span
                                          title="Verificado por Telegram"
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                                        >
                                          <svg
                                            className="w-2.5 h-2.5 text-emerald-400"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          Verificado
                                        </span>
                                      )}
                                    </div>
                                    {editingUserRegistration === user.id ? (
                                      <div className="relative">
                                        <Input
                                          type="tel"
                                          disabled={
                                            !!userRegistrationData[user.id]
                                              ?.telegramChatId
                                          }
                                          value={
                                            userRegistrationData[user.id]
                                              ?.phone || ""
                                          }
                                          onChange={(e) =>
                                            handleRegistrationInputChange(
                                              user.id,
                                              "phone",
                                              e.target.value,
                                            )
                                          }
                                          className={`bg-slate-700 border-slate-600 text-white ${
                                            userRegistrationData[user.id]
                                              ?.telegramChatId
                                              ? "cursor-not-allowed opacity-70"
                                              : ""
                                          }`}
                                          placeholder="+57 300 123 4567"
                                        />
                                        {userRegistrationData[user.id]
                                          ?.telegramChatId && (
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                                            🔒 Verificado
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-white bg-slate-700/50 p-2 rounded">
                                        {userRegistrationData[user.id]?.phone
                                          ? `+${userRegistrationData[user.id].phone.slice(0, 2)} ${userRegistrationData[user.id].phone.slice(2, 5)} ${userRegistrationData[user.id].phone.slice(5, 8)} ${userRegistrationData[user.id].phone.slice(8)}`
                                          : "No especificado"}
                                      </p>
                                    )}
                                  </div>

                                  {/* Créditos */}
                                  <div className="space-y-2">
                                    <Label className="text-slate-300 text-sm">
                                      Créditos
                                    </Label>
                                    {editingUserRegistration === user.id ? (
                                      <Input
                                        disabled
                                        type="number"
                                        value={
                                          userRegistrationData[user.id]
                                            ?.credits || 0
                                        }
                                        onChange={(e) =>
                                          handleRegistrationInputChange(
                                            user.id,
                                            "credits",
                                            e.target.value,
                                          )
                                        }
                                        className="bg-slate-700 border-slate-600 text-white"
                                        placeholder="0"
                                        min="0"
                                      />
                                    ) : (
                                      <p className="text-white bg-slate-700/50 p-2 rounded">
                                        $
                                        {userRegistrationData[
                                          user.id
                                        ]?.credits?.toLocaleString() || "0"}
                                      </p>
                                    )}
                                  </div>

                                  {/* Rol */}
                                  <div className="space-y-2">
                                    <Label className="text-slate-300 text-sm">
                                      Rol
                                    </Label>
                                    {editingUserRegistration === user.id ? (
                                      <Select
                                        value={
                                          userRegistrationData[user.id]?.role ||
                                          "USER"
                                        }
                                        onValueChange={(value) =>
                                          handleRegistrationInputChange(
                                            user.id,
                                            "role",
                                            value,
                                          )
                                        }
                                      >
                                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                                          <SelectValue placeholder="Seleccionar rol" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700">
                                          <SelectItem
                                            value="USER"
                                            className="text-white"
                                          >
                                            Usuario
                                          </SelectItem>
                                          <SelectItem
                                            value="VENDEDOR"
                                            className="text-white"
                                          >
                                            Vendedor
                                          </SelectItem>
                                          <SelectItem
                                            value="ADMIN"
                                            className="text-white"
                                          >
                                            Administrador
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <p className="text-white bg-slate-700/50 p-2 rounded flex-1">
                                          {userRegistrationData[user.id]
                                            ?.role === "ADMIN"
                                            ? "Administrador"
                                            : userRegistrationData[user.id]
                                                  ?.role === "VENDEDOR"
                                              ? "Vendedor"
                                              : "Usuario"}
                                        </p>
                                        <Badge
                                          className={`${
                                            userRegistrationData[user.id]
                                              ?.role === "ADMIN"
                                              ? "bg-purple-600"
                                              : userRegistrationData[user.id]
                                                    ?.role === "VENDEDOR"
                                                ? "bg-blue-600"
                                                : "bg-emerald-600"
                                          } text-white`}
                                        >
                                          {userRegistrationData[user.id]
                                            ?.role === "ADMIN"
                                            ? "ADMIN"
                                            : userRegistrationData[user.id]
                                                  ?.role === "VENDEDOR"
                                              ? "VENDEDOR"
                                              : "USER"}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>

                                  {/* Contraseña - Solo en modo edición */}
                                  {editingUserRegistration === user.id && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-slate-300 text-sm">
                                          Contraseña
                                        </Label>
                                        <Input
                                          type="password"
                                          value={
                                            userRegistrationData[user.id]
                                              ?.password || ""
                                          }
                                          onChange={(e) =>
                                            handleRegistrationInputChange(
                                              user.id,
                                              "password",
                                              e.target.value,
                                            )
                                          }
                                          className="bg-slate-700 border-slate-600 text-white"
                                          placeholder="Dejar en blanco para no cambiar"
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label className="text-slate-300 text-sm">
                                          Confirmar Contraseña
                                        </Label>
                                        <Input
                                          type="password"
                                          value={
                                            userRegistrationData[user.id]
                                              ?.confirmPassword || ""
                                          }
                                          onChange={(e) =>
                                            handleRegistrationInputChange(
                                              user.id,
                                              "confirmPassword",
                                              e.target.value,
                                            )
                                          }
                                          className="bg-slate-700 border-slate-600 text-white"
                                          placeholder="Confirmar nueva contraseña"
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {userTotalPages > 1 && (
                      <Pagination
                        currentPage={userCurrentPage}
                        totalPages={userTotalPages}
                        onPageChange={(page) => setUserCurrentPage(page)}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Suspense>

            {/* Ofertas */}
            <TabsContent value="ofertas" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ofertas Especiales */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Ofertas Especiales
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Crea descuentos para usuarios destacados
                      {selectedUsersForOffer.length > 0 && (
                        <span className="text-emerald-400 ml-2">
                          ({selectedUsersForOffer.length} usuario
                          {selectedUsersForOffer.length !== 1 ? "s" : ""}{" "}
                          seleccionado
                          {selectedUsersForOffer.length !== 1 ? "s" : ""})
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedUsersForOffer.length === 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-400 text-sm">
                          ⚠️ Selecciona usuarios desde la sección de
                          estadísticas de abajo para crear ofertas
                        </p>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <Label
                          htmlFor="offerAccount"
                          className="text-slate-300"
                        >
                          Cuenta
                        </Label>
                        <Select
                          value={newSpecialOffer.streamingAccountId}
                          onValueChange={(value) =>
                            setNewSpecialOffer({
                              ...newSpecialOffer,
                              streamingAccountId: value,
                            })
                          }
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Selecciona la cuenta" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {accounts.map((account) => (
                              <SelectItem
                                key={account.id}
                                value={account.id}
                                className="text-white"
                              >
                                {account.name} - {formatCurrency(account.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label
                          htmlFor="discountPercentage"
                          className="text-slate-300"
                        >
                          Descuento (%)
                        </Label>
                        <Input
                          id="discountPercentage"
                          type="number"
                          value={newSpecialOffer.discountPercentage}
                          onChange={(e) =>
                            setNewSpecialOffer({
                              ...newSpecialOffer,
                              discountPercentage: e.target.value,
                            })
                          }
                          placeholder="20"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="offerExpiresAt"
                          className="text-slate-300"
                        >
                          Fecha de expiración (opcional)
                        </Label>
                        <Input
                          id="offerExpiresAt"
                          type="date"
                          value={newSpecialOffer.expiresAt}
                          onChange={(e) =>
                            setNewSpecialOffer({
                              ...newSpecialOffer,
                              expiresAt: e.target.value,
                            })
                          }
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Si no se establece, la oferta no expirará
                          automáticamente
                        </p>
                      </div>
                      <Button
                        onClick={handleCreateSpecialOffer}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        /* disabled={selectedUsersForOffer.length === 0} */
                        disabled={
                          !applyToAllUsers && selectedUsersForOffer.length === 0
                        }
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        {/*  Crear Oferta para {selectedUsersForOffer.length}{" "}
                        usuarios */}
                        {applyToAllUsers
                          ? "Crear Oferta para Todos los Usuarios"
                          : `Crear Oferta para ${selectedUsersForOffer.length} usuarios`}
                      </Button>
                    </div>
                    <div className="mt-4">
                      <label className="flex items-center space-x-3 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyToAllUsers}
                          onChange={(e) => setApplyToAllUsers(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span>
                          Aplicar oferta a todos los usuarios (no vendedores)
                        </span>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {/* Lista de Ofertas Existentes */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Ofertas Activas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="p-4 space-y-4 max-h-[327px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 hover:scrollbar-thumb-slate-500">
                      {specialOffers.map((offer) => {
                        const offerStatus = getOfferStatus(offer);
                        const expired = isOfferExpired(offer.expiresAt);
                        const isExpanded = expandedSpecialOffers.has(offer.id);

                        return (
                          <div
                            key={offer.id}
                            className="bg-slate-700 rounded-lg overflow-hidden"
                          >
                            {/* Header - Clickable */}
                            <div
                              className="p-3 cursor-pointer hover:bg-slate-600 transition-colors"
                              onClick={() => {
                                const newExpanded = new Set(
                                  expandedSpecialOffers,
                                );
                                if (isExpanded) {
                                  newExpanded.delete(offer.id);
                                } else {
                                  newExpanded.add(offer.id);
                                }
                                setExpandedSpecialOffers(newExpanded);
                              }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-white">
                                    {offer.streamingAccount.name}
                                  </h4>
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="default"
                                    className={offerStatus.color}
                                  >
                                    {offerStatus.status}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSpecialOffer(offer.id);
                                    }}
                                    className="text-red-400 border-red-600 hover:bg-red-600 hover:text-white"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Brief info when collapsed */}
                              {!isExpanded && (
                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                  <span>
                                    Usuario:{" "}
                                    {offer.user.name || offer.user.email}
                                  </span>
                                  <span className="text-emerald-400">
                                    {offer.discountPercentage}% OFF
                                  </span>
                                  <span className="text-slate-400">
                                    Expira: {formatDate(offer.expiresAt)}
                                    {offer.expiresAt && expired && (
                                      <span className="text-red-400 ml-1">
                                        ⚠️ Expirado
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="border-t border-slate-600 p-4 bg-slate-750">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Detalles de la Oferta */}
                                  <div className="space-y-3">
                                    <h5 className="text-sm font-semibold text-yellow-400 mb-2">
                                      🎯 Detalles de la Oferta
                                    </h5>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Usuario:
                                      </span>
                                      <span className="text-white font-medium">
                                        {offer.user.name || offer.user.email}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Descuento:
                                      </span>
                                      <span className="text-emerald-400 font-medium">
                                        {offer.discountPercentage}% OFF
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Precio original:
                                      </span>
                                      <span className="text-white font-medium">
                                        $
                                        {offer.streamingAccount?.price?.toLocaleString(
                                          "es-CO",
                                          { maximumFractionDigits: 0 },
                                        ) || "N/A"}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Precio con descuento:
                                      </span>
                                      <span className="text-green-400 font-medium">
                                        $
                                        {offer.streamingAccount?.price
                                          ? (
                                              offer.streamingAccount.price *
                                              (1 -
                                                offer.discountPercentage / 100)
                                            ).toLocaleString("es-CO", {
                                              maximumFractionDigits: 0,
                                            })
                                          : "N/A"}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Expira:
                                      </span>
                                      <div className="text-right">
                                        <span
                                          className={`font-medium ${
                                            offer.expiresAt && expired
                                              ? "text-red-400"
                                              : "text-slate-300"
                                          }`}
                                        >
                                          {formatDate(offer.expiresAt)}
                                        </span>
                                        {offer.expiresAt && expired && (
                                          <div className="text-xs text-red-400">
                                            ⚠️ Expirado
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Estado:
                                      </span>
                                      <span
                                        className={`font-medium ${
                                          expired
                                            ? "text-red-400"
                                            : "text-green-400"
                                        }`}
                                      >
                                        {expired ? "Expirada" : "Activa"}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Creada:
                                      </span>
                                      <span className="text-white font-medium">
                                        {new Date(
                                          offer.createdAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Detalles del Producto */}
                                  <div className="space-y-3">
                                    <h5 className="text-sm font-semibold text-yellow-400 mb-2">
                                      📋 Detalles del Producto
                                    </h5>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Tipo:
                                      </span>
                                      <span className="text-white font-medium">
                                        {offer.streamingAccount.type}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Ahorro total:
                                      </span>
                                      <span className="text-green-400 font-medium">
                                        $
                                        {offer.streamingAccount?.price
                                          ? (
                                              (offer.streamingAccount.price *
                                                offer.discountPercentage) /
                                              100
                                            ).toLocaleString("es-CO", {
                                              maximumFractionDigits: 0,
                                            })
                                          : "N/A"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Alerta si está expirada */}
                                {expired && (
                                  <div className="mt-4 p-3 bg-red-900/30 rounded border border-red-800/50">
                                    <p className="text-xs text-red-400">
                                      ⚠️ Esta oferta ya no está disponible para
                                      el usuario. Considere eliminarla o
                                      renovarla.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Estadísticas de Usuarios con Mayores compras */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Usuarios con Mayores Compras - Candidatos para Ofertas
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Top 10 usuarios por número de pedidos - Selecciona los más
                    adecuados para ofertas especiales
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topBuyers.map((user, index) => (
                      <div
                        key={user.id}
                        className="flex flex-wrap items-center justify-between p-3 bg-slate-700 rounded-lg"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {user.name || user.email}
                            </p>
                            <p className="text-sm text-slate-400">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">
                            {(user as any).orderCount} pedidos
                          </p>
                          <p className="text-sm text-slate-400">
                            {formatCurrency(user.totalSpent)}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (selectedUsersForOffer.includes(user.id)) {
                                setSelectedUsersForOffer(
                                  selectedUsersForOffer.filter(
                                    (id) => id !== user.id,
                                  ),
                                );
                              } else {
                                setSelectedUsersForOffer([
                                  ...selectedUsersForOffer,
                                  user.id,
                                ]);
                              }
                            }}
                            className={`mt-1 ${
                              selectedUsersForOffer.includes(user.id)
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "border-slate-600 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            {selectedUsersForOffer.includes(user.id)
                              ? "Seleccionado"
                              : "Seleccionar"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cuentas Exclusivas */}
            <TabsContent value="exclusivas" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Crear Cuenta Exclusiva */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Cuentas Exclusivas
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Crea cuentas premium para usuarios seleccionados
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedUsersForExclusive.length === 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-400 text-sm">
                          ⚠️ Selecciona usuarios desde la sección de
                          estadísticas de abajo para crear cuentas exclusivas
                        </p>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <Label
                          htmlFor="exclusiveName"
                          className="text-slate-300"
                        >
                          Nombre
                        </Label>
                        <Input
                          id="exclusiveName"
                          value={newExclusiveAccount.name}
                          onChange={(e) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              name: e.target.value,
                            })
                          }
                          placeholder="Netflix Premium Exclusivo"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="exclusiveDescription"
                          className="text-slate-300"
                        >
                          Descripción
                        </Label>
                        <Input
                          id="exclusiveDescription"
                          value={newExclusiveAccount.description}
                          onChange={(e) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              description: e.target.value,
                            })
                          }
                          placeholder="Acceso exclusivo con beneficios adicionales"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="exclusiveType"
                          className="text-slate-300"
                        >
                          Tipo
                        </Label>
                        <Select
                          value={newExclusiveAccount.type}
                          onValueChange={(value) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              type: value,
                            })
                          }
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Selecciona el tipo" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {streamingTypes.map((type) => (
                              <SelectItem
                                key={type.id}
                                value={type.name}
                                className="text-white"
                              >
                                <div className="flex items-center space-x-2">
                                  {type.imageUrl ? (
                                    <img
                                      src={type.imageUrl}
                                      alt={type.name}
                                      className="w-5 h-5 rounded object-cover"
                                    />
                                  ) : (
                                    <span>📺</span>
                                  )}
                                  <span>{type.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label
                          htmlFor="exclusivePrice"
                          className="text-slate-300"
                        >
                          Precio (COP)
                        </Label>
                        <Input
                          id="exclusivePrice"
                          type="number"
                          value={newExclusiveAccount.price}
                          onChange={(e) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              price: e.target.value,
                            })
                          }
                          placeholder="75000"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="exclusiveDuration"
                          className="text-slate-300"
                        >
                          Duración
                        </Label>
                        <Select
                          value={newExclusiveAccount.duration}
                          onValueChange={(value) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              duration: value,
                            })
                          }
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Selecciona la duración" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="1 mes" className="text-white">
                              1 Mes
                            </SelectItem>
                            <SelectItem value="2 meses" className="text-white">
                              2 Meses
                            </SelectItem>
                            <SelectItem value="3 meses" className="text-white">
                              3 Meses
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label
                          htmlFor="exclusiveQuality"
                          className="text-slate-300"
                        >
                          Calidad
                        </Label>
                        <Select
                          value={newExclusiveAccount.quality}
                          onValueChange={(value) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              quality: value,
                            })
                          }
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Selecciona la calidad" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="HD" className="text-white">
                              HD (720p)
                            </SelectItem>
                            <SelectItem value="Full HD" className="text-white">
                              Full HD (1080p)
                            </SelectItem>
                            <SelectItem value="4K UHD" className="text-white">
                              4K UHD (2160p)
                            </SelectItem>
                            <SelectItem value="4K HDR" className="text-white">
                              4K HDR
                            </SelectItem>
                            <SelectItem value="8K" className="text-white">
                              8K (4320p)
                            </SelectItem>
                            <SelectItem value="SD" className="text-white">
                              SD (480p)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label
                          htmlFor="exclusiveScreens"
                          className="text-slate-300"
                        >
                          Pantallas
                        </Label>
                        <Select
                          value={newExclusiveAccount.screens}
                          onValueChange={(value) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              screens: value,
                            })
                          }
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Selecciona número de pantallas" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="1" className="text-white">
                              1 pantalla
                            </SelectItem>
                            <SelectItem value="2" className="text-white">
                              2 pantallas
                            </SelectItem>
                            <SelectItem value="3" className="text-white">
                              3 pantallas
                            </SelectItem>
                            <SelectItem value="4" className="text-white">
                              4 pantallas
                            </SelectItem>
                            <SelectItem value="5" className="text-white">
                              5 pantallas
                            </SelectItem>
                            <SelectItem value="6" className="text-white">
                              6 pantallas
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label
                          htmlFor="exclusiveSaleType"
                          className="text-slate-300"
                        >
                          Tipo de Venta
                        </Label>
                        <Select
                          value={newExclusiveAccount.saleType}
                          onValueChange={(value) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              saleType: value,
                            })
                          }
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="FULL" className="text-white">
                              Cuenta Completa
                            </SelectItem>
                            <SelectItem value="PROFILES" className="text-white">
                              Por Perfiles
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {/* {newExclusiveAccount.saleType === "PROFILES" && (
                        <>
                          <div>
                            <Label
                              htmlFor="exclusiveMaxProfiles"
                              className="text-slate-300"
                            >
                              Máximo de Perfiles
                            </Label>
                            <Input
                              id="exclusiveMaxProfiles"
                              type="number"
                              value={newExclusiveAccount.maxProfiles}
                              onChange={(e) =>
                                setNewExclusiveAccount({
                                  ...newExclusiveAccount,
                                  maxProfiles: e.target.value,
                                })
                              }
                              placeholder="5"
                              className="bg-slate-700 border-slate-600 text-white"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor="exclusivePricePerProfile"
                              className="text-slate-300"
                            >
                              Precio por Perfil (COP)
                            </Label>
                            <Input
                              id="exclusivePricePerProfile"
                              type="number"
                              value={newExclusiveAccount.pricePerProfile}
                              onChange={(e) =>
                                setNewExclusiveAccount({
                                  ...newExclusiveAccount,
                                  pricePerProfile: e.target.value,
                                })
                              }
                              placeholder="15000"
                              className="bg-slate-700 border-slate-600 text-white"
                            />
                          </div>
                        </>
                      )} */}

                      <div>
                        <Label
                          htmlFor="exclusiveExpiresAt"
                          className="text-slate-300"
                        >
                          Fecha de expiración (opcional)
                        </Label>
                        <Input
                          id="exclusiveExpiresAt"
                          type="date"
                          value={newExclusiveAccount.expiresAt}
                          onChange={(e) =>
                            setNewExclusiveAccount({
                              ...newExclusiveAccount,
                              expiresAt: e.target.value,
                            })
                          }
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Si no se establece, la cuenta exclusiva no expirará
                          automáticamente
                        </p>
                      </div>
                      <Button
                        onClick={handleCreateExclusiveAccount}
                        className="w-full bg-yellow-600 hover:bg-yellow-700"
                        disabled={selectedUsersForExclusive.length === 0}
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        Crear Cuenta Exclusiva para{" "}
                        {selectedUsersForExclusive.length} usuarios
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Lista de Cuentas Exclusivas Existentes */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Cuentas Exclusivas Activas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="p-4 space-y-4 max-h-[667px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 hover:scrollbar-thumb-slate-500">
                      {exclusiveAccounts.map((account) => {
                        const isExpanded = expandedExclusiveAccounts.has(
                          account.id,
                        );
                        const expired = isExclusiveAccountExpired(
                          account.expiresAt,
                        );
                        const accountStatus =
                          getExclusiveAccountStatus(account);

                        return (
                          <div
                            key={account.id}
                            className="relative bg-gradient-to-br from-amber-900/20 via-amber-800/10 to-yellow-900/20 rounded-xl overflow-hidden border border-amber-700/30 shadow-2xl shadow-amber-900/20"
                          >
                            {/* Premium Border Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent opacity-50"></div>
                            {/* Header - Clickable */}
                            <div
                              className="relative p-4 cursor-pointer hover:bg-amber-900/10 transition-all duration-300"
                              onClick={() => {
                                const newExpanded = new Set(
                                  expandedExclusiveAccounts,
                                );
                                if (isExpanded) {
                                  newExpanded.delete(account.id);
                                } else {
                                  newExpanded.add(account.id);
                                }
                                setExpandedExclusiveAccounts(newExpanded);
                              }}
                            >
                              {/* Crown Icon */}
                              <div className="absolute top-2 right-2">
                                <Crown className="w-5 h-5 text-amber-400 drop-shadow-lg" />
                              </div>

                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
                                    <Crown className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-white text-lg bg-gradient-to-r from-amber-200 to-yellow-200 bg-clip-text text-transparent">
                                      {account.name}
                                    </h4>
                                    <p className="text-xs text-amber-300/70">
                                      Cuenta Exclusiva Premium
                                    </p>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-amber-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-amber-400" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="default"
                                    className={`${
                                      accountStatus.color === "bg-green-600"
                                        ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/30"
                                        : accountStatus.color === "bg-red-600"
                                          ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30"
                                          : "bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-lg shadow-slate-500/30"
                                    } border-0`}
                                  >
                                    {accountStatus.status}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-red-600/20 border-red-600/50 text-red-400 hover:bg-red-600/30 p-2 hover:scale-105 transition-transform"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteExclusiveAccount(account.id);
                                    }}
                                    title="Eliminar cuenta exclusiva"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              {/* Premium Info */}
                              <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-amber-200 font-bold text-lg">
                                    {formatCurrency(account.price)}
                                  </span>
                                  <div className="px-2 py-1 bg-amber-500/20 rounded-full">
                                    <span className="text-xs text-amber-300 font-medium">
                                      {account.allowedUsers.length} usuarios
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Expiration Date with Premium Styling */}
                              <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-700/30">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-amber-300 font-medium text-sm">
                                      Expira:
                                    </span>
                                    <span
                                      className={`text-sm font-bold ${
                                        expired
                                          ? "text-red-400"
                                          : "text-amber-200"
                                      }`}
                                    >
                                      {formatDate(account.expiresAt)}
                                    </span>
                                  </div>
                                  {account.expiresAt && (
                                    <div className="flex items-center gap-1">
                                      {expired ? (
                                        <span className="text-xs text-red-400 font-medium bg-red-900/30 px-2 py-1 rounded-full">
                                          ⚠️ Expirado
                                        </span>
                                      ) : (
                                        <span className="text-xs text-green-400 font-medium bg-green-900/30 px-2 py-1 rounded-full">
                                          ✅ Activa
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {!account.expiresAt && (
                                  <p className="text-xs text-amber-400/70 mt-1 italic">
                                    Sin fecha de expiración definida
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="border-t border-amber-700/30 p-4 bg-gradient-to-b from-amber-900/10 to-amber-800/5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Detalles Básicos */}
                                  <div className="space-y-3">
                                    <h5 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                                      <Crown className="w-4 h-4" />
                                      Detalles Premium
                                    </h5>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-amber-200/70">
                                        Tipo:
                                      </span>
                                      <span className="text-amber-100 font-medium">
                                        {account.type}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-amber-200/70">
                                        Duración:
                                      </span>
                                      <span className="text-amber-100 font-medium">
                                        {account.duration} días
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-amber-200/70">
                                        Calidad:
                                      </span>
                                      <span className="text-amber-100 font-medium">
                                        {account.quality || "N/A"}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-amber-200/70">
                                        Pantallas:
                                      </span>
                                      <span className="text-amber-100 font-medium">
                                        {account.screens || "N/A"}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-amber-200/70">
                                        Tipo de venta:
                                      </span>
                                      <span className="text-amber-100 font-medium">
                                        {account.saleType === "FULL"
                                          ? "Cuenta completa"
                                          : "Por perfiles"}
                                      </span>
                                    </div>

                                    {account.saleType === "PROFILES" && (
                                      <>
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-slate-400">
                                            Máx. perfiles:
                                          </span>
                                          <span className="text-white font-medium">
                                            {account.maxProfiles || "N/A"}
                                          </span>
                                        </div>

                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-slate-400">
                                            Precio por perfil:
                                          </span>
                                          <span className="text-white font-medium">
                                            {account.pricePerProfile
                                              ? formatCurrency(
                                                  account.pricePerProfile,
                                                )
                                              : "N/A"}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  {/* Acceso y Stock */}
                                  <div className="space-y-3">
                                    <h5 className="text-sm font-semibold text-yellow-400 mb-2">
                                      🔐 Acceso y Stock
                                    </h5>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Visibilidad:
                                      </span>
                                      <span
                                        className={`font-medium ${
                                          account.isPublic
                                            ? "text-green-400"
                                            : "text-orange-400"
                                        }`}
                                      >
                                        {account.isPublic
                                          ? "Pública"
                                          : "Privada"}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Usuarios con acceso:
                                      </span>
                                      <span className="text-white font-medium">
                                        {account.allowedUsers.length}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Total de órdenes:
                                      </span>
                                      <span className="text-white font-medium">
                                        {account._count?.orders || 0}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Expira:
                                      </span>
                                      <div className="text-right">
                                        <span
                                          className={`font-medium ${
                                            account.expiresAt && expired
                                              ? "text-red-400"
                                              : "text-slate-300"
                                          }`}
                                        >
                                          {formatDate(account.expiresAt)}
                                        </span>
                                        {account.expiresAt && expired && (
                                          <div className="text-xs text-red-400">
                                            ⚠️ Expirado
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Creada:
                                      </span>
                                      <span className="text-white font-medium">
                                        {new Date(
                                          account.createdAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-400">
                                        Estado:
                                      </span>
                                      <span
                                        className={`font-medium ${
                                          account.isActive
                                            ? "text-green-400"
                                            : "text-red-400"
                                        }`}
                                      >
                                        {account.isActive
                                          ? "Activa"
                                          : "Inactiva"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Usuarios con acceso */}
                                {account.allowedUsers.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-slate-600">
                                    <h5 className="text-sm font-semibold text-yellow-400 mb-2">
                                      👥 Usuarios con Acceso
                                    </h5>
                                    <div className="flex flex-wrap gap-2">
                                      {account.allowedUsers.map((user) => (
                                        <Badge
                                          key={user.id}
                                          variant="outline"
                                          className="bg-slate-600 text-slate-200 border-slate-500 text-xs"
                                        >
                                          {user.name || user.email}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Stock disponible */}
                                <div className="mt-4 pt-4 border-t border-slate-600">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-sm font-semibold text-yellow-400">
                                      📦 Stock Disponible
                                    </h5>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="bg-yellow-600/20 border-yellow-600/50 text-yellow-400 hover:bg-yellow-600/30"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Configurar los datos del formulario
                                        setStockData({
                                          accountType: "exclusive",
                                          streamingAccountId: "",
                                          exclusiveAccountId: account.id,
                                          saleType: "FULL",
                                          accounts: "",
                                          profiles: "",
                                          email: "",
                                          password: "",
                                          profileName: "",
                                          pin: "",
                                          notes: "",
                                        });
                                        // Cambiar a la pestaña de Stock
                                        setActiveTab("stock");
                                      }}
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Agregar Stock
                                    </Button>
                                  </div>
                                  <div className="mt-2 text-sm text-slate-400">
                                    {account.exclusiveStocks ? (
                                      <div className="space-y-1">
                                        <div className="flex justify-between">
                                          <span>Disponibles:</span>
                                          <span className="text-green-400 font-medium">
                                            {
                                              account.exclusiveStocks.filter(
                                                (stock: any) =>
                                                  stock.isAvailable,
                                              ).length
                                            }
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Vendidos:</span>
                                          <span className="text-red-400 font-medium">
                                            {
                                              account.exclusiveStocks.filter(
                                                (stock: any) =>
                                                  !stock.isAvailable,
                                              ).length
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-500">
                                        No hay stock agregado
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Alerta si está expirada */}
                                {expired && (
                                  <div className="mt-4 p-3 bg-red-900/30 rounded border border-red-800/50">
                                    <p className="text-xs text-red-400">
                                      ⚠️ Esta cuenta exclusiva ha expirado.
                                      Considere renovarla o eliminarla.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Estadísticas de Usuarios con Mayores Ventas */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-yellow-400" />
                    Usuarios con Mayores Ventas - Candidatos para Cuentas
                    Exclusivas
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Top 10 usuarios por número de pedidos - Selecciona los más
                    adecuados para cuentas exclusivas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topVendors.map((user, index) => (
                      <div
                        key={user.id}
                        className="flex flex-wrap items-center justify-between p-3 bg-slate-700 rounded-lg"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {user.name || user.email}
                            </p>
                            <p className="text-sm text-slate-400">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">
                            {(user as any).orderCount} pedidos
                          </p>
                          <p className="text-sm text-slate-400">
                            {formatCurrency(user.totalSpent)}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (selectedUsersForExclusive.includes(user.id)) {
                                setSelectedUsersForExclusive(
                                  selectedUsersForExclusive.filter(
                                    (id) => id !== user.id,
                                  ),
                                );
                              } else {
                                setSelectedUsersForExclusive([
                                  ...selectedUsersForExclusive,
                                  user.id,
                                ]);
                              }
                            }}
                            className={`mt-1 ${
                              selectedUsersForExclusive.includes(user.id)
                                ? "bg-yellow-600 border-yellow-600 text-white"
                                : "border-slate-600 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            {selectedUsersForExclusive.includes(user.id)
                              ? "Seleccionado"
                              : "Seleccionar"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Soporte */}
            <TabsContent value="soporte" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                    <Headphones className="w-6 h-6 text-emerald-400" />
                    Configuración de Soporte
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Gestiona los números de contacto de soporte que serán
                    visibles para todos los usuarios
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Formulario para agregar nuevo contacto */}
                    <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Agregar Nuevo Contacto
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label
                            htmlFor="contactName"
                            className="text-slate-300"
                          >
                            Nombre del Contacto
                          </Label>
                          <Input
                            id="contactName"
                            value={newSupportContact.name}
                            onChange={(e) =>
                              setNewSupportContact({
                                ...newSupportContact,
                                name: e.target.value,
                              })
                            }
                            placeholder="Ej: Soporte WhatsApp"
                            className="bg-slate-600 border-slate-500 text-white placeholder-slate-400"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="contactNumber"
                            className="text-slate-300"
                          >
                            Número de Teléfono
                          </Label>
                          <Input
                            id="contactNumber"
                            value={newSupportContact.number}
                            onChange={(e) =>
                              setNewSupportContact({
                                ...newSupportContact,
                                number: e.target.value,
                              })
                            }
                            placeholder="Ej: +57 300 123 4567"
                            className="bg-slate-600 border-slate-500 text-white placeholder-slate-400"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="contactType"
                            className="text-slate-300"
                          >
                            Tipo
                          </Label>
                          <Select
                            value={newSupportContact.type}
                            onValueChange={(value) =>
                              setNewSupportContact({
                                ...newSupportContact,
                                type: value,
                              })
                            }
                          >
                            <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
                              <SelectItem
                                value="whatsapp"
                                className="text-white"
                              >
                                WhatsApp
                              </SelectItem>
                              <SelectItem
                                value="telegram"
                                className="text-white"
                              >
                                Telegram
                              </SelectItem>
                              <SelectItem value="phone" className="text-white">
                                Teléfono
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label
                            htmlFor="contactOrder"
                            className="text-slate-300"
                          >
                            Orden
                          </Label>
                          <Input
                            id="contactOrder"
                            type="number"
                            value={newSupportContact.order}
                            onChange={(e) =>
                              setNewSupportContact({
                                ...newSupportContact,
                                order: parseInt(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                            className="bg-slate-600 border-slate-500 text-white placeholder-slate-400"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label
                            htmlFor="contactDescription"
                            className="text-slate-300"
                          >
                            Descripción (Opcional)
                          </Label>
                          <Textarea
                            id="contactDescription"
                            value={newSupportContact.description}
                            onChange={(e) =>
                              setNewSupportContact({
                                ...newSupportContact,
                                description: e.target.value,
                              })
                            }
                            placeholder="Información adicional sobre este contacto"
                            className="bg-slate-600 border-slate-500 text-white placeholder-slate-400"
                            rows={3}
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-3">
                          <Checkbox
                            id="contactActive"
                            checked={newSupportContact.isActive}
                            onCheckedChange={(checked) =>
                              setNewSupportContact({
                                ...newSupportContact,
                                isActive: Boolean(checked),
                              })
                            }
                            className="border-slate-500"
                          />
                          <Label
                            htmlFor="contactActive"
                            className="text-slate-300"
                          >
                            Contacto activo
                          </Label>
                        </div>
                        <div className="md:col-span-2">
                          <Button
                            onClick={addSupportContact}
                            disabled={
                              !newSupportContact.name ||
                              !newSupportContact.number
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Agregar Contacto
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Lista de contactos existentes */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Contactos Configurados
                      </h3>
                      {supportContacts.length === 0 ? (
                        <div className="text-center py-8 bg-slate-700/30 rounded-lg border border-slate-600">
                          <p className="text-slate-400">
                            No hay contactos configurados
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {supportContacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <span className="text-2xl">
                                      {contact.type === "whatsapp"
                                        ? "💬"
                                        : contact.type === "telegram"
                                          ? "✈️"
                                          : contact.type === "phone"
                                            ? "📞"
                                            : "💬"}
                                    </span>
                                    <h4 className="text-white font-medium">
                                      {contact.name}
                                    </h4>
                                    <Badge
                                      variant={
                                        contact.isActive
                                          ? "default"
                                          : "secondary"
                                      }
                                      className={
                                        contact.isActive
                                          ? "bg-emerald-600"
                                          : "bg-slate-600"
                                      }
                                    >
                                      {contact.isActive ? "Activo" : "Inactivo"}
                                    </Badge>
                                  </div>
                                  <p className="text-emerald-400 text-sm mb-1">
                                    {contact.number}
                                  </p>
                                  {contact.description && (
                                    <p className="text-slate-400 text-sm">
                                      {contact.description}
                                    </p>
                                  )}
                                  <p className="text-slate-500 text-xs mt-2">
                                    Orden: {contact.order}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      toggleSupportContact(contact.id)
                                    }
                                    className="border-slate-500 text-white hover:bg-slate-600"
                                  >
                                    {contact.isActive ? (
                                      <Lock className="w-4 h-4" />
                                    ) : (
                                      <Unlock className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      deleteSupportContact(contact.id)
                                    }
                                    className="border-red-500 text-red-400 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Vista previa de cómo se verá para los usuarios */}
                    <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Vista Previa para Usuarios
                      </h3>
                      <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
                        <p className="text-slate-400 text-sm mb-3">
                          Así verán los usuarios los contactos de soporte:
                        </p>
                        <div className="space-y-2">
                          {supportContacts
                            .filter((c) => c.isActive)
                            .sort((a, b) => a.order - b.order)
                            .map((contact) => (
                              <div
                                key={contact.id}
                                className="flex items-center gap-3 p-2 bg-slate-700/50 rounded"
                              >
                                <span className="text-xl">
                                  {contact.type === "whatsapp"
                                    ? "💬"
                                    : contact.type === "telegram"
                                      ? "✈️"
                                      : contact.type === "phone"
                                        ? "📞"
                                        : "💬"}
                                </span>
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">
                                    {contact.name}
                                  </p>
                                  <p className="text-emerald-400 text-sm">
                                    {contact.number}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* User Orders Modal */}
          <Dialog open={showUserOrders} onOpenChange={setShowUserOrders}>
            <DialogContent className="bg-slate-800 border-slate-700 max-w-6xl">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Pedidos de {selectedUser?.name || selectedUser?.email}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Historial completo de pedidos del usuario - Click en la flecha
                  para ver detalles
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[400px] ">
                <div className="space-y-4">
                  {userOrders.map((order) => (
                    <div key={order.id} className="p-4 bg-slate-700 rounded-lg">
                      {/* Header con información básica y flecha */}
                      <div
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => toggleOrderExpansion(order.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-white text-lg">
                              {order.streamingAccount?.name ||
                                "Exclusive Account"}
                            </h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-white hover:bg-slate-600 p-1 h-auto"
                            >
                              {expandedOrders.has(order.id) ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className="border-slate-600 text-slate-300"
                            >
                              {order.streamingAccount?.type || "EXCLUSIVE"}
                            </Badge>
                            <Badge
                              variant={
                                order.status === "COMPLETED"
                                  ? "default"
                                  : "secondary"
                              }
                              className={
                                order.status === "COMPLETED"
                                  ? "bg-green-600"
                                  : "bg-slate-600"
                              }
                            >
                              {order.status}
                            </Badge>
                            {order.deliveryStatus && (
                              <Badge
                                variant="outline"
                                className={
                                  order.deliveryStatus === "DELIVERED"
                                    ? "border-green-600 text-green-400"
                                    : order.deliveryStatus === "FAILED"
                                      ? "border-red-600 text-red-400"
                                      : "border-yellow-600 text-yellow-400"
                                }
                              >
                                Entrega: {order.deliveryStatus}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white text-lg">
                            {formatCurrency(order.totalPrice)}
                          </p>
                          <p className="text-sm text-slate-400">
                            Cantidad: {order.quantity}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Credenciales siempre visibles */}
                      {(order.accountEmail || order.profileName) && (
                        <div className="mt-3 p-3 bg-emerald-600/20 border border-emerald-600/30 rounded text-sm">
                          <p className="text-emerald-400 mb-2 font-medium">
                            Credenciales Entregadas:
                          </p>
                          <div className="font-mono text-xs text-white space-y-1">
                            {order.accountEmail && (
                              <p>
                                Email:{" "}
                                <span className="text-emerald-300 font-semibold">
                                  {order.accountEmail}
                                </span>
                              </p>
                            )}
                            {order.accountPassword && (
                              <p>
                                Contraseña:{" "}
                                <span className="text-emerald-300 font-semibold">
                                  {order.accountPassword}
                                </span>
                              </p>
                            )}
                            {order.profileName && (
                              <p>
                                Perfil:{" "}
                                <span className="text-emerald-300 font-semibold">
                                  {order.profileName}
                                </span>
                              </p>
                            )}
                            {order.profilePin && (
                              <p>
                                PIN:{" "}
                                <span className="text-emerald-300 font-semibold">
                                  {order.profilePin}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Detalles expandibles */}
                      {expandedOrders.has(order.id) && (
                        <div className="mt-4 pt-4 border-t border-slate-600 space-y-4">
                          {/* Información básica del pedido */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-slate-400 mb-1">
                                Tipo de Venta:
                              </p>
                              <p className="text-white font-medium">
                                {order.saleType === "FULL"
                                  ? "Cuenta Completa"
                                  : "Perfil Individual"}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 mb-1">
                                Fecha del Pedido:
                              </p>
                              <p className="text-white">
                                {new Date(order.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 mb-1">Vence:</p>
                              <p className="text-white">
                                {new Date(order.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 mb-1">
                                ID del Pedido:
                              </p>
                              <p className="text-white font-mono text-xs">
                                {order.id}
                              </p>
                            </div>
                          </div>

                          {/* Detalles del producto si existe streamingAccount */}
                          {order.streamingAccount && (
                            <div className="p-3 bg-slate-600/50 rounded text-sm">
                              <p className="text-slate-400 mb-2">
                                Detalles del Producto:
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                <div>
                                  <span className="text-slate-400">
                                    Duración:
                                  </span>
                                  <p className="text-white">
                                    {order.streamingAccount.duration}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Calidad:
                                  </span>
                                  <p className="text-white">
                                    {order.streamingAccount.quality}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Pantallas:
                                  </span>
                                  <p className="text-white">
                                    {order.streamingAccount.screens}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Precio Unitario:
                                  </span>
                                  <p className="text-white">
                                    {formatCurrency(
                                      order.streamingAccount.price,
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Intentos de entrega */}
                          {order.deliveryAttempts &&
                            order.deliveryAttempts > 0 && (
                              <div className="p-3 bg-slate-600/50 rounded text-sm">
                                <p className="text-slate-400 mb-1">
                                  Intentos de Entrega:
                                </p>
                                <p className="text-white">
                                  {order.deliveryAttempts} intentos
                                </p>
                                {order.lastDeliveryAttempt && (
                                  <p className="text-xs text-slate-400">
                                    Último intento:{" "}
                                    {formatDate(order.lastDeliveryAttempt)}
                                  </p>
                                )}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))}

                  {userOrders.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-slate-400">
                        Este usuario no tiene pedidos registrados
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Account Dialog */}
        <Dialog
          open={showEditAccountDialog}
          onOpenChange={setShowEditAccountDialog}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Editar Cuenta</DialogTitle>
              <DialogDescription className="text-slate-400">
                Modifica los detalles de la cuenta de streaming
              </DialogDescription>
            </DialogHeader>
            {editingAccount && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editAccountName" className="text-slate-300">
                    Nombre
                  </Label>
                  <Input
                    id="editAccountName"
                    value={editingAccount.name}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        name: e.target.value,
                      })
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="editAccountType" className="text-slate-300">
                    Tipo
                  </Label>
                  <Select
                    value={editingAccount.type}
                    onValueChange={(value) =>
                      setEditingAccount({ ...editingAccount, type: value })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {streamingTypes.map((type) => (
                        <SelectItem
                          key={type.id}
                          value={type.name}
                          className="text-white"
                        >
                          <div className="flex items-center space-x-2">
                            {type.imageUrl ? (
                              <img
                                src={type.imageUrl}
                                alt={type.name}
                                className="w-5 h-5 rounded object-cover"
                              />
                            ) : (
                              <span>📺</span>
                            )}
                            <span>{type.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="editAccountPrice" className="text-slate-300">
                    Precio (COP)
                  </Label>
                  <Input
                    id="editAccountPrice"
                    type="number"
                    value={editingAccount.price}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        price: parseInt(e.target.value),
                      })
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="editAccountDuration"
                    className="text-slate-300"
                  >
                    Duración
                  </Label>
                  <Select
                    value={editingAccount.duration}
                    onValueChange={(value) =>
                      setEditingAccount({ ...editingAccount, duration: value })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Selecciona la duración" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="1 mes" className="text-white">
                        1 mes
                      </SelectItem>
                      <SelectItem value="3 meses" className="text-white">
                        3 meses
                      </SelectItem>
                      <SelectItem value="6 meses" className="text-white">
                        6 meses
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    htmlFor="editAccountQuality"
                    className="text-slate-300"
                  >
                    Calidad
                  </Label>
                  <Select
                    value={editingAccount.quality}
                    onValueChange={(value) =>
                      setEditingAccount({ ...editingAccount, quality: value })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Selecciona la calidad" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="HD" className="text-white">
                        HD (720p)
                      </SelectItem>
                      <SelectItem value="Full HD" className="text-white">
                        Full HD (1080p)
                      </SelectItem>
                      <SelectItem value="4K UHD" className="text-white">
                        4K UHD (2160p)
                      </SelectItem>
                      <SelectItem value="4K HDR" className="text-white">
                        4K HDR
                      </SelectItem>
                      <SelectItem value="8K" className="text-white">
                        8K (4320p)
                      </SelectItem>
                      <SelectItem value="SD" className="text-white">
                        SD (480p)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    htmlFor="editAccountScreens"
                    className="text-slate-300"
                  >
                    Pantallas
                  </Label>
                  <Select
                    value={editingAccount.screens?.toString()}
                    onValueChange={(value) =>
                      setEditingAccount({
                        ...editingAccount,
                        screens: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Selecciona número de pantallas" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="1" className="text-white">
                        1 pantalla
                      </SelectItem>
                      <SelectItem value="2" className="text-white">
                        2 pantallas
                      </SelectItem>
                      <SelectItem value="3" className="text-white">
                        3 pantallas
                      </SelectItem>
                      <SelectItem value="4" className="text-white">
                        4 pantallas
                      </SelectItem>
                      <SelectItem value="5" className="text-white">
                        5 pantallas
                      </SelectItem>
                      <SelectItem value="6" className="text-white">
                        6 pantallas
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    htmlFor="editAccountSaleType"
                    className="text-slate-300"
                  >
                    Tipo de Venta
                  </Label>
                  <Select
                    value={editingAccount.saleType}
                    onValueChange={(value) =>
                      setEditingAccount({ ...editingAccount, saleType: value })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="FULL" className="text-white">
                        Cuenta Completa
                      </SelectItem>
                      <SelectItem value="PROFILES" className="text-white">
                        Por Perfiles
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="editAccountActive"
                    checked={editingAccount.isActive}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        isActive: e.target.checked,
                      })
                    }
                    className="rounded border-slate-600 bg-slate-800 text-emerald-600"
                  />
                  <Label htmlFor="editAccountActive" className="text-slate-300">
                    Cuenta Activa
                  </Label>
                </div>
                <Button
                  onClick={handleUpdateAccount}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Actualizar Cuenta
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Type Dialog */}
        <Dialog
          open={showEditTypeDialog}
          onOpenChange={(open) => {
            setShowEditTypeDialog(open);
            if (open) setEditingType(null);
          }}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                Editar Tipo de Streaming
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Modifica los detalles del tipo de streaming
              </DialogDescription>
            </DialogHeader>
            {editingType && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editTypeName" className="text-slate-300">
                    Nombre
                  </Label>
                  <Input
                    id="editTypeName"
                    value={editingType.name}
                    onChange={(e) =>
                      setEditingType({ ...editingType, name: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="editTypeImage" className="text-slate-300">
                    Imagen del Tipo
                  </Label>
                  <div className="space-y-3">
                    {editingType.imageUrl && (
                      <div className="flex items-center space-x-3 p-3 bg-slate-700 rounded-lg border border-slate-600">
                        <img
                          src={editingType.imageUrl}
                          alt={editingType.name}
                          className="w-16 h-16 object-cover rounded-lg border-2 border-slate-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-green-400 font-medium">
                            ✓ Imagen actual
                          </p>
                          <p className="text-xs text-slate-400">
                            {editingType.imageUrl}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {/* Opción 1: Subir nueva imagen */}
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-400">
                          Opción 1: Subir nueva imagen
                        </Label>
                        <Input
                          id="editTypeImage"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="bg-slate-700 border-slate-600 text-white file:bg-slate-600 file:text-white file:border-0"
                        />
                        {uploadingImage && (
                          <div className="flex items-center space-x-2 text-sm text-slate-400">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Subiendo imagen...</span>
                          </div>
                        )}
                      </div>

                      {/* Opción 2: Usar galería */}
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-400">
                          Opción 2: Seleccionar de la galería
                        </Label>
                        <ImageGallery
                          onSelectImage={(base64) => {
                            setEditingType((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                imageUrl: base64,
                              };
                            });
                            toast.success("Imagen seleccionada de la galería");
                          }}
                          currentImage={editingType.imageUrl}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-slate-400">
                      Sube una nueva imagen o selecciona desde la galería (JPEG,
                      PNG, SVG, WebP)
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="editTypeColor" className="text-slate-300">
                    Color
                  </Label>
                  <Input
                    id="editTypeColor"
                    type="color"
                    value={editingType.color}
                    onChange={(e) =>
                      setEditingType({ ...editingType, color: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600 text-white h-10"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="editTypeActive"
                    checked={editingType.isActive}
                    onChange={(e) =>
                      setEditingType({
                        ...editingType,
                        isActive: e.target.checked,
                      })
                    }
                    className="rounded border-slate-600 bg-slate-800 text-emerald-600"
                  />
                  <Label htmlFor="editTypeActive" className="text-slate-300">
                    Tipo Activo
                  </Label>
                </div>
                <Button
                  onClick={handleUpdateType}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Actualizar Tipo
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Order Dialog */}
        <Dialog
          open={showEditOrderDialog}
          onOpenChange={setShowEditOrderDialog}
        >
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">
                Editar Credenciales del Pedido
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Actualiza las credenciales antes de rehabilitar al stock
              </DialogDescription>
            </DialogHeader>
            {editingOrder && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editAccountEmail" className="text-slate-300">
                    Email de la Cuenta
                  </Label>
                  <Input
                    id="editAccountEmail"
                    type="email"
                    value={editedOrderData.accountEmail}
                    onChange={(e) =>
                      setEditedOrderData({
                        ...editedOrderData,
                        accountEmail: e.target.value,
                      })
                    }
                    placeholder="cuenta@ejemplo.com"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="editAccountPassword"
                    className="text-slate-300"
                  >
                    Contraseña
                  </Label>
                  <Input
                    id="editAccountPassword"
                    type="password"
                    value={editedOrderData.accountPassword}
                    onChange={(e) =>
                      setEditedOrderData({
                        ...editedOrderData,
                        accountPassword: e.target.value,
                      })
                    }
                    placeholder="contraseña"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                {editingOrder.saleType === "PROFILES" && (
                  <>
                    <div>
                      <Label
                        htmlFor="editProfileName"
                        className="text-slate-300"
                      >
                        Nombre del Perfil
                      </Label>
                      <Input
                        id="editProfileName"
                        value={editedOrderData.profileName}
                        onChange={(e) =>
                          setEditedOrderData({
                            ...editedOrderData,
                            profileName: e.target.value,
                          })
                        }
                        placeholder="Perfil 1"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="editProfilePin"
                        className="text-slate-300"
                      >
                        PIN del Perfil (opcional)
                      </Label>
                      <Input
                        id="editProfilePin"
                        value={editedOrderData.profilePin}
                        onChange={(e) =>
                          setEditedOrderData({
                            ...editedOrderData,
                            profilePin: e.target.value,
                          })
                        }
                        placeholder="1234"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdateOrderCredentials}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Actualizar Credenciales
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowEditOrderDialog(false)}
                    className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Broadcast Message Modal */}
        <Dialog open={showBroadcastModal} onOpenChange={setShowBroadcastModal}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Mail className="w-5 h-5 text-blue-400" />
                Enviar Mensaje a Todos los Usuarios
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Envía un mensaje a todos los usuarios registrados (excluyendo
                administradores)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="messageTitle" className="text-slate-300">
                  Título del Mensaje
                </Label>
                <Input
                  id="messageTitle"
                  value={broadcastMessage.title}
                  onChange={(e) =>
                    setBroadcastMessage({
                      ...broadcastMessage,
                      title: e.target.value,
                    })
                  }
                  placeholder="Ej: Mantenimiento Programado"
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                />
              </div>

              <div>
                <Label htmlFor="messageType" className="text-slate-300">
                  Tipo de Mensaje
                </Label>
                <Select
                  value={broadcastMessage.type}
                  onValueChange={(
                    value: "GENERAL" | "WARNING" | "SYSTEM_NOTIFICATION",
                  ) =>
                    setBroadcastMessage({ ...broadcastMessage, type: value })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="GENERAL" className="text-white">
                      📢 General
                    </SelectItem>
                    <SelectItem value="WARNING" className="text-white">
                      ⚠️ Advertencia
                    </SelectItem>
                    <SelectItem
                      value="SYSTEM_NOTIFICATION"
                      className="text-white"
                    >
                      🔔 Notificación del Sistema
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="messageContent" className="text-slate-300">
                  Contenido del Mensaje
                </Label>
                <Textarea
                  id="messageContent"
                  value={broadcastMessage.content}
                  onChange={(e) =>
                    setBroadcastMessage({
                      ...broadcastMessage,
                      content: e.target.value,
                    })
                  }
                  placeholder="Escribe aquí el contenido del mensaje que será enviado a todos los usuarios..."
                  rows={6}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 resize-none"
                />
              </div>

              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-400 text-sm">
                  <Info className="w-4 h-4" />
                  <span>
                    Este mensaje será enviado a todos los usuarios registrados
                    excepto los administradores.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg">
                <input
                  type="checkbox"
                  id="broadcastTelegram"
                  checked={broadcastMessage.sendToTelegram}
                  onChange={(e) =>
                    setBroadcastMessage({
                      ...broadcastMessage,
                      sendToTelegram: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <label
                  htmlFor="broadcastTelegram"
                  className="text-sm text-slate-300 cursor-pointer"
                >
                  También enviar por Telegram a los usuarios con Telegram
                  vinculado
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleBroadcastMessage}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={
                  !broadcastMessage.title.trim() ||
                  !broadcastMessage.content.trim()
                }
              >
                <Mail className="w-4 h-4 mr-2" />
                Enviar Mensaje
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowBroadcastModal(false);
                  setBroadcastMessage({
                    title: "",
                    content: "",
                    type: "GENERAL",
                    sendToTelegram: true,
                  });
                }}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Recharge History Dialog */}
        <Dialog
          open={showRechargeHistory}
          onOpenChange={setShowRechargeHistory}
        >
          <DialogContent className="bg-slate-800 border-slate-700 max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5" />
                Historial de Recargas
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Historial completo de recargas del usuario
              </DialogDescription>
            </DialogHeader>

            {loadingRechargeHistory ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                <span className="text-slate-300">Cargando historial...</span>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  <div className="bg-slate-700/50 rounded-lg p-6">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                      <CreditCard className="w-4 h-4" />
                      <span className="text-sm">Total Recargas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {rechargeHistory.length}
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-6">
                    <div className="flex items-center gap-2 text-green-400 mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Monto Total</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(
                        rechargeHistory.reduce((sum, r) => sum + r.amount, 0),
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-6">
                    <div className="flex items-center gap-2 text-yellow-400 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm">Promedio</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {rechargeHistory.length > 0
                        ? formatCurrency(
                            rechargeHistory.reduce(
                              (sum, r) => sum + r.amount,
                              0,
                            ) / rechargeHistory.length,
                          )
                        : formatCurrency(0)}
                    </div>
                  </div>
                </div>

                {/* Recharge History Table */}
                <div className="bg-slate-700/50 rounded-lg overflow-hidden">
                  <div className="max-h-96 ">
                    {rechargeHistory.length === 0 ? (
                      <div className="p-8 text-center">
                        <CreditCard className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                        <p className="text-slate-400">
                          No hay recargas registradas
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <ScrollArea className="h-[400px]">
                            <TableHeader className="bg-slate-600/50">
                              <TableRow>
                                <TableHead className="text-slate-300">
                                  Fecha
                                </TableHead>
                                <TableHead className="text-slate-300">
                                  Monto
                                </TableHead>
                                <TableHead className="text-slate-300">
                                  Método
                                </TableHead>
                                <TableHead className="text-slate-300">
                                  Estado
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rechargeHistory.map((recharge) => (
                                <TableRow
                                  key={recharge.id}
                                  className="border-slate-600"
                                >
                                  <TableCell className="text-slate-300">
                                    {new Date(
                                      recharge.createdAt,
                                    ).toLocaleDateString("es-CO", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </TableCell>
                                  <TableCell className="text-white font-medium">
                                    {formatCurrency(recharge.amount)}
                                  </TableCell>
                                  <TableCell className="text-slate-300">
                                    <Badge
                                      variant="outline"
                                      className="border-slate-500 text-slate-300"
                                    >
                                      {recharge.method || "Transferencia"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={
                                        recharge.status === "COMPLETED"
                                          ? "bg-green-600"
                                          : recharge.status === "PENDING"
                                            ? "bg-yellow-600"
                                            : "bg-red-600"
                                      }
                                    >
                                      {recharge.status === "COMPLETED"
                                        ? "Completada"
                                        : recharge.status === "PENDING"
                                          ? "Pendiente"
                                          : "Cancelada"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </ScrollArea>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRechargeHistory(false);
                  setRechargeHistory([]);
                  setSelectedUserForRechargeHistory(null);
                }}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permission Manager */}
        {selectedUserForPermissions && (
          <PermissionManager
            user={selectedUserForPermissions}
            isOpen={showPermissionManager}
            onClose={() => {
              setShowPermissionManager(false);
              setSelectedUserForPermissions(null);
            }}
            onActionComplete={() => {
              fetchUsersData();
            }}
          />
        )}

        {/* Banner Configuration Modal */}
        <Dialog open={showBannerModal} onOpenChange={setShowBannerModal}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                Configurar Banner de Anuncio
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Personaliza el mensaje que aparecerá en el banner de la página
                principal
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="bannerText" className="text-slate-300 text-sm">
                  Texto del Banner
                </Label>
                <Textarea
                  id="bannerText"
                  placeholder="Escribe el mensaje que quieres mostrar en el banner..."
                  value={bannerData.text}
                  onChange={(e) =>
                    setBannerData((prev) => ({
                      ...prev,
                      text: e.target.value,
                    }))
                  }
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="bannerSpeed"
                    className="text-slate-300 text-sm"
                  >
                    Velocidad (segundos)
                  </Label>
                  <Input
                    id="bannerSpeed"
                    type="number"
                    min="5"
                    max="60"
                    value={bannerData.speed}
                    onChange={(e) =>
                      setBannerData((prev) => ({
                        ...prev,
                        speed: parseInt(e.target.value) || 20,
                      }))
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Estado</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Checkbox
                      id="bannerActive"
                      checked={bannerData.isActive}
                      onCheckedChange={(checked) =>
                        setBannerData((prev) => ({
                          ...prev,
                          isActive: checked as boolean,
                        }))
                      }
                    />
                    <Label
                      htmlFor="bannerActive"
                      className="text-slate-300 text-sm"
                    >
                      Banner activo
                    </Label>
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/40 rounded-lg border border-slate-600/50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="bannerTelegram"
                      className="text-slate-300 text-sm font-medium"
                    >
                      Enviar por Telegram
                    </Label>
                    <Checkbox
                      id="bannerTelegram"
                      checked={bannerData.sendToTelegram}
                      onCheckedChange={(checked) =>
                        setBannerData((prev) => ({
                          ...prev,
                          sendToTelegram: checked as boolean,
                        }))
                      }
                    />
                  </div>
                </div>

                {bannerData.sendToTelegram && (
                  <div className="flex gap-4 pl-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="telegramRoleUser"
                        checked={bannerData.targetRoles.includes("USER")}
                        onCheckedChange={(checked) => {
                          setBannerData((prev) => ({
                            ...prev,
                            targetRoles: checked
                              ? [...prev.targetRoles, "USER"]
                              : prev.targetRoles.filter((r) => r !== "USER"),
                          }));
                        }}
                      />
                      <Label
                        htmlFor="telegramRoleUser"
                        className="text-slate-300 text-sm"
                      >
                        Usuarios
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="telegramRoleVendor"
                        checked={bannerData.targetRoles.includes("VENDEDOR")}
                        onCheckedChange={(checked) => {
                          setBannerData((prev) => ({
                            ...prev,
                            targetRoles: checked
                              ? [...prev.targetRoles, "VENDEDOR"]
                              : prev.targetRoles.filter(
                                  (r) => r !== "VENDEDOR",
                                ),
                          }));
                        }}
                      />
                      <Label
                        htmlFor="telegramRoleVendor"
                        className="text-slate-300 text-sm"
                      >
                        Vendedores
                      </Label>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Se enviará a todos los usuarios verificados por Telegram con
                  los roles seleccionados
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Vista Previa</Label>
                <div
                  className="w-full overflow-hidden rounded-lg border border-slate-600"
                  style={{
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                  }}
                >
                  <div className="relative">
                    <div
                      className="whitespace-nowrap py-2 px-4 inline-block"
                      style={{
                        animation: `scroll ${bannerData.speed}s linear infinite`,
                      }}
                    >
                      <span className="inline-block px-4">
                        {bannerData.text || "Tu mensaje aparecerá aquí..."}
                      </span>
                      <span className="inline-block px-4">
                        {bannerData.text || "Tu mensaje aparecerá aquí..."}
                      </span>
                      <span className="inline-block px-4">
                        {bannerData.text || "Tu mensaje aparecerá aquí..."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-700 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowBannerModal(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                disabled={loadingBanner}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveBanner}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loadingBanner || !bannerData.text.trim()}
              >
                {loadingBanner ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Guardar Banner
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog
        open={showVendorPricingModal}
        onOpenChange={(open) => {
          setShowVendorPricingModal(open);

          // Si se está cerrando el modal, deshabilitar todos los inputs
          if (!open) {
            setEnabledVendorInputs(new Set());
          }
        }}
      >
        <AlertDialogContent
          showCloseButton
          className="
      w-[95vw] 
      max-w-md 
      sm:max-w-2xl 
      lg:max-w-4xl 
      xl:max-w-5xl
      mx-auto 
      max-h-[90vh] 
      overflow-y-auto 
      bg-slate-900 
      border-slate-700 
      shadow-2xl
      rounded-xl
    "
        >
          <AlertDialogHeader className="border-b border-slate-700 pb-4">
            <AlertDialogTitle className="flex items-center gap-3 text-white text-xl">
              <div className="p-2 bg-emerald-600 rounded-lg">
                <Percent className="w-6 h-6 text-white" />
              </div>
              Configurar Precios para Vendedores
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-base mt-2">
              Habilita y configura los precios especiales que verán los usuarios
              con rol VENDEDOR
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Barra de estadísticas */}
          <div
            className="
        grid 
        grid-cols-1 
        sm:grid-cols-2 
        lg:grid-cols-3 
        gap-4 
        py-4 
        border-b 
        border-slate-700
      "
          >
            <div className="bg-slate-800 rounded-lg p-4 text-center w-full">
              <p className="text-2xl font-bold text-emerald-400">
                {
                  Object.values(vendorPricing).filter((p) => p.vendorPrice > 0)
                    .length
                }
              </p>
              <p className="text-sm text-slate-400">Precios Configurados</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 text-center w-full">
              <p className="text-2xl font-bold text-blue-400">
                {accounts.length}
              </p>
              <p className="text-sm text-slate-400">Total de Cuentas</p>
            </div>
          </div>

          <div className="space-y-3 py-4">
            {accounts.map((account: any) => {
              const hasVendorPrice = vendorPricing[account.id]?.vendorPrice > 0;
              const isEnabled = enabledVendorInputs.has(account.id);
              const discountPercentage = hasVendorPrice
                ? Math.round(
                    (1 -
                      vendorPricing[account.id].vendorPrice / account.price) *
                      100,
                  )
                : 0;

              return (
                <div
                  key={account.id}
                  className="
              border border-slate-600 
              rounded-xl 
              bg-gradient-to-r 
              from-slate-800/50 
              to-slate-700/50 
              hover:from-slate-800/70 
              hover:to-slate-700/70 
              transition-all 
              duration-200 
              overflow-hidden
            "
                >
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      {/* Información */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-white">
                            {account.name}
                          </h3>
                          {hasVendorPrice && (
                            <Badge className="bg-emerald-600 text-white text-xs px-2 py-1">
                              Configurado
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">
                              Precio normal:
                            </span>
                            <span className="font-medium text-white">
                              ${account.price.toLocaleString("es-CO")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Tipo:</span>
                            <Badge
                              variant="outline"
                              className="border-slate-600 text-slate-300 text-xs"
                            >
                              {account.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Duración:</span>
                            <span className="text-slate-300">
                              {account.duration}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                          <span>{account.screens} pantallas</span>
                          <span>•</span>
                          <span>{account.quality}</span>
                        </div>
                      </div>

                      {/* Controles */}
                      <div className="flex flex-col sm:flex-row items-center lg:items-end gap-4">
                        <Button
                          variant={isEnabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setEnabledVendorInputs((prev) => {
                              const newSet = new Set(prev);
                              if (newSet.has(account.id)) {
                                newSet.delete(account.id);
                              } else {
                                newSet.add(account.id);
                              }
                              return newSet;
                            });
                          }}
                          className={`
                      ${
                        isEnabled
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                          : "border-slate-600 text-slate-300 hover:bg-slate-700"
                      }
                      transition-colors duration-200 w-full sm:w-auto
                    `}
                        >
                          {isEnabled ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Habilitado
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4 mr-2" />
                              Habilitar
                            </>
                          )}
                        </Button>

                        {/* Precio */}
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <Label className="text-xs text-slate-400 mb-1 whitespace-nowrap">
                              Precio Vendedor
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="100"
                              placeholder="0"
                              disabled={!isEnabled}
                              className={`
                          w-32 h-10 text-center font-medium
                          ${
                            isEnabled
                              ? "bg-slate-700 border-emerald-600 text-white focus:border-emerald-500"
                              : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                          }
                          transition-colors duration-200
                        `}
                              value={
                                vendorPricing[account.id]?.vendorPrice || ""
                              }
                              onChange={(e) =>
                                setVendorPricing((prev) => ({
                                  ...prev,
                                  [account.id]: {
                                    vendorPrice:
                                      parseFloat(e.target.value) || 0,
                                    discountPercentage: 0,
                                  },
                                }))
                              }
                            />
                          </div>

                          {hasVendorPrice && (
                            <div className="flex flex-col items-center">
                              <span className="text-xs text-slate-400 mb-1">
                                Descuento
                              </span>
                              <Badge
                                variant="secondary"
                                className={`
                            text-sm font-bold px-3 py-1
                            ${
                              discountPercentage >= 30
                                ? "bg-red-600 text-white"
                                : discountPercentage >= 15
                                  ? "bg-orange-600 text-white"
                                  : "bg-blue-600 text-white"
                            }
                          `}
                              >
                                -{discountPercentage}%
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <AlertDialogFooter className="border-t border-slate-700 pt-4">
            <AlertDialogCancel asChild>
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={saveVendorPricing}
                disabled={loadingVendorPricing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-200"
              >
                {loadingVendorPricing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Precios
                  </>
                )}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
