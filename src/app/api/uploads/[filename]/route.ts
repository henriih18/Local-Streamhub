import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import { join, resolve } from "path";
import { requireAdmin } from "@/lib/auth";

const UPLOADS_DIR = resolve(process.cwd(), "uploads");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decoded = decodeURIComponent(filename);

  // Validación completa de path traversal
  if (
    decoded.includes("..") ||
    decoded.includes("/") ||
    decoded.includes("\\") ||
    decoded.includes("\0")
  ) {
    return NextResponse.json({ error: "Inválido" }, { status: 400 });
  }

  // Verificar que el path resuelto sigue dentro de UPLOADS_DIR
  const filePath = resolve(join(UPLOADS_DIR, decoded));
  if (!filePath.startsWith(UPLOADS_DIR + "/") && filePath !== UPLOADS_DIR) {
    return NextResponse.json({ error: "Inválido" }, { status: 400 });
  }

  // Solo permitir extensiones de imagen
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const ext = decoded.split(".").pop()?.toLowerCase();
  if (!ext || !allowedExts.includes(`.${ext}`)) {
    return NextResponse.json({ error: "Tipo no permitido" }, { status: 400 });
  }

  try {
    const fileBuffer = await readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}

export const DELETE = requireAdmin(
  async (
    _request: NextRequest,
    _user,
    { params }: { params: Promise<{ filename: string }> },
  ) => {
    const { filename } = await params;
    const decoded = decodeURIComponent(filename);

    if (
      decoded.includes("..") ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("\0")
    ) {
      return NextResponse.json({ error: "Inválido" }, { status: 400 });
    }

    const filePath = resolve(join(UPLOADS_DIR, decoded));
    if (!filePath.startsWith(UPLOADS_DIR + "/")) {
      return NextResponse.json({ error: "Inválido" }, { status: 400 });
    }

    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = decoded.split(".").pop()?.toLowerCase();
    if (!ext || !allowedExts.includes(`.${ext}`)) {
      return NextResponse.json({ error: "Tipo no permitido" }, { status: 400 });
    }

    try {
      await unlink(filePath);
      return NextResponse.json({ success: true, message: "Imagen eliminada" });
    } catch {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  },
);