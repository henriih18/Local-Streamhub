"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  User,
  Menu,
  X,
  MessageSquare,
  ShoppingCart,
  LogOut,
  ShieldCheck,
  Fingerprint,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast-custom";

// Componente personalizado para botón de login
function LoginButton({ onLogin }: { onLogin: () => void }) {
  return (
    <button
      onClick={onLogin}
      className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 hover:border-emerald-400/50 text-emerald-300 hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/25"
    >
      <div className="relative">
        <Fingerprint className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
        <div className="absolute inset-0 animate-ping opacity-0 hover:opacity-100">
          <Fingerprint className="w-5 h-5 text-emerald-400" />
        </div>
      </div>
    </button>
  );
}

// Componente personalizado para botón de logout
function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      onClick={onLogout}
      className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-red-500/20 to-orange-600/20 border border-red-500/30 hover:border-red-400/50 text-red-300 hover:text-red-200 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25"
    >
      <div className="relative">
        <LogOut className="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-200" />
      </div>
    </button>
  );
}

interface NavigationProps {
  user: any;
  cartItemsCount: number;
  onCartOpen: () => void;
  onLogin: () => void;
  onLogout: () => void;
  showCart?: boolean;
}

export default function Navigation({
  user,
  cartItemsCount,
  onCartOpen,
  onLogin,
  onLogout,
  showCart = true,
}: NavigationProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN";
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [loginNotified, setLoginNotified] = useState(false);

  // Ref para mantener la referencia actualizada de onLogout
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  // Monitorear expiración del token en tiempo real
  useEffect(() => {
    if (!user) return;

    const tokenExpiresAt = localStorage.getItem("tokenExpiresAt");
    if (!tokenExpiresAt) return;

    const expiresMs = new Date(tokenExpiresAt).getTime();
    const remainingMs = expiresMs - Date.now();

    // Si ya expiró (usuario cerró pestaña y volvió después)
    if (remainingMs <= 0) {
      toast.warning(
        "Tu sesión ha expirado. Por favor inicia sesión nuevamente.",
      );
      onLogoutRef.current();
      return;
    }

    // Programar logout exacto cuando expire el token
    const timer = setTimeout(() => {
      toast.warning("Tu sesión ha expirado automáticamente.");
      onLogoutRef.current();
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [user]);

  // Verificar estado de administrador
  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [user]);

  // Resetear loginNotified cuando cambia el usuario
  useEffect(() => {
    if (user) {
      setLoginNotified(false);
    }
  }, [user]);

  // Escuche las actualizaciones de mensajes
  useEffect(() => {
    const handleMessageUpdate = () => {
      if (user) {
        fetchMessages();
      }
    };

    // Listen for custom message update event
    window.addEventListener("messagesUpdated", handleMessageUpdate);

    return () => {
      window.removeEventListener("messagesUpdated", handleMessageUpdate);
    };
  }, [user]);

  const fetchMessages = async () => {
    try {
      if (!user) return;

      //const token = localStorage.getItem("authToken");
      const response = await fetch("/api/messages", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const newUnreadCount = data.unreadCount || 0;

        // Actualice solo si el recuento cambió para evitar re-renderizaciones innecesarias
        if (newUnreadCount !== unreadCount) {
          setUnreadCount(newUnreadCount);
          if (!loginNotified && newUnreadCount > 0) {
            const messageText =
              newUnreadCount === 1
                ? "Tienes 1 mensaje de administración sin leer"
                : `Tienes ${newUnreadCount} mensajes administración sin leer`;

            toast.info(messageText);
            setLoginNotified(true); // Marcar como notificado
          }
        }
      }
    } catch (error) {
      //console.error('Navegación: Error al obtener mensajes:', error)
    }
  };

  const navigationItems = [
    {
      name: "Inicio",
      href: "/",
      icon: Home,
    },
  ];

  if (user) {
    navigationItems.push({
      name: "Mi Cuenta",
      href: "/account",
      icon: User,
    });

    navigationItems.push({
      name: "Mensajes",
      href: "/messages",
      icon: MessageSquare,
    });

    if (isAdmin) {
      navigationItems.push({
        name: "Admin",
        href: "/admin",
        icon: ShieldCheck,
      });
    }
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  function truncateUsername(name) {
    if (!name) return "";
    return name.length > 7 ? name.slice(0, 7) + "..." : name;
  }

  return (
    <nav className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50 shadow-lg shadow-slate-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-11 h-11 relative transform transition-all duration-400 group-hover:scale-110 group-hover:-translate-y-1">
                  {/* Forma orgánica tipo gota/hoja */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 rounded-3xl rotate-45 transform transition-all duration-500 group-hover:rotate-12 shadow-lg shadow-emerald-500/20">
                    {/* Patrón interno */}
                    <div className="absolute inset-1 bg-gradient-to-tr from-emerald-400/20 via-transparent to-cyan-400/20 rounded-2xl -rotate-45"></div>
                  </div>

                  {/* Símbolo central - onda de streaming */}
                  <div className="absolute inset-0 flex items-center justify-center -rotate-45">
                    <div className="flex items-center space-x-0.5">
                      <div className="w-1 h-3 bg-white/90 rounded-full"></div>
                      <div className="w-1 h-5 bg-white rounded-full shadow-sm"></div>
                      <div className="w-1 h-4 bg-white/80 rounded-full"></div>
                    </div>
                  </div>

                  {/* Brillo superior */}
                  <div className="absolute top-1 right-2 w-2 h-2 bg-emerald-300 rounded-full opacity-60 blur-sm"></div>

                  {/* Efecto de aura */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-3xl rotate-45 animate-pulse-slow"></div>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
                  Riyo
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-300 tracking-wide">
                    Stream
                  </span>

                  {user && (
                    <>
                      {/* Pantallas grandes: nombre completo */}
                      <span className="hidden md:inline text-lg font-medium text-emerald-400">
                        | {user.username || user.email}
                      </span>

                      {/* Pantallas pequeñas: nombre truncado */}
                      <span className="md:hidden text-lg font-medium text-emerald-400">
                        | {truncateUsername(user.username || user.email)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            {/* Navegación Principal */}
            <div className="flex items-center bg-slate-800/50 rounded-full px-2 py-1 border border-slate-700/50">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      isActive(item.href)
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                    }`}
                  >
                    <div className="relative">
                      <Icon className="w-4 h-4" />
                      {item.name === "Mensajes" && unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full p-0 flex items-center justify-center">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                      )}
                    </div>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Espaciador */}
            <div className="w-4"></div>

            {/* Acciones */}
            <div className="flex items-center space-x-2">
              {user && (
                <button
                  onClick={showCart ? onCartOpen : undefined}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-600/20 border border-purple-500/30 hover:border-purple-400/50 text-purple-300 hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 ${
                    !showCart && "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  {cartItemsCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full p-0 flex items-center justify-center">
                      {cartItemsCount > 9 ? "9+" : cartItemsCount}
                    </Badge>
                  )}
                </button>
              )}

              {/* Espacio extra entre carrito y logout */}
              {user && <div className="w-3"></div>}

              {/* Login/Logout */}
              {/* {user ? <LogoutButton /> : <LoginButton />} */}
              {user ? (
                <LogoutButton onLogout={() => setShowLogoutDialog(true)} />
              ) : (
                <LoginButton onLogin={onLogin} />
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            {user && (
              <button
                onClick={showCart ? onCartOpen : undefined}
                className={`relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-600/20 border border-purple-500/30 text-purple-300 ${
                  !showCart && "opacity-50 cursor-not-allowed"
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartItemsCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full p-0 flex items-center justify-center">
                    {cartItemsCount > 9 ? "9+" : cartItemsCount}
                  </Badge>
                )}
              </button>
            )}

            {/* Espacio extra entre carrito y menú móvil */}
            {user && <div className="w-2"></div>}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700/50">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                      isActive(item.href)
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <div className="relative">
                      <Icon className="w-5 h-5" />
                      {item.name === "Mensajes" && unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full p-0 flex items-center justify-center">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                      )}
                    </div>
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* Separador */}
              <div className="border-t border-slate-700/50 my-2"></div>

              {/* Login/Logout móvil */}
              {user ? (
                <button
                  onClick={() => {
                    setShowLogoutDialog(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium text-red-400 hover:text-red-300 hover:bg-slate-800 transition-all duration-200 w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Cerrar Sesión</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onLogin();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-all duration-200 w-full"
                >
                  <Fingerprint className="w-5 h-5" />
                  <span>Iniciar Sesión</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="¿Cerrar Sesión?"
        description="¿Estás seguro de que quieres cerrar tu sesión? Tendrás que iniciar sesión nuevamente para acceder a tu cuenta."
        confirmText="Cerrar Sesión"
        cancelText="Cancelar"
        onConfirm={onLogout}
        variant="destructive"
      />
    </nav>
  );
}
