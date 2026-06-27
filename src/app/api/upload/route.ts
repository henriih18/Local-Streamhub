import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import crypto from "crypto";
import { logger } from "@/lib/logger";

export const POST = requireAdmin(async (request: NextRequest) => {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json(
        { error: "No se ha subido ningún archivo" },
        { status: 400 },
      );
    }

    // Validar tipo de archivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Tipo de archivo no válido. Solo se permiten JPEG, PNG y WebP.",
        },
        { status: 400 },
      );
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Archivo demasiado grande. El tamaño máximo es de 5 MB." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validación por magic bytes
    const JPEG_MAGIC = [0xff, 0xd8, 0xff];
    const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
    const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46]; // 'RIFF'

    const buf = buffer.subarray(0, 12);
    const isJPEG =
      buf.length >= 3 &&
      buf[0] === JPEG_MAGIC[0] &&
      buf[1] === JPEG_MAGIC[1] &&
      buf[2] === JPEG_MAGIC[2];
    const isPNG =
      buf.length >= 4 &&
      buf[0] === PNG_MAGIC[0] &&
      buf[1] === PNG_MAGIC[1] &&
      buf[2] === PNG_MAGIC[2] &&
      buf[3] === PNG_MAGIC[3];
    const isWEBP =
      buf.length >= 12 &&
      buf[0] === WEBP_MAGIC[0] &&
      buf[1] === WEBP_MAGIC[1] &&
      buf[2] === WEBP_MAGIC[2] &&
      buf[3] === WEBP_MAGIC[3];

    if (!isJPEG && !isPNG && !isWEBP) {
      return NextResponse.json(
        { error: "Tipo de archivo no detectado como imagen válida." },
        { status: 400 },
      );
    }

    // Crear directorio uploads si no existe
    const uploadsDir = join(process.cwd(), "uploads");
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directorio ya existe
    }

    // Generar nombre de archivo único
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(4).toString("hex");

    // Determinar extensión y procesamiento basado en el tipo de archivo
    // FIX: Convertir SIEMPRE a WebP (destruye cualquier código ejecutable)
    const filename = `${timestamp}_${randomString}.webp`;
    const fileBuffer = await sharp(buffer)
      .webp({ quality: 85 })
      .resize({ width: 512, height: 512, fit: "cover", position: "center" })
      .toBuffer();
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, fileBuffer);

    // Devolver URL del archivo
    const fileUrl = `/api/uploads/${filename}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: filename,
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        context: "cargar_archivo",
      },
      "Error al cargar el archivo",
    );
    return NextResponse.json(
      { error: "Error al cargar el archivo" },
      { status: 500 },
    );
  }
});

export function GET() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function PUT() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function DELETE() {
  return NextResponse.json(
    { error: "Método no permitido" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
