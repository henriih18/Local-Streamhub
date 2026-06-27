"use client";

import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface CustomToastProps {
  message: string;
  type: "success" | "error" | "warning" | "info";
  id?: string;
}

const icons = {
  success: <CheckCircle className="w-5 h-5 text-white drop-shadow-lg" />,
  error: <XCircle className="w-5 h-5 text-white drop-shadow-lg" />,
  warning: <AlertCircle className="w-5 h-5 text-white drop-shadow-lg" />,
  info: <Info className="w-5 h-5 text-white drop-shadow-lg" />,
};

export function CustomToast({ message, type, id }: CustomToastProps) {
  return (
    <div className="flex items-center gap-3">
      {icons[type]}
      <span className="flex-1 text-white font-semibold drop-shadow-sm">
        {message}
      </span>
    </div>
  );
}

type ToastOptions = {
  description?: string;
  duration?: number;
  style?: React.CSSProperties;
};

// Funciones helper para mostrar toasts personalizados
export const toast = {
  success: (
    message: string,
    /* p0: { duration: number } */ options?: ToastOptions,
  ) => {
    return sonnerToast.success(message, {
      icon: <CheckCircle className="w-5 h-5 text-white drop-shadow-lg" />,
      style: {
        background:
          "linear-gradient(135deg, rgba(34, 197, 94, 0.85) 0%, rgba(16, 185, 129, 0.85) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow:
          "0 6px 24px rgba(34, 197, 94, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      },
    });
  },
  error: (message: string) => {
    return sonnerToast.error(message, {
      icon: <XCircle className="w-5 h-5 text-white drop-shadow-lg" />,
      style: {
        background:
          "linear-gradient(135deg, rgba(239, 68, 68, 0.85) 0%, rgba(220, 38, 38, 0.85) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow:
          "0 6px 24px rgba(239, 68, 68, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      },
    });
  },
  warning: (message: string) => {
    return sonnerToast.warning(message, {
      icon: <AlertCircle className="w-5 h-5 text-white drop-shadow-lg" />,
      style: {
        background:
          "linear-gradient(135deg, rgba(251, 191, 36, 0.85) 0%, rgba(245, 158, 11, 0.85) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow:
          "0 6px 24px rgba(251, 191, 36, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      },
    });
  },
  info: (message: string) => {
    return sonnerToast.info(message, {
      icon: <Info className="w-5 h-5 text-white drop-shadow-lg" />,
      style: {
        background:
          "linear-gradient(135deg, rgba(59, 130, 246, 0.85) 0%, rgba(37, 99, 235, 0.85) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow:
          "0 6px 24px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      },
    });
  },
  message: (message: string) => {
    return sonnerToast.message(message, {
      icon: <Info className="w-5 h-5 text-white drop-shadow-lg" />,
      style: {
        background:
          "linear-gradient(135deg, rgba(139, 92, 246, 0.85) 0%, rgba(236, 72, 153, 0.85) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow:
          "0 6px 24px rgba(139, 92, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      },
    });
  },
  dismiss: () => {
    return sonnerToast.dismiss();
  },
};
