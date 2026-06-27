"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/navigation";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { StreamingCard } from "@/components/streaming-card";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast-custom";
import { useRealTimeUpdates } from "@/hooks/useRealTimeUpdates";
import { Search, Loader2 } from "lucide-react";
import { sanitizeInput } from "@/lib/sanitize";
import dynamic from "next/dynamic";
const CartSidebar = dynamic(
  () =>
    import("@/components/cart-sidebar").then((m) => ({
      default: m.CartSidebar,
    })),
  { ssr: false },
);
const SupportBubble = dynamic(
  () =>
    import("@/components/support-bubble").then((m) => ({
      default: m.SupportBubble,
    })),
  { ssr: false },
);
const TrendingCarousel = dynamic(
  () =>
    import("@/components/trending-carousel").then((m) => ({
      default: m.TrendingCarousel,
    })),
  { ssr: false },
);

interface StreamingAccount {
  id: string;
  name: string;
  description: string;
  price: number;
  type: string;
  duration: string;
  quality: string;
  screens: number;
  image?: string;
  saleType: "FULL" | "PROFILES";
  maxProfiles?: number;
  pricePerProfile?: number;
  streamingType?: {
    icon?: string;
    color?: string;
  };
  accountStocks?: Array<{
    id: string;
    isAvailable: boolean;
  }>;
  profileStocks?: Array<{
    id: string;
    isAvailable: boolean;
  }>;

  exclusiveStocks?: Array<{
    id: string;
    isAvailable: boolean;
  }>;
  specialOffer?: any;
  originalPrice?: number;
}

interface CartItem {
  id: string;
  streamingAccount?: StreamingAccount;

  exclusiveAccount?: any;
  quantity: number;
  saleType: "FULL" | "PROFILES";
  priceAtTime: number;

  availableStock?: number;
}

