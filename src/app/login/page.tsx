"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast-custom";
import { Loader2, Eye, EyeOff } from "lucide-react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Mostrar mensaje de éxito si viene del registro
  useEffect(() => {
    const message = searchParams.get("message");
    if (message === "registration_success") {
      toast.success(
        "¡Cuenta creada exitosamente! Por favor verifica tu email.",
      );
    } else if (message === "email_verified") {
      toast.success("¡Email verificado! Ya puedes iniciar sesión.");
    } else if (message === "auth_required") {
      toast.error("Debes iniciar sesión para acceder a esta página.");
    } else if (message === "account_inactive") {
      toast.error("Tu cuenta está inactiva. Contacta soporte.");
    }
  }, [searchParams]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "El email es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "El email no es válido";
    }

    if (!formData.password) {
      newErrors.password = "La contraseña es requerida";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));

        // Guardar la fecha de expiración del token para el monitor
        if (data.tokenExpiresAt) {
          localStorage.setItem("tokenExpiresAt", data.tokenExpiresAt);
        }

        window.dispatchEvent(
          new CustomEvent("userLoggedIn", { detail: data.user }),
        );

        toast.success("¡Inicio de sesión exitoso!");

        // Redirigir según el rol del usuario
        if (data.user.role === "ADMIN") {
          router.push("/admin");
        } else {
          router.push("/");
        }
      } else {
        // Si requiere verificación, redirigir a verificación
        if (data.requiresVerification) {
          toast.error(data.error || "Debes verificar tu email");
          router.push(
            `/verify-email?email=${encodeURIComponent(
              data.verificationEmail,
            )}&reason=login_required`,
          );
        } else {
          toast.error(data.error || "Error al iniciar sesión");
        }

        if (data.field) {
          setErrors({ [data.field]: data.error });
        }
        setIsLoading(false);
      }
    } catch (error) {
      toast.error("Error de conexión. Intenta nuevamente.");
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Limpiar error cuando el usuario empieza a escribir
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-slate-400">
              Accede a tu cuenta para gestionar tus servicios de streaming
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 ${
                    errors.email ? "border-red-400" : ""
                  }`}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-red-400 text-sm">{errors.email}</p>
                )}
              </div>

              {/* Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 pr-10 ${
                      errors.password ? "border-red-400" : ""
                    }`}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-sm">{errors.password}</p>
                )}
              </div>

              {/* Botón de Login */}
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>

              {/* Link para Registro */}
              <div className="text-center">
                <p className="text-slate-400 text-sm">
                  ¿No tienes una cuenta?{" "}
                  <Link
                    href="/register"
                    className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                  >
                    Regístrate aquí
                  </Link>
                </p>
              </div>
              {/* Link para Olvidé Contraseña */}
              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-white">
                  Iniciar Sesión
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Cargando...
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
