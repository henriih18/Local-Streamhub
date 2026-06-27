"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  Lock,
  Check,
  X,
  AlertCircle,
  Send,
} from "lucide-react";
import { toast } from "@/components/ui/toast-custom";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<
    Record<string, { available: boolean; message: string; checking: boolean }>
  >({});

  // ── Telegram Verification ──
  const [telegramStatus, setTelegramStatus] = useState<
    "idle" | "loading" | "waiting" | "verified" | "error"
  >("idle");
  const [telegramToken, setTelegramToken] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState("");
  const telegramPollRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const checkAvailability = async (field: string, value: string) => {
    if (!value || value.length < 3) {
      setAvailability((prev) => ({
        ...prev,
        [field]: { available: false, message: "", checking: false },
      }));
      return;
    }

    setAvailability((prev) => ({
      ...prev,
      [field]: { available: false, message: "", checking: true },
    }));

    try {
      const response = await fetch(
        `/api/auth/check-availability?type=${field}&value=${encodeURIComponent(value)}`,
      );
      const data = await response.json();

      if (response.ok) {
        setAvailability((prev) => ({
          ...prev,
          [field]: {
            available: data.available,
            message: data.message,
            checking: false,
          },
        }));
      } else {
        setAvailability((prev) => ({
          ...prev,
          [field]: { available: false, message: "", checking: false },
        }));
      }
    } catch {
      setAvailability((prev) => ({
        ...prev,
        [field]: { available: false, message: "", checking: false },
      }));
    }
  };

  useEffect(() => {
    return () => {
      if (telegramPollRef.current) {
        clearInterval(telegramPollRef.current);
      }
    };
  }, []);

  // ── Telegram Verification Function ──
  const startTelegramVerification = async () => {
    if (!formData.phone.trim()) {
      setErrors((prev) => ({ ...prev, phone: "Ingresa tu teléfono primero" }));
      return;
    }

    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(formData.phone)) {
      setErrors((prev) => ({ ...prev, phone: "El teléfono no es válido" }));
      return;
    }

    setTelegramStatus("loading");
    setTelegramError("");

    try {
      const linkRes = await fetch("/api/telegram/generate-link", {
        method: "POST",
      });
      const linkData = await linkRes.json();

      if (!linkRes.ok) {
        setTelegramStatus("error");
        setTelegramError(linkData.error || "Error al generar enlace");
        return;
      }

      const tempToken = linkData.deepLink.split("start=")[1];
      setTelegramToken(tempToken);

      window.open(linkData.deepLink, "_blank");
      setTelegramStatus("waiting");

      const pollInterval = setInterval(async () => {
        try {
          const checkRes = await fetch("/api/telegram/check-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tempToken }),
          });
          const checkData = await checkRes.json();

          if (checkData.status === "LINKED") {
            clearInterval(pollInterval);
            telegramPollRef.current = null;
            setTelegramStatus("verified");
          } else if (checkData.status === "EXPIRED") {
            clearInterval(pollInterval);
            telegramPollRef.current = null;
            setTelegramStatus("error");
            setTelegramError("El enlace expiró. Intenta de nuevo.");
          }
        } catch {
          // seguir haciendo polling
        }
      }, 3000);

      telegramPollRef.current = pollInterval;

      setTimeout(
        () => {
          if (telegramPollRef.current) {
            clearInterval(telegramPollRef.current);
            telegramPollRef.current = null;
            setTelegramStatus((prev) => {
              if (prev === "waiting") {
                setTelegramError("Tiempo agotado. Intenta de nuevo.");
                return "error";
              }
              return prev;
            });
          }
        },
        10 * 60 * 1000,
      );
    } catch {
      setTelegramStatus("error");
      setTelegramError("Error de conexión. Intenta de nuevo.");
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "El nombre completo es requerido";
    } else if (formData.fullName.length < 3) {
      newErrors.fullName = "El nombre debe tener al menos 3 caracteres";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "El email es requerido";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "El email no es válido";
    }

    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!formData.phone.trim()) {
      newErrors.phone = "El teléfono es requerido";
    } else if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = "El teléfono no es válido";
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!formData.username.trim()) {
      newErrors.username = "El nombre de usuario es requerido";
    } else if (!usernameRegex.test(formData.username)) {
      newErrors.username =
        "Solo letras, números y guiones bajos (3-20 caracteres)";
    }

    if (!formData.password) {
      newErrors.password = "La contraseña es requerida";
    } else if (formData.password.length < 8) {
      newErrors.password = "La contraseña debe tener al menos 8 caracteres";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = "Debe incluir mayúsculas, minúsculas y números";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (telegramStatus !== "verified" || !telegramToken) {
      toast.error("Debes verificar tu teléfono por Telegram primero");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          username: formData.username,
          password: formData.password,
          telegramTempToken: telegramToken,
          country: "CO",
          language: "es",
          acceptMarketing: false,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("¡Cuenta creada exitosamente! Por favor inicia sesión.");
        router.push("/login");
      } else {
        toast.error(data.error || "Error al crear la cuenta");
        if (data.field) {
          setErrors({ [data.field]: data.error });

          // Si el error es de teléfono (no coincide), resetear verificación
          if (data.field === "phone" && data.error.includes("Telegram")) {
            setTelegramStatus("error");
            setTelegramError(data.error);
            setTelegramToken(null);
          }
        }
      }
    } catch {
      toast.error("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }

    /* if (field === "email" && typeof value === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(value)) {
        checkAvailability("email", value);
      } else {
        setAvailability((prev) => ({
          ...prev,
          email: { available: false, message: "", checking: false },
        }));
      }
    } else if (field === "username" && typeof value === "string") {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (usernameRegex.test(value)) {
        checkAvailability("username", value);
      } else {
        setAvailability((prev) => ({
          ...prev,
          username: { available: false, message: "", checking: false },
        }));
      }
    } */

    // Resetear verificación Telegram si cambia el teléfono
    if (field === "phone") {
      if (telegramPollRef.current) {
        clearInterval(telegramPollRef.current);
        telegramPollRef.current = null;
      }
      setTelegramStatus("idle");
      setTelegramToken(null);
      setTelegramError("");
    }
  };

  const handleBlur = (field: string) => {
    const value = formData[field as keyof typeof formData];

    if (typeof value !== "string" || !value) return;

    // Validar formato antes de consultar backend
    if (field === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(value)) {
        checkAvailability("email", value);
      } else {
        setAvailability((prev) => ({
          ...prev,
          email: { available: false, message: "", checking: false },
        }));
      }
    } else if (field === "username") {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (usernameRegex.test(value)) {
        checkAvailability("username", value);
      } else {
        setAvailability((prev) => ({
          ...prev,
          username: { available: false, message: "", checking: false },
        }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Crear Cuenta
            </CardTitle>
            <CardDescription className="text-slate-400">
              Únete a RiyoStream y accede al mejor contenido
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nombre Completo */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300">
                  Nombre Completo *
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Pérez"
                  value={formData.fullName}
                  onChange={(e) =>
                    handleInputChange("fullName", e.target.value)
                  }
                  className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 ${
                    errors.fullName ? "border-red-400" : ""
                  }`}
                  disabled={isLoading}
                />
                {errors.fullName && (
                  <p className="text-red-400 text-sm">{errors.fullName}</p>
                )}
              </div>

              {/* Nombre de Usuario */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">
                  Nombre de Usuario *
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="juanperez"
                    value={formData.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    onBlur={() => handleBlur("username")}
                    className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 pr-10 ${
                      errors.username ? "border-red-400" : ""
                    } ${
                      availability.username?.available === true
                        ? "border-green-400"
                        : ""
                    } ${
                      availability.username?.available === false
                        ? "border-red-400"
                        : ""
                    }`}
                    disabled={isLoading}
                  />
                  {availability.username?.checking && (
                    <div className="absolute right-0 top-0 h-full px-3 flex items-center">
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    </div>
                  )}
                  {availability.username?.available === true &&
                    !availability.username?.checking && (
                      <div className="absolute right-0 top-0 h-full px-3 flex items-center">
                        <Check className="w-4 h-4 text-green-400" />
                      </div>
                    )}
                  {availability.username?.available === false &&
                    !availability.username?.checking && (
                      <div className="absolute right-0 top-0 h-full px-3 flex items-center">
                        <X className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                </div>
                {errors.username && (
                  <p className="text-red-400 text-sm">{errors.username}</p>
                )}
                {availability.username?.message && !errors.username && (
                  <p
                    className={`text-sm ${availability.username.available ? "text-green-400" : "text-red-400"}`}
                  >
                    {availability.username.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Email *
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 pr-10 ${
                      errors.email ? "border-red-400" : ""
                    } ${
                      availability.email?.available === true
                        ? "border-green-400"
                        : ""
                    } ${
                      availability.email?.available === false
                        ? "border-red-400"
                        : ""
                    }`}
                    disabled={isLoading}
                  />
                  {availability.email?.checking && (
                    <div className="absolute right-0 top-0 h-full px-3 flex items-center">
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    </div>
                  )}
                  {availability.email?.available === true &&
                    !availability.email?.checking && (
                      <div className="absolute right-0 top-0 h-full px-3 flex items-center">
                        <Check className="w-4 h-4 text-green-400" />
                      </div>
                    )}
                  {availability.email?.available === false &&
                    !availability.email?.checking && (
                      <div className="absolute right-0 top-0 h-full px-3 flex items-center">
                        <X className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                </div>
                {errors.email && (
                  <p className="text-red-400 text-sm">{errors.email}</p>
                )}
                {availability.email?.message && !errors.email && (
                  <p
                    className={`text-sm ${availability.email.available ? "text-green-400" : "text-red-400"}`}
                  >
                    {availability.email.message}
                  </p>
                )}
              </div>

              {/* Teléfono + Verificación Telegram */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">
                  Teléfono *
                </Label>
                <div className="flex">
                  <span className="flex items-center px-3 bg-slate-600 border border-r-0 border-slate-500 text-slate-300 text-sm rounded-l-md shrink-0">
                    +57
                  </span>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="300 123 4567"
                    value={formData.phone}
                    onChange={(e) => {
                      const digits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                      handleInputChange("phone", digits);
                    }}
                    className={`rounded-l-none bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 ${
                      errors.phone ? "border-red-400" : ""
                    } ${telegramStatus === "verified" ? "border-green-400" : ""}`}
                    disabled={isLoading || telegramStatus === "verified"}
                  />
                </div>
                {errors.phone && (
                  <p className="text-red-400 text-sm">{errors.phone}</p>
                )}

                {/* Botón Verificar Telegram */}
                {telegramStatus === "idle" && (
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-sky-500/50 text-sky-400 hover:bg-sky-500/10"
                      onClick={startTelegramVerification}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Verificar teléfono por Telegram
                    </Button>
                    <div className="relative">
                      <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const tooltip = e.currentTarget.nextElementSibling;
                          tooltip?.classList.toggle("hidden");
                        }}
                      >
                        <AlertCircle className="w-4 h-4" />
                      </button>
                      <div className="hidden absolute bottom-full right-0 mb-2 w-72 p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 max-h-[60vh] overflow-y-auto sm:bottom-full sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
                        <p className="text-sm text-slate-300 leading-relaxed">
                          🔐 Verificamos tu número para confirmar que es real y
                          evitar fraudes o cuentas falsas.
                        </p>
                        <div className="my-2 border-t border-slate-600"></div>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">
                          ✨ Beneficios al vincular Telegram
                        </p>
                        <ul className="text-sm text-slate-300 space-y-1">
                          <li>
                            📦 Recibirás tus credenciales de compra al instante
                          </li>
                          <li>
                            🎯 Notificaciones de promociones y ofertas
                            especiales
                          </li>
                          <li>
                            🔔 Avisos importantes del sistema (renovaciones,
                            bloqueos, etc.)
                          </li>
                        </ul>
                        <div className="absolute bottom-full left-4 -mb-px w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-slate-600 sm:top-full sm:left-1/2 sm:-translate-x-1/2 sm:bottom-auto sm:mb-0 sm:-mt-px sm:border-b-transparent sm:border-t-slate-600 sm:border-t-[6px]"></div>
                      </div>
                    </div>
                  </div>
                )}

                {telegramStatus === "loading" && (
                  <div className="flex items-center justify-center gap-2 mt-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando enlace...
                  </div>
                )}

                {telegramStatus === "waiting" && (
                  <div className="mt-2 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-sky-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Esperando verificación en Telegram...
                    </div>
                    <p className="text-slate-400 text-xs mt-1">
                      Abre el enlace en Telegram y comparte tu número de
                      contacto
                    </p>
                  </div>
                )}

                {telegramStatus === "verified" && (
                  <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <Check className="w-4 h-4" />
                      Teléfono verificado exitosamente
                    </div>
                  </div>
                )}

                {telegramStatus === "error" && (
                  <div className="mt-2 space-y-2">
                    <p className="text-red-400 text-sm">{telegramError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                      onClick={startTelegramVerification}
                    >
                      Reintentar verificación
                    </Button>
                  </div>
                )}
              </div>

              {/* Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Contraseña *
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 pr-10 ${
                      errors.password ? "border-red-400" : ""
                    }`}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-sm">{errors.password}</p>
                )}
              </div>

              {/* Confirmar Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300">
                  Confirmar Contraseña *
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repite tu contraseña"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      handleInputChange("confirmPassword", e.target.value)
                    }
                    className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 pr-10 ${
                      errors.confirmPassword ? "border-red-400" : ""
                    }`}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-white"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-400 text-sm">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Botón de Registro */}
              <Button
                type="submit"
                disabled={isLoading || telegramStatus !== "verified"}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    <User className="w-5 h-5 mr-2" />
                    Crear Cuenta
                  </>
                )}
              </Button>

              {/* Link para Login */}
              <div className="text-center">
                <p className="text-slate-400">
                  ¿Ya tienes una cuenta?{" "}
                  <Link
                    href="/login"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                  >
                    Inicia Sesión
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
