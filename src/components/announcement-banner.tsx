"use client";

import { sanitizeAnimationValue, sanitizeCssValue } from "@/lib/sanitize";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function AnnouncementBanner() {
  const [banner, setBanner] = useState<any>(null);

  useEffect(() => {
    const loadBanner = async () => {
      try {
        const response = await fetch("/api/announcement");
        if (response.ok) {
          const data = await response.json();
          if (data.isActive && data.text) {
            setBanner(data);
          }
        }
      } catch (error) {
        //console.error('Error al cargar banner:', error)
        toast.error("Error al cargar banner");
      }
    };

    loadBanner();
  }, []);

  if (!banner) {
    return null;
  }

  // Sanitizar valores del API en el cliente (defense in depth)
  const safeBgColor = sanitizeCssValue(banner.backgroundColor || "#000000");
  const safeTextColor = sanitizeCssValue(banner.textColor || "#ffffff");
  const safeSpeed = sanitizeAnimationValue(banner.speed || 20);

  return (
    <div
      className="w-full overflow-hidden relative z-40"
      style={{
        backgroundColor: safeBgColor,
        color: safeTextColor,
      }}
    >
      <div className="relative">
        <div
          className="whitespace-nowrap py-2 px-4 inline-block"
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            animation: `scroll ${safeSpeed}s linear infinite`,
          }}
        >
          <span className="inline-block px-4">{banner.text}</span>
          <span className="inline-block px-4">{banner.text}</span>
          <span className="inline-block px-4">{banner.text}</span>
        </div>
      </div>
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
