import { logger } from "@/lib/logger";
import { getClientIdentifier, rateLimit } from "@/lib/rate-limiter";
import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const REGION = "CO"; // Colombia

// Cache en memoria: 7 días
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
let cachedData: any = null;
let cachedAt = 0;

interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  media_type: "movie" | "tv";
  overview: string;
  genre_ids: number[];
  release_date?: string;
  first_air_date?: string;
}

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface TrendingItem {
  id: number;
  title: string;
  posterUrl: string;
  rating: number;
  mediaType: string;
  year: string;
  overview: string;
  providers: {
    name: string;
    logoUrl: string;
  }[];
}

async function fetchProviders(
  id: number,
  mediaType: string,
): Promise<Provider[]> {
  try {
    const type = mediaType === "tv" ? "tv" : "movie";
    const res = await fetch(
      `${TMDB_BASE}/${type}/${id}/watch/providers?language=es-ES`,
      {
        headers: {
          Authorization: `Bearer ${TMDB_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!res.ok) return [];

    const data = await res.json();
    const regionData = data.results?.[REGION];

    if (!regionData?.flatrate) return [];

    return regionData.flatrate.slice(0, 3);
  } catch (error) {
    logger.error(
      {
        err: error,
      },
      "[TMDB] No se pudieron obtener los proveedores",
    );
    return [];
  }
}

async function fetchFromTMDB(): Promise<TrendingItem[]> {
  const res = await fetch(`${TMDB_BASE}/trending/all/week?language=es-ES`, {
    headers: {
      Authorization: `Bearer ${TMDB_API_KEY}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status}`);
  }

  const data = await res.json();
  const items: TMDBItem[] = data.results || [];

  const filtered = items
    .filter((item) => item.poster_path !== null)
    .slice(0, 15);

  // Obtener proveedores en paralelo
  const providerResults = await Promise.all(
    filtered.map((item) => fetchProviders(item.id, item.media_type)),
  );

  return filtered.map((item, index) => {
    const providers = providerResults[index] || [];
    const year =
      item.release_date?.split("-")[0] ||
      item.first_air_date?.split("-")[0] ||
      "";

    return {
      id: item.id,
      title: item.title || item.name || "Sin título",
      posterUrl: `${TMDB_IMG}/w500${item.poster_path}`,
      rating: Math.round(item.vote_average * 10) / 10,
      mediaType: item.media_type === "movie" ? "Película" : "Serie",
      year,
      overview: item.overview || "",
      providers: providers.map((p) => ({
        name: p.provider_name,
        logoUrl: `${TMDB_IMG}/w45${p.logo_path}`,
      })),
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 30 peticiones por minuto por IP
    const identifier = getClientIdentifier(request);
    const limitCheck = await rateLimit({
      identifier,
      limit: 30,
      windowMs: 60 * 1000,
    });

    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
        { status: 429 },
      );
    }

    if (!TMDB_API_KEY) {
      return NextResponse.json(
        { error: "TMDB API key not configured" },
        { status: 500 },
      );
    }

    const now = Date.now();
    if (cachedData && now - cachedAt < CACHE_TTL) {
      return NextResponse.json({
        items: cachedData,
        cached: true,
        updatedAt: new Date(cachedAt).toISOString(),
      });
    }

    const items = await fetchFromTMDB();
    cachedData = items;
    cachedAt = now;

    return NextResponse.json({
      items,
      cached: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "API falló, sirviendo caché obsoleto");

    return NextResponse.json(
      { error: "Error fetching trending content" },
      { status: 500 },
    );
  }
}
