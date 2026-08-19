"use client";

// Importaciones
import {
  FaAmazon,
  FaApple,
  FaSpotify,
  FaYoutube,
} from "react-icons/fa";
import {
  SiHbo,
  SiParamountplus,
  SiNetflix,
  SiCrunchyroll,
  SiPlex,
  SiCanvas,
} from "react-icons/si";
import { TbBrandDisney } from "react-icons/tb";
import { IconType } from "react-icons";

const STREAMING_SERVICES: Array<{
  id: string;
  name: string;
  icon: IconType;
  color: string;
}> = [
  { id: "netflix", name: "Netflix", icon: SiNetflix, color: "#E50914" },
  { id: "amazon", name: "Amazon Prime", icon: FaAmazon, color: "#FF9900" },
  { id: "hbo", name: "HBO Max", icon: SiHbo, color: "#5822B4" },
  { id: "disney", name: "Disney+", icon: TbBrandDisney, color: "#113CCF" },
  { id: "apple", name: "Apple TV+", icon: FaApple, color: "#555555" },
  { id: "spotify", name: "Spotify", icon: FaSpotify, color: "#1DB954" },
  { id: "youtube", name: "YouTube", icon: FaYoutube, color: "#FF0000" },
  { id: "paramount", name: "Paramount+", icon: SiParamountplus, color: "#0066FF" },
  { id: "crunchyroll", name: "Crunchyroll", icon: SiCrunchyroll, color: "#F47521" },
  { id: "plex", name: "Plex", icon: SiPlex, color: "#E5A00D" },
  { id: "canvas", name: "Canvas", icon: SiCanvas, color: "#0077C8" },
];

export function FloatingStreamingIcons() {
  const MAX_ICONS = 20;
  const iconsToShow = STREAMING_SERVICES.slice(0, MAX_ICONS);

  if (iconsToShow.length === 0) return null;

  // Configuración de la cuadrícula (ajusta según prefieras)
  const COLS = 4;
  const ROWS = Math.ceil(iconsToShow.length / COLS);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {iconsToShow.map((service, i) => {
          // Calcular fila y columna
          const col = i % COLS;
          const row = Math.floor(i / COLS);

          // Posición base en la cuadrícula (con márgenes)
          const baseTop = 5 + (row * (85 / (ROWS - 1 || 1)));
          const baseLeft = 5 + (col * (85 / (COLS - 1 || 1)));

          // Desplazamiento aleatorio controlado para evitar rigidez
          const topOffset = ((i * 17) % 15) - 7; // entre -7 y +7
          const leftOffset = ((i * 23) % 20) - 10; // entre -10 y +10

          // Aplicar offsets y asegurar límites
          const top = Math.min(90, Math.max(5, baseTop + topOffset));
          const left = Math.min(90, Math.max(5, baseLeft + leftOffset));

          // Tamaño (entre 20 y 40 px)
          const size = 20 + ((i * 9) % 20);
          const delay = i * 0.5;
          const duration = 35 + ((i * 7) % 15);

          return (
            <div
              key={service.id}
              className="absolute float-icon"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                opacity: 0.4,
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: size,
                  height: size,
                  color: service.color,
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.1))",
                }}
                title={service.name}
              >
                <service.icon size={size * 0.85} />
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes float-around {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          20% {
            transform: translate(10vw, -5vh) rotate(8deg) scale(1);
          }
          40% {
            transform: translate(-15vw, 5vh) rotate(-5deg) scale(1);
          }
          60% {
            transform: translate(5vw, 10vh) rotate(12deg) scale(1);
          }
          80% {
            transform: translate(-5vw, -10vh) rotate(-8deg) scale(1);
          }
          100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
        }

        .float-icon {
          animation-name: float-around;
          animation-timing-function: cubic-bezier(0.45, 0.05, 0.55, 0.95);
          animation-iteration-count: infinite;
          will-change: transform;
          pointer-events: auto;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }


        @media (prefers-reduced-motion: reduce) {
          .float-icon {
            animation: none !important;
            opacity: 0.4 !important;
          }
        }
      `}</style>
    </>
  );
}