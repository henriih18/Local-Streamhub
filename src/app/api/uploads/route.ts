import { NextRequest, NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";
import { stat } from "fs/promises";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { error } from "console";

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const uploadsDir = join(process.cwd(), "uploads");

    try {
      const files = await readdir(uploadsDir);

      // Filtrar archivos de imagen y obtener sus estadísticas
      const imageFiles = await Promise.all(
        files
          .filter((file) => {
            const ext = file.split(".").pop()?.toLowerCase();
            return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "");
          })
          .map(async (file) => {
            try {
              const filePath = join(uploadsDir, file);
              const stats = await stat(filePath);

              return {
                filename: file,
                url: `/api/uploads/${file}`,
                size: stats.size,
                createdAt: stats.birthtime.toISOString(),
                modifiedAt: stats.mtime.toISOString(),
              };
            } catch (error) {
              logger.error(
                {
                  err: error,
                  file: file, // ← Campo separado para filtrar
                  context: "read_stats",
                },
                `Error leyendo estadísticas de archivos para ${file}`,
              );
              return null;
            }
          }),
      );

      // Filtrar resultados nulos y ordenar por fecha de creación (más reciente primero)
      const validFiles = imageFiles
        .filter((file) => file !== null)
        .sort(
          (a, b) =>
            new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime(),
        );

      return NextResponse.json({
        success: true,
        images: validFiles,
        total: validFiles.length,
      });
    } catch (dirError) {
      logger.error({ err: error }, "Error al leer el directorio de cargas");
      return NextResponse.json({
        success: true,
        images: [],
        total: 0,
        message: "No se encontró ningún directorio de cargas",
      });
    }
  } catch (error) {
    logger.error({ err: error }, "Error al cargar las imágenes subidas");
    return NextResponse.json(
      { error: "Error al cargar las imágenes subidas" },
      { status: 500 },
    );
  }
});
