import {
  X,
  Trash2,
  ShoppingBag,
  Wallet,
  Loader2,
  CheckCircle,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { useState } from "react";
import { toast } from "@/components/ui/toast-custom";

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
}

interface CartItem {
  id: string;
  streamingAccount?: StreamingAccount;
  exclusiveAccount?: {
    id: string;
    name: string;
    description: string;
    price: number;
    saleType: "FULL" | "PROFILES";
    exclusiveStocks?: Array<{
      id: string;
      isAvailable: boolean;
    }>;
  };
  quantity: number;
  saleType: "FULL" | "PROFILES";
  priceAtTime: number;
  availableStock?: number;
}

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  userCredits?: number;
  userId?: string;
  onPaymentSuccess?: (newCredits: number) => void;
}

export function CartSidebar({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  userCredits = 0,
  userId,
  onPaymentSuccess,
}: CartSidebarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const total = (items || []).reduce(
    (sum, item) => sum + item.priceAtTime * item.quantity,
    0,
  );

  const handleCheckout = async () => {
    if (!userId) {
      return;
    }

    setIsProcessing(true);

    try {
      //const token = localStorage.getItem("authToken");
      const response = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al procesar el pago");
        return;
      }

      setPaymentSuccess(true);
      onPaymentSuccess?.(data.newCredits);

      // Limpiar el carrito despues del pago
      setTimeout(() => {
        onCheckout();
        setPaymentSuccess(false);
      }, 1000);
    } catch (error) {
      //console.error('Error al procesar el pago:', error)
      toast.error("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed top-0 right-0 h-full w-full md:w-96 bg-gray-900 border-l border-gray-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="h-6 w-6 text-purple-400" />
              <h2 className="text-xl font-semibold text-white">Tu Carrito</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-red-500/15 backdrop-blur-md border border-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
              aria-label="Cerrar carrito"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Cart Items */}
          {/* <ScrollArea className="flex-1 p-6"> */}
          <ScrollArea className="flex-1 max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-320px)] p-6 overflow-hidden">
            {(items || []).length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Tu carrito está vacío</p>
                <p className="text-sm text-gray-500 mt-2">
                  Agrega algunas cuentas de streaming para comenzar
                </p>

                {/* Show credits even when cart is empty */}
                <div className="mt-8 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg p-4 border border-green-700/30">
                  <div className="flex items-center justify-center space-x-3">
                    <Wallet className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="text-sm text-green-400 font-medium">
                        Tus Créditos Disponibles
                      </p>
                      <p className="text-xl font-bold text-green-300">
                        $
                        {userCredits.toLocaleString("es-CO", {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        {item.streamingAccount ? (
                          <>
                            <h4 className="font-semibold text-white">
                              {item.streamingAccount.name}
                            </h4>
                            <p className="text-sm text-gray-400">
                              {item.streamingAccount.type} •{" "}
                              {item.streamingAccount.duration}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded border border-purple-600/30">
                                {item.saleType === "PROFILES"
                                  ? "Perfil"
                                  : "Cuenta completa"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {item.streamingAccount.quality}
                              </span>
                            </div>
                          </>
                        ) : item.exclusiveAccount ? (
                          <>
                            <h4 className="font-semibold text-white">
                              {item.exclusiveAccount.name}
                            </h4>
                            <p className="text-sm text-gray-400">
                              {item.exclusiveAccount.description}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs bg-amber-600/20 text-amber-400 px-2 py-1 rounded border border-amber-600/30">
                                Cuenta Exclusiva
                              </span>
                              <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded border border-purple-600/30">
                                {item.saleType === "PROFILES"
                                  ? "Perfil"
                                  : "Cuenta completa"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <h4 className="font-semibold text-white">
                              Producto no disponible
                            </h4>
                            <p className="text-sm text-gray-400">
                              Este producto ha sido eliminado
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded border border-red-600/30">
                                No disponible
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(item.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-white">
                        <QuantitySelector
                          value={item.quantity}
                          onChange={(value) => onUpdateQuantity(item.id, value)}
                          min={1}
                          max={item.availableStock || 99}
                          size="sm"
                        />
                        {item.availableStock !== undefined &&
                          item.availableStock <= 5 && (
                            <div className="text-xs text-orange-400">
                              {item.availableStock === 0
                                ? "Sin stock"
                                : `Solo ${item.availableStock} disponible${
                                    item.availableStock !== 1 ? "s" : ""
                                  }`}
                            </div>
                          )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-purple-400">
                          $
                          {(item.priceAtTime * item.quantity).toLocaleString(
                            "es-CO",
                            { maximumFractionDigits: 0 },
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {(items || []).length > 0 && (
            <div className="border-t border-gray-800 p-6 space-y-4">
              {/* User Credits */}
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg p-4 border border-green-700/30">
                <div className="flex items-center space-x-3">
                  <Wallet className="h-5 w-5 text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm text-green-400 font-medium">
                      Tus Créditos Disponibles
                    </p>
                    <p className="text-xl font-bold text-green-300">
                      $
                      {userCredits.toLocaleString("es-CO", {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                  {userCredits < total && (
                    <div className="text-right">
                      <p className="text-xs font-bold text-red-400">
                        Créditos Insuficientes
                      </p>
                      <p className="text-xs font-semibold text-gray-200">
                        Necesitas $
                        {(total - userCredits).toLocaleString("es-CO", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        más
                      </p>
                      <p className="text-xs text-gray-400">
                        Contacta con soporte para recargar tus créditos
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-semibold text-lg">
                  <span className="text-white">Total</span>
                  <span className="text-purple-400">
                    $
                    {total.toLocaleString("es-CO", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 rounded-xl"
                size="lg"
                disabled={userCredits < total || isProcessing || paymentSuccess}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando Pago...
                  </>
                ) : paymentSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ¡Pago Exitoso!
                  </>
                ) : userCredits < total ? (
                  "Créditos Insuficientes"
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Proceder al Pago
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={onClose}
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Seguir Comprando
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
