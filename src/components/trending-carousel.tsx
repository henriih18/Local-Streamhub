"use client";

import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Film,
  Tv,
  TrendingUp,
  X,
  Eye,
} from "lucide-react";
import Autoplay from "embla-carousel-autoplay";

interface Provider {
  name: string;
  logoUrl: string;
}

interface TrendingItem {
  id: number;
  title: string;
  posterUrl: string;
  rating: number;
  mediaType: string;
  year: string;
  overview: string;
  providers: Provider[];
}

export function TrendingCarousel() {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<TrendingItem | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      slidesToScroll: 2,
      skipSnaps: false,
      dragFree: true,
    },
    [
      Autoplay({
        delay: 4000,
        stopOnInteraction: true,
        stopOnMouseEnter: true,
      }),
    ],
  );

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch("/api/trending");
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchTrending();
  }, []);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  if (isLoading) {
    return (
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-amber-400 animate-pulse" />
            <div className="h-6 w-48 bg-slate-700/50 rounded animate-pulse" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[130px] md:w-[150px] rounded-xl overflow-hidden"
              >
                <div className="aspect-[2/3] bg-slate-700/50 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300 text-sm font-medium">
              Tendencias de la Semana
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={scrollPrev}
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-4 h-4 text-slate-300" />
            </button>
            <button
              onClick={scrollNext}
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div className="overflow-hidden rounded-xl" ref={emblaRef}>
            <div className="flex gap-4">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  className="flex-shrink-0 w-[140px] md:w-[160px] lg:w-[175px]"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                >
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="group relative rounded-xl overflow-hidden bg-slate-800 border border-slate-700/50 hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    aria-label={`Ver detalles de ${item.title}`}
                  >
                    {/* Poster */}
                    <div className="relative aspect-[2/3] overflow-hidden">
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                      {/* Rating */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-white text-xs font-semibold">
                          {item.rating}
                        </span>
                      </div>

                      {/* Type badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1">
                        {item.mediaType === "Película" ? (
                          <Film className="w-3 h-3 text-blue-400" />
                        ) : (
                          <Tv className="w-3 h-3 text-purple-400" />
                        )}
                        <span className="text-white text-[10px] font-medium">
                          {item.mediaType}
                        </span>
                      </div>

                      {/* Bottom info */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Platform logos */}
                          {item.providers.length > 0 && (
                            <div className="flex items-center gap-1 mb-1.5">
                              {item.providers.map((provider) => (
                                <img
                                  key={provider.name}
                                  src={provider.logoUrl}
                                  alt={provider.name}
                                  title={provider.name}
                                  className="h-4.5 w-auto rounded-sm"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          )}
                          <h3 className="text-white text-sm font-bold leading-tight line-clamp-2 mt-auto">
                            {item.title}
                          </h3>
                          {/* {item.year && (
                            <span className="text-slate-400 text-[10px]">
                              {item.year}
                            </span>
                          )} */}
                        </div>

                        {/* Eye icon */}
                        <motion.div
                          animate={{ rotateY: [0, 40, -40, 0] }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-5 h-4 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 ml-2"
                          style={{ perspective: 100 }}
                        >
                          <Eye className="w-3.5 h-3.5 text-white" />
                        </motion.div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Fade edges */}
          <div className="absolute top-0 left-0 bottom-0 w-8 bg-gradient-to-r from-[#0f172a] to-transparent pointer-events-none rounded-l-xl z-10" />
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-[#0f172a] to-transparent pointer-events-none rounded-r-xl z-10" />
        </div>
      </div>
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl shadow-black/50"
          >
            <div className="relative">
              <img
                src={selectedItem.posterUrl}
                alt={selectedItem.title}
                className="w-full max-h-[30vh] object-cover"
                width={185}
                height={278}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/15 backdrop-blur-md border border-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="p-4 pt-1">
              <div className="flex items-center gap-2 mb-3">
                {selectedItem.mediaType === "Película" ? (
                  <span className="flex items-center gap-1 bg-blue-500/20 text-blue-400 rounded-md px-2 py-0.5 text-xs font-medium">
                    <Film className="w-3 h-3" /> Película
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-purple-500/20 text-purple-400 rounded-md px-2 py-0.5 text-xs font-medium">
                    <Tv className="w-3 h-3" /> Serie
                  </span>
                )}
                {selectedItem.year && (
                  <span className="text-slate-400 text-xs">
                    {selectedItem.year}
                  </span>
                )}
                <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                  <Star className="w-3 h-3 fill-amber-400" />{" "}
                  {selectedItem.rating}
                </span>
              </div>
              <h2 className="text-white text-lg font-bold mb-3">
                {selectedItem.title}
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                {selectedItem.overview || "Sin descripción disponible."}
              </p>
              {selectedItem.providers.length > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/50">
                  <span className="text-slate-500 text-sm">Disponible en:</span>
                  <div className="flex items-center gap-1.5">
                    {selectedItem.providers.map((provider) => (
                      <img
                        key={provider.name}
                        src={provider.logoUrl}
                        alt={provider.name}
                        title={provider.name}
                        className="h-6 w-auto rounded"
                        width={45}
                        height={24}
                        loading="lazy"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </section>
  );
}

export default TrendingCarousel;
