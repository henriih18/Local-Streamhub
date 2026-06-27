"use client";
import { Percent } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Star,
  Monitor,
  Calendar,
  Play,
  Check,
  Zap,
  Shield,
  Users,
  Crown,
  Gift,
  TrendingUp,
} from "lucide-react";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { sanitizeCssValue } from "@/lib/sanitize";

interface StreamingAccount {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  type: string;
  duration: string;
  quality: string;
  screens: number;
  image?: string;
  saleType: "FULL" | "PROFILES";
  maxProfiles?: number;
  pricePerProfile?: number;
  specialOffer?: {
    discountPercentage: number;
    targetSpent: number;
    expiresAt?: string;
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
  streamingType?: {
    icon?: string;
    color?: string;
    imageUrl?: string;
  };
}

interface StreamingCardProps {
  account: StreamingAccount;

  onAddToCart: (account: StreamingAccount, quantity: number) => void;
  isMostPopular?: boolean;

  userRole?: string;
}

export function StreamingCard({
  account,
  onAddToCart,
  isMostPopular = false,
  userRole,
}: StreamingCardProps) {
  const [quantity, setQuantity] = useState(1);

  const displayPrice =
    account.saleType === "PROFILES"
      ? account.pricePerProfile || account.price
      : account.price;

  const availableStock =
    account.saleType === "PROFILES"
      ? account.profileStocks?.filter((profile) => profile.isAvailable)
          .length || 0
      : account.accountStocks?.filter((stock) => stock.isAvailable).length || 0;

  const exclusiveStock =
    account.exclusiveStocks?.filter((stock) => stock.isAvailable).length || 0;
  const isExclusiveAccount =
    !account.streamingType && !account.accountStocks && !account.profileStocks;
  const isSpecialOffer = !!account.specialOffer;
  const isVendor = userRole === "VENDEDOR";

  // Calcular la cantidad máxima según el tipo de cuenta
  const maxQuantity = isExclusiveAccount ? exclusiveStock : availableStock;

  const getGradientColor = (type: string, customColor?: string) => {
    // Si hay un color personalizado, crear un gradiente con ese color
    if (customColor) {
      // Para colores hexadecimales, crear un gradiente usando el color directamente
      if (customColor.startsWith("#")) {
        return sanitizeCssValue(customColor);
      }
      // Si es una clase de Tailwind, usarla directamente
      return customColor;
    }

    // Si no hay color personalizado, usar los gradientes predefinidos
    const gradients: { [key: string]: string } = {
      Netflix: "from-red-600 to-red-800",
      "Disney+": "from-blue-600 to-blue-800",
      "HBO Max": "from-purple-600 to-purple-800",
      "Amazon Prime": "from-orange-600 to-orange-800",
      Hulu: "from-green-600 to-green-800",
      "Apple TV+": "from-gray-700 to-gray-900",
      "Paramount+": "from-blue-700 to-blue-900",
      Peacock: "from-yellow-600 to-yellow-800",
    };
    return gradients[type] || "from-emerald-600 to-emerald-800";
  };

  const getGradientStyle = (type: string, customColor?: string) => {
    if (customColor && customColor.startsWith("#")) {
      const safeColor = sanitizeCssValue(customColor);
      return {
        background: `linear-gradient(135deg, ${safeColor}dd, ${safeColor}99)`,
      };
    }
    return {};
  };

  const handleAddToCart = () => {
    onAddToCart(account, quantity);
  };

  return (
    <Card
      className={`group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${
        isExclusiveAccount
          ? "bg-gradient-to-br from-amber-900/20 via-amber-800/10 to-yellow-900/20 border border-amber-700/30 shadow-2xl shadow-amber-900/20"
          : "bg-gradient-to-br from-slate-900 to-slate-800"
      }`}
    >
      {/* Efecto de borde premium para cuentas exclusivas */}
      {isExclusiveAccount && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent opacity-50"></div>
      )}

      {/* Efecto de superposición de degradado */}
      {account.streamingType?.color &&
      account.streamingType.color.startsWith("#") ? (
        <div
          className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-300"
          style={getGradientStyle(account.type, account.streamingType.color)}
        ></div>
      ) : (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${getGradientColor(
            account.type,
            account.streamingType?.color,
          )} opacity-10 group-hover:opacity-20 transition-opacity duration-300`}
        ></div>
      )}

      {/* Insignias especiales - Mejoradas para Exclusividad */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {isVendor &&
          account.originalPrice && ( // <-- AGREGAR ESTE BLOQUE
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 px-3 py-1 text-xs font-bold shadow-lg shadow-blue-500/30">
              <Percent className="w-3 h-3 mr-1" />
              PRECIO VENDEDOR
            </Badge>
          )}
        {isExclusiveAccount && (
          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 px-3 py-1 text-xs font-bold shadow-lg shadow-amber-500/30">
            <Crown className="w-3 h-3 mr-1" />
            EXCLUSIVO
          </Badge>
        )}
        {isMostPopular && !isExclusiveAccount && (
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 px-3 py-1 text-xs font-bold">
            <TrendingUp className="w-3 h-3 mr-1" />
            MÁS POPULAR
          </Badge>
        )}
        {isSpecialOffer && !isExclusiveAccount && (
          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 px-3 py-1 text-xs font-bold">
            <Gift className="w-3 h-3 mr-1" />
            {account.specialOffer?.discountPercentage}% OFF
          </Badge>
        )}
      </div>

      <CardHeader className="relative z-10 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {isExclusiveAccount ? (
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30 border border-amber-400/30">
                <Crown className="w-5 h-5" />
              </div>
            ) : account.streamingType?.imageUrl ? (
              <img
                src={account.streamingType.imageUrl}
                alt={account.type}
                className="w-12 h-12 rounded-lg object-cover border-1 border-white/20 shadow-lg"
                width={48}
                height={48}
                loading="lazy"
              />
            ) : account.streamingType?.color &&
              account.streamingType.color.startsWith("#") ? (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg"
                style={getGradientStyle(
                  account.type,
                  account.streamingType.color,
                )}
              >
                {account.streamingType?.icon ? (
                  <span className="text-lg">{account.streamingType.icon}</span>
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </div>
            ) : (
              <div
                className={`w-8 h-8 rounded-lg bg-gradient-to-r ${getGradientColor(
                  account.type,
                  account.streamingType?.color,
                )} flex items-center justify-center text-white shadow-lg`}
              >
                {account.streamingType?.icon ? (
                  <span className="text-lg">{account.streamingType.icon}</span>
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </div>
            )}
            <div>
              <Badge
                variant="secondary"
                className={`${
                  isExclusiveAccount
                    ? "bg-amber-500/20 text-amber-200 border-amber-400/30"
                    : "bg-white/10 text-white border-white/20"
                } text-xs font-medium`}
              >
                {account.type}
              </Badge>
            </div>
          </div>
        </div>

        <h3
          className={`text-xl font-bold mb-2 transition-colors ${
            isExclusiveAccount
              ? "text-white bg-gradient-to-r from-amber-200 to-yellow-200 bg-clip-text text-transparent group-hover:from-amber-100 group-hover:to-yellow-100"
              : "text-white group-hover:text-purple-300"
          }`}
        >
          {account.name}
        </h3>
        <p
          className={`text-sm leading-relaxed line-clamp-2 ${
            isExclusiveAccount ? "text-amber-200/80" : "text-gray-300"
          }`}
        >
          {account.description}
        </p>
      </CardHeader>

      <CardContent className="relative z-10 flex-1">
        <div className="space-y-4">
          {/* Características - Mejoradas para Exclusividad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <Calendar
                className={`h-4 w-4 ${
                  isExclusiveAccount ? "text-amber-400" : "text-purple-400"
                }`}
              />
              <span
                className={`text-sm ${
                  isExclusiveAccount ? "text-amber-100" : "text-gray-300"
                }`}
              >
                {account.duration}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Monitor
                className={`h-4 w-4 ${
                  isExclusiveAccount ? "text-amber-400" : "text-blue-400"
                }`}
              />
              <span
                className={`text-sm ${
                  isExclusiveAccount ? "text-amber-100" : "text-gray-300"
                }`}
              >
                {account.quality}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <Monitor
                  className={`h-4 w-4 ${
                    isExclusiveAccount ? "text-amber-400" : "text-green-400"
                  }`}
                />
                <span
                  className={`text-sm ml-2 ${
                    isExclusiveAccount ? "text-amber-100" : "text-gray-300"
                  }`}
                >
                  {account.screens === 1
                    ? "1 Pantalla"
                    : `${account.screens} Pantallas`}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Shield
                className={`h-4 w-4 ${
                  isExclusiveAccount ? "text-amber-400" : "text-yellow-400"
                }`}
              />
              <span
                className={`text-sm ${
                  isExclusiveAccount ? "text-amber-100" : "text-gray-300"
                }`}
              >
                Garantizado
              </span>
            </div>
          </div>

          {/* Sección de precios - Mejorada para Exclusiva */}
          <div
            className={`pt-4 border-t ${
              isExclusiveAccount ? "border-amber-700/30" : "border-white/10"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div>
                <div className="flex items-baseline space-x-1">
                  {/* Mostrar precio tachado solo para VENDEDORES */}
                  {isVendor && account.originalPrice && (
                    <span className={`text-lg line-through text-gray-400`}>
                      ${" "}
                      {account.originalPrice.toLocaleString("es-CO", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  )}

                  {/* Mostrar precio tachado solo para OFERTAS ESPECIALES */}
                  {!isVendor &&
                    account.originalPrice &&
                    account.specialOffer && (
                      <span className={`text-lg line-through text-gray-400`}>
                        ${" "}
                        {account.originalPrice.toLocaleString("es-CO", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    )}
                  <span
                    className={`text-3xl font-bold ${
                      isExclusiveAccount
                        ? "bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-transparent"
                        : "bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
                    }`}
                  >
                    $
                    {displayPrice.toLocaleString("es-CO", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span
                    className={`text-sm ${
                      isExclusiveAccount ? "text-amber-300/70" : "text-gray-400"
                    }`}
                  >
                    /{account.saleType === "PROFILES" ? "Perfil" : "Cuenta"}
                  </span>
                </div>

                {isVendor && account.originalPrice && (
                  <p className="text-xs mt-1 text-blue-400">
                    Precio para vendedores
                  </p>
                )}

                {!isVendor && account.originalPrice && account.specialOffer && (
                  <p className="text-xs mt-1 text-orange-400">
                    Precio con descuento
                  </p>
                )}
                <p
                  className={`text-xs mt-1 ${
                    isExclusiveAccount ? "text-amber-300/60" : "text-gray-400"
                  }`}
                >
                  {account.saleType === "PROFILES"
                    ? "Precio por perfil individual"
                    : "Acceso completo a la cuenta"}
                </p>
              </div>

              <div className="text-right">
                <div
                  className={`flex items-center text-sm ${
                    availableStock > 0 || exclusiveStock > 0
                      ? isExclusiveAccount
                        ? "text-amber-400"
                        : "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {availableStock > 0 || exclusiveStock > 0 ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      <span>Disponible</span>
                    </>
                  ) : (
                    <>
                      <span className="text-red-400">Agotado</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="relative z-10 pt-4">
        <Button
          onClick={handleAddToCart}
          disabled={availableStock === 0 && exclusiveStock === 0}
          style={
            account.streamingType?.color &&
            account.streamingType.color.startsWith("#")
              ? getGradientStyle(account.type, account.streamingType.color)
              : {}
          }
          className={`w-full hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg ${
            availableStock === 0 && exclusiveStock === 0
              ? "opacity-50 cursor-not-allowed"
              : ""
          } ${
            isExclusiveAccount
              ? "bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 shadow-amber-500/30 border border-amber-400/30"
              : !(
                    account.streamingType?.color &&
                    account.streamingType.color.startsWith("#")
                  )
                ? `bg-gradient-to-r ${getGradientColor(
                    account.type,
                    account.streamingType?.color,
                  )}`
                : ""
          }`}
          size="lg"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {availableStock === 0 && exclusiveStock === 0
            ? "Agotado"
            : "Agregar al Carrito"}
        </Button>
      </CardFooter>
    </Card>
  );
}