export default function Home() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [streamingAccounts, setStreamingAccounts] = useState<
    StreamingAccount[]
  >([]);
  const [user, setUser] = useState<any>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const itemsPerPage = 9;
  const blockHandledRef = useRef(false);

  // Actualizaciones de mensajes en tiempo real

  useRealTimeUpdates({
    userId: user?.id,
    onMessageUpdate: (_messageData) => {
      window.dispatchEvent(new CustomEvent("messagesUpdated"));
    },

    onStockUpdate: (stockData) => {
      setStreamingAccounts((prev) => {
        let hasChanges = false;

        const updatedAccounts = prev.map((account) => {
          if (account.id === stockData.accountId) {
            //Actualizar arrays basados en newStock del WebSocket
            let newAccountStocks = account.accountStocks || [];
            let newProfileStocks = account.profileStocks || [];
            let newExclusiveStocks = account.exclusiveStocks || [];

            // Si se agregaron nuevos stocks, agregarlos al array
            if (stockData.newStocks && stockData.newStocks.length > 0) {
              if (stockData.type === "PROFILES") {
                newProfileStocks = [
                  ...(account.profileStocks || []),
                  ...stockData.newStocks,
                ];
              } else {
                newAccountStocks = [
                  ...(account.accountStocks || []),
                  ...stockData.newStocks,
                ];
              }
              hasChanges = true;
            } else {
              // Si no hay nuevos stocks, actualizar el estado existente
              if (stockData.accountType === "exclusive") {
                // Para cuentas exclusivas
                const oldExclusive = JSON.stringify(account.exclusiveStocks);
                newExclusiveStocks =
                  account.exclusiveStocks?.map((stock, index) =>
                    index < stockData.newStock
                      ? { ...stock, isAvailable: true }
                      : { ...stock, isAvailable: false },
                  ) || [];
                const newExclusive = JSON.stringify(newExclusiveStocks);
                if (oldExclusive !== newExclusive) {
                  hasChanges = true;
                }
              } else if (stockData.type === "PROFILES") {
                // Para perfiles
                const oldProfiles = JSON.stringify(account.profileStocks);
                newProfileStocks =
                  account.profileStocks?.map((stock, index) =>
                    index < stockData.newStock
                      ? { ...stock, isAvailable: true }
                      : { ...stock, isAvailable: false },
                  ) || [];
                const newProfiles = JSON.stringify(newProfileStocks);
                if (oldProfiles !== newProfiles) {
                  hasChanges = true;
                }
              } else {
                // Para cuentas completas
                const oldStocks = JSON.stringify(account.accountStocks);
                newAccountStocks =
                  account.accountStocks?.map((stock, index) =>
                    index < stockData.newStock
                      ? { ...stock, isAvailable: true }
                      : { ...stock, isAvailable: false },
                  ) || [];
                const newStocks = JSON.stringify(newAccountStocks);
                if (oldStocks !== newStocks) {
                  hasChanges = true;
                }
              }
            }

            // Solo devolver nueva cuenta si hubo cambios
            if (hasChanges) {
              return {
                ...account,
                accountStocks: newAccountStocks,
                profileStocks: newProfileStocks,
                exclusiveStocks: newExclusiveStocks,
              };
            }
          }
          return account;
        });

        //Solo forzar nuevo array si hubo cambios en alguna cuenta
        return hasChanges ? [...updatedAccounts] : prev;
      });
      setCartItems((prev) =>
        prev.map((item) => {
          if (item.streamingAccount?.id === stockData.accountId) {
            if (item.saleType === stockData.type) {
              return {
                ...item,
                availableStock: stockData.newStock,
              };
            }
          }
          // Manejar cuentas exclusivas
          else if (item.exclusiveAccount?.id === stockData.accountId) {
            if (item.saleType === stockData.type) {
              return { ...item, availableStock: stockData.newStock };
            }
          }
          return item;
        }),
      );
    },
    //Manejar bloqueo de usuario

    onUserBlocked: (blockData) => {
      // Evitar múltiples ejecuciones
      if (blockHandledRef.current) {
        return;
      }

      // Marcar como manejado inmediatamente
      blockHandledRef.current = true;

      // Mostrar notificación (solo una vez)
      toast.error(
        sanitizeInput(blockData.message || "Tu cuenta ha sido bloqueada"),
      );

      // Limpiar localStorage
      localStorage.removeItem("user");
      localStorage.removeItem("authToken");

      fetch("/api/auth", { method: "POST" }).then(() => {
        router.push("/login");
      });
    },

    onCreditsUpdated: (creditsData) => {
      setUserCredits(creditsData.newCredits);

      // Actualizar también localStorage para mantener sincronización
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          parsedUser.credits = creditsData.newCredits;
          localStorage.setItem("user", JSON.stringify(parsedUser));
        } catch (error) {
          // Error al parsear, ignorar
        }
      }

      // Mostrar notificación de actualización
      toast.success("Tus créditos han sido actualizados");
    },
  });

  useEffect(() => {
    blockHandledRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.id) {
          setUser(parsedUser);
        }
      } catch (error) {
        localStorage.removeItem("user");
      }
    }

    setIsLoading(false);
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
        setUser(customEvent.detail);
        localStorage.setItem("user", JSON.stringify(customEvent.detail));
      }
    };

    window.addEventListener("userLoggedIn", handleUserLogin);

    return () => {
      window.removeEventListener("userLoggedIn", handleUserLogin);
    };
  }, []);

  const fetchAccounts = async (
    page: number = currentPage,
    search: string = searchQuery,
  ) => {
    setIsLoading(true);

    try {
      const userId = user?.id || null;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      });

      if (userId) {
        params.append("userId", userId);
      }

      if (search.trim()) {
        params.append("search", search);
      }

      const response = await fetch(
        `/api/streaming-accounts?${params.toString()}`,
        {
          credentials: "include",
        },
      );

      if (response.ok) {
        const data = await response.json();

        // Actualizar totalPages desde el backend
        setTotalPages(data.pagination?.totalPages || 1);

        // Iniciar con todas las cuentas (ya vienen con precios ajustados por rol)
        let allAccounts = [
          ...(data.exclusiveAccounts || []),
          ...(data.regularAccounts || []),
        ];

        // Aplicar ofertas especiales
        if (data.specialOffers) {
          data.specialOffers.forEach((offer: any) => {
            if (offer.streamingAccount) {
              const existingAccountIndex = allAccounts.findIndex(
                (account) => account.id === offer.streamingAccount.id,
              );

              if (existingAccountIndex !== -1) {
                // Actualizar cuenta existente con oferta especial
                allAccounts[existingAccountIndex] = {
                  ...allAccounts[existingAccountIndex],
                  specialOffer: offer,
                  originalPrice:
                    offer.streamingAccount.originalPrice ||
                    allAccounts[existingAccountIndex].price,
                  price: offer.discountPercentage
                    ? offer.streamingAccount.price *
                      (1 - offer.discountPercentage / 100)
                    : offer.specialPrice || offer.streamingAccount.price,
                };
              }
            }
          });
        }

        // Ordenar las cuentas: primero las cuentas exclusivas, luego las cuentas regulares
        allAccounts = allAccounts.sort((a: any, b: any) => {
          const aIsExclusive =
            !a.streamingType && !a.accountStocks && !a.profileStocks;
          const bIsExclusive =
            !b.streamingType && !b.accountStocks && !b.profileStocks;

          if (aIsExclusive && !bIsExclusive) return -1;
          if (!aIsExclusive && bIsExclusive) return 1;

          return 0;
        });

        setStreamingAccounts(allAccounts);
      }
    } catch (error) {
      setStreamingAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAccounts(currentPage, searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [user?.id, currentPage, searchQuery]);

  // Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchQuery]);

  // Combinar los fetches de carrito y créditos cuando hay usuario
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Ejecutar en paralelo con Promise.all
        const [cartData, creditsData] = await Promise.allSettled([
          fetchCartItems(),
          fetchUserCredits(),
        ]);

        /* // Manejar errores individualmente
        if (cartData.status === "rejected") {
          console.error("Error fetching cart:", cartData.reason);
        }
        if (creditsData.status === "rejected") {
          console.error("Error fetching credits:", creditsData.reason);
        } */
      } catch (error) {
        //console.error("Error in combined fetch:", error);
      }
    };

    fetchData();
  }, [user]);

  const fetchUserCredits = async () => {
    try {
      const response = await fetch(`/api/user/credits`, {
        credentials: "include",
      });
      //console.log("fetchUserCredits status:", response.status);
      if (response.ok) {
        const data = await response.json();
        //console.log("fetchUserCredits data:", data, "→ setUserCredits:", data.credits);
        setUserCredits(data.credits || 0);
      } else {
        //console.log("fetchUserCredits NO OK:", response.status);
      }
    } catch (error) {
      //console.log("fetchUserCredits ERROR:", error);
    }
  };

  const fetchCartItems = async () => {
    try {
      const response = await fetch(`/api/cart`, {
        credentials: "include",
      });
      if (response.ok) {
        const cartData = await response.json();
        const formattedItems = cartData.items.map((item: any) => {
          // Calcular el stock disponible para este artículo
          let availableStock = 99;

          if (item.streamingAccount) {
            if (item.saleType === "PROFILES") {
              availableStock =
                item.streamingAccount.profileStocks?.filter(
                  (stock: any) => stock.isAvailable,
                ).length || 0;
            } else {
              availableStock =
                item.streamingAccount.accountStocks?.filter(
                  (stock: any) => stock.isAvailable,
                ).length || 0;
            }
          } else if (item.exclusiveAccount) {
            // Para cuentas exclusivas, utilice exclusiveStocks
            availableStock =
              item.exclusiveAccount.exclusiveStocks?.filter(
                (stock: any) => stock.isAvailable,
              ).length || 0;
          }

          return {
            ...item,
            availableStock,
          };
        });
        setCartItems(formattedItems);
      }
    } catch (error) {
      //console.error('Error al obtener los artículos del carrito:', error)
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    // Encuentre el elemento del carrito para obtener información de la cuenta
    const cartItem = cartItems.find((item) => item.id === itemId);
    if (!cartItem) {
      return;
    }

    // Consultar disponibilidad de stock
    if (
      cartItem.availableStock !== undefined &&
      cartItem.availableStock < quantity
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity }),
      });

      if (response.ok) {
        await fetchCartItems();
        toast.success("Cantidad actualizada");
      }
    } catch (error) {
      //console.error('Error al actualizar la cantidad:', error)
      toast.error("Error al actulaizar la cantidad");
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        await fetchCartItems();
        toast.warning("Artículo eliminado del carrito");
      }
    } catch (error) {
      //console.error('Error al eliminar artículo del carrito:', error)
      toast.error("Error al eliminar artículo del carrito");
    }
  };

  const handleCheckout = () => {
    // El carrito será vaciado mediante el procesamiento del pago.
    setCartItems([]);
  };

  const handlePaymentSuccess = (newCredits: number) => {
    setUserCredits(newCredits);
    toast.success(
      '¡Pago procesado con éxito! Revisa tus pedidos en el panel "Mi Cuenta"',
    );
    //actualiza las cuentas despues de checkout
    fetchAccounts(currentPage, searchQuery);
  };

  // Paginacion
  const currentAccounts = streamingAccounts;

  const addToCart = async (account: StreamingAccount, quantity: number = 1) => {
    if (!user) {
      toast.error("Por favor inicia sesión para agregar productos al carrito");
      //router.push("/login");
      return;
    }

    try {
      const isExclusiveAccount = (account as any).accountType === "exclusive";

      const displayPrice =
        account.saleType === "PROFILES"
          ? account.pricePerProfile || account.price
          : account.price;

      let response;
      if (isExclusiveAccount) {
        response = await fetch("/api/exclusive-cart", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exclusiveAccountId: account.id,
            quantity: quantity,
            priceAtTime: displayPrice,
          }),
        });
      } else {
        response = await fetch("/api/cart", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            streamingAccountId: account.id,
            quantity: quantity,
            saleType: account.saleType,
            priceAtTime: displayPrice,
          }),
        });
      }

      if (response.ok) {
        // Actualizar artículos del carrito
        await fetchCartItems();

        const accountType =
          account.saleType === "PROFILES" ? "Perfil" : "Cuenta Completa";
        //const quantityText = quantity > 1 ? `${quantity} unidades` : "1 unidad";

        toast.success(
          `${accountType} "${
            account.name
          }" agregado al carrito • $${account.price.toLocaleString()}`,
        );
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Error al agregar al carrito");
      }
    } catch (error) {
      //console.error('Error adding to cart:', error)
      toast.error("Error de conexión. Intenta nuevamente.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}

    setUser(null);
    setUserCredits(0);
    setCartItems([]);
    localStorage.removeItem("user");
    localStorage.removeItem("tokenExpiresAt");

    window.dispatchEvent(new CustomEvent("userLogout"));

    fetchAccounts(1, "");

    toast.success("Sesión cerrada correctamente");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950">
      <Navigation
        user={user}
        cartItemsCount={(cartItems || []).length}
        onCartOpen={() => setIsCartOpen(true)}
        onLogin={() => {
          router.push("/login");
        }}
        onLogout={handleLogout}
        showCart={true}
      />

      <AnnouncementBanner />

      <main>
        {/*  Estilo de panel */}
        <section
          className="relative flex items-center justify-center overflow-hidden"
          style={{ minHeight: "70vh" }}
        >
          {/* Degradado de fondo */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-transparent to-teal-900/30"></div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
            <div className="text-center">
              {/* Insignia de estado */}
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 mb-6">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-300 text-sm font-medium">
                  RiyoStream Activo
                </span>
              </div>

              {/* Título principal */}
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
                RiyoStream
                <span className="block text-emerald-400">
                  Todo el Entretenimiento que Buscas
                </span>
              </h1>

              {/* Subtitulo */}
              <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
                Las mejores cuentas de streaming al mejor precio
              </p>
            </div>
          </div>
        </section>

        {/* Tendencias de la Semana */}
        <TrendingCarousel />

        {/* Sección de Cuentas  */}
        <section
          id="accounts"
          className="py-20 bg-gradient-to-b from-transparent to-slate-900"
        >
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
                📋 Catálogo de Cuentas
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Cuentas Disponibles
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto mb-8">
                Selecciona la cuenta que prefieras y disfruta del mejor
                contenido
              </p>

              {/* Barra de búsqueda */}
              <div className="max-w-md mx-auto mb-8">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Buscar cuentas de streaming..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>

                {isLoading && (
                  <div className="mt-3 flex items-center justify-center gap-2 ">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                    <span className="text-lg text-emerald-400">
                      Cargando catálogo...
                    </span>
                  </div>
                )}

                {searchQuery && (
                  <div className="mt-2 text-center">
                    <span className="text-sm text-slate-400">
                      Mostrando {streamingAccounts.length}{" "}
                      {streamingAccounts.length === 1 ? "cuenta" : "cuentas"}
                      {totalPages > 1 &&
                        ` (página ${currentPage} de ${totalPages})`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentAccounts.map((account) => (
                <StreamingCard
                  key={account.id}
                  account={account}
                  onAddToCart={addToCart}
                  isMostPopular={["1", "2", "3"].includes(account.id)}
                  userRole={user?.role}
                />
              ))}
            </div>

            {/* Paginacion */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}

            {streamingAccounts.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {searchQuery
                      ? "No se encontraron cuentas"
                      : "No hay cuentas disponibles"}
                  </h3>
                  <p className="text-slate-400">
                    {searchQuery
                      ? "Intenta con otros términos de búsqueda."
                      : "No hay cuentas disponibles en este momento."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Pie de página - Estilo del panel */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-center">
              <h3 className="text-white font-semibold mb-4">RiyoStream</h3>
              <p className="text-slate-400 text-sm">
                Tu plataforma de confianza para cuentas de streaming premium
              </p>
            </div>

            <div className="text-center">
              <h4 className="text-white font-medium mb-3">Soporte</h4>
              <p className="text-slate-400 text-sm mb-2">
                ¿Necesitas contactarnos?
              </p>
              <p className="text-slate-400 text-sm">
                Encuentra nuestros números de contacto en la burbuja de contacto
                o en el panel{" "}
                <span className="text-white font-medium">"Mi Cuenta"</span>
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-slate-400 text-sm mb-4 md:mb-0">
                © 2025 RiyoStream. Todos los derechos reservados.
              </p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-400 text-sm font-medium">
                  Sistema Online
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onCheckout={handleCheckout}
        userCredits={userCredits}
        userId={user?.id}
        onPaymentSuccess={handlePaymentSuccess}
      />
      <SupportBubble />
    </div>
  );
}
