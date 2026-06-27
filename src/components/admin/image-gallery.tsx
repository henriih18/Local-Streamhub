"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Image as ImageIcon,
  Trash2,
  Download,
  Eye,
  Check,
  Search,
  X,
} from "lucide-react";
import { toast } from "@/components/ui/toast-custom";

interface SavedImage {
  id: string;
  name: string;
  data: string;
  createdAt: string;
  size: number;
  source: "localStorage" | "server";
  url?: string;
}

interface ImageGalleryProps {
  onSelectImage: (base64: string) => void;
  currentImage?: string;
}

export default function ImageGallery({
  onSelectImage,
  currentImage,
}: ImageGalleryProps) {
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<SavedImage | null>(null);

  useEffect(() => {
    loadSavedImages();
  }, []);

  const loadSavedImages = async () => {
    setLoading(true);
    try {
      // Cargar imagenes de localStorage
      let localStorageImages: SavedImage[] = [];
      try {
        /* const stored = localStorage.getItem("streaming-type-images"); */
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("streaming-type-images");
          if (stored) {
            const images = JSON.parse(stored);
            localStorageImages = images.map((img: SavedImage) => ({
              ...img,
              source: "localStorage" as const,
            }));
          }
        }
      } catch (error) {
        //console.error('Error al cargar imagenes de localStorage:', error)
      }

      // Cargar servidor de imagenes
      let serverImages: SavedImage[] = [];
      try {
        const response = await fetch("/api/uploads");
        if (response.ok) {
          const data = await response.json();
          serverImages = data.images.map((img: any) => ({
            id: `server_${img.filename}`,
            name: img.filename,
            data: img.url,
            createdAt: img.createdAt,
            size: Math.round(img.size / 1024),
            source: "server" as const,
            url: img.url,
          }));
        }
      } catch (error) {
        //console.error('Error al cargar servidor de imagenes:', error)
        /* toast.error("Error al cargar servidor de Imagenes") */
      }

      const allImages = [...serverImages, ...localStorageImages];
      setSavedImages(allImages);
    } catch (error) {
      //console.error('Error al cargar imagenes:', error)
      toast.error("Error al cargar imagenes");
    } finally {
      setLoading(false);
    }
  };

  const saveImage = (base64: string, name: string) => {
    try {
      // Optimize the image before saving
      optimizeImageForGallery(base64)
        .then((optimizedBase64) => {
          const newImage: SavedImage = {
            id: Date.now().toString(),
            name,
            data: optimizedBase64,
            createdAt: new Date().toISOString(),
            size: Math.round((optimizedBase64.length * 0.75) / 1024),
            source: "localStorage",
          };

          const updatedImages = [...savedImages, newImage];
          setSavedImages(updatedImages);
          localStorage.setItem(
            "streaming-type-images",
            JSON.stringify(
              updatedImages.filter((img) => img.source === "localStorage"),
            ),
          );
          toast.success("Imagen guardada en la galería");
        })
        .catch((error) => {
          toast.error("Error al optimizar la imagen");
          //console.error('Erro en la optimizacion:', error)
        });
    } catch (error) {
      toast.error("Error al guardar la imagen");
      //console.error('Error all guardar imagen:', error)
    }
  };

  const optimizeImageForGallery = (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        const maxSize = 300;
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl);
      };

      img.onerror = reject;
      img.src = base64;
    });
  };

  const deleteImage = async (id: string) => {
    try {
      const imageToDelete = savedImages.find((img) => img.id === id);
      if (!imageToDelete) return;

      if (imageToDelete.source === "localStorage") {
        const updatedImages = savedImages.filter((img) => img.id !== id);
        setSavedImages(updatedImages);
        localStorage.setItem(
          "streaming-type-images",
          JSON.stringify(
            updatedImages.filter((img) => img.source === "localStorage"),
          ),
        );
        toast.success("Imagen eliminada");
      } else {
        const filename = imageToDelete.name;
        const response = await fetch(
          `/api/uploads/${encodeURIComponent(filename)}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );
        if (response.ok) {
          const updatedImages = savedImages.filter((img) => img.id !== id);
          setSavedImages(updatedImages);
          toast.success("Imagen eliminada del servidor");
        } else {
          toast.error("Error al eliminar la imagen del servidor");
        }
      }
    } catch (error) {
      toast.error("Error al eliminar la imagen");
    }
  };

  const downloadImage = (image: SavedImage) => {
    try {
      const link = document.createElement("a");

      if (image.source === "server" && image.url) {
        link.href = image.url;
        link.download = image.name;
        link.target = "_blank";
      } else {
        link.href = image.data;
        link.download = `${image.name}.png`;
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Imagen descargada");
    } catch (error) {
      toast.error("Error al descargar la imagen");
      //console.error('Error al descargar la imagen:', error)
    }
  };

  const formatFileSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getImageSrc = (image: SavedImage) => {
    return image.source === "server" ? image.url || image.data : image.data;
  };

  const getImageData = (image: SavedImage) => {
    return image.source === "server" && image.url ? image.url : image.data;
  };

  const isCurrentImage = (image: SavedImage) => {
    return currentImage ? currentImage === getImageData(image) : false;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <ImageIcon className="w-4 h-4 mr-2" />
          Galería de Imágenes
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-6xl w-[90vw] max-h-[85vh] rounded-xl overflow-hidden flex flex-col p-0">
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-700/50">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                  Galería de Imágenes
                </DialogTitle>
                {!loading && (
                  <Badge
                    variant="secondary"
                    className="bg-slate-700 text-slate-300 text-xs font-normal"
                  >
                    {savedImages.length} imagen
                    {savedImages.length !== 1 ? "es" : ""}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Current image strip */}
          {currentImage && (
            <div className="mt-3 flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700/50">
              <img
                src={currentImage}
                alt="Currently selected"
                className="w-8 h-8 object-cover rounded-md ring-1 ring-slate-600"
              />
              <span className="text-xs text-slate-400">
                Imagen seleccionada actualmente
              </span>
              <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <ScrollArea className="h-[60vh]">
          <div className="p-6">
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto"></div>
                <p className="text-sm text-slate-400 mt-3">
                  Cargando imágenes...
                </p>
              </div>
            ) : savedImages.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg font-medium">
                  No hay imágenes guardadas
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Las imágenes que subas se guardarán automáticamente aquí
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {savedImages.map((image) => {
                  const isCurrent = isCurrentImage(image);
                  return (
                    <div
                      key={image.id}
                      className="group relative bg-slate-800 rounded-lg overflow-hidden border border-slate-700/50 hover:border-slate-600 transition-all duration-200"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-[3/2] bg-slate-800">
                        <img
                          src={getImageSrc(image)}
                          alt={image.name}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />

                        {/* Selected indicator */}
                        {isCurrent && (
                          <div className="absolute top-2 left-2 z-10">
                            <div className="bg-emerald-600 text-white rounded-full p-1 shadow-lg shadow-emerald-900/40">
                              <Check className="w-3 h-3" />
                            </div>
                          </div>
                        )}

                        {/* Server badge */}
                        {image.source === "server" && (
                          <div className="absolute top-2 right-2 z-10">
                            <Badge className="text-[10px] bg-blue-600/90 text-white border-0 px-1.5 py-0">
                              URL
                            </Badge>
                          </div>
                        )}

                        {/* Hover overlay with action buttons */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPreviewImage(image)}
                            className="p-2 bg-white/10 backdrop-blur-sm rounded-lg text-white hover:bg-white/20 transition-all duration-200"
                            title="Vista previa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onSelectImage(getImageData(image))}
                            className={`p-2 backdrop-blur-sm rounded-lg transition-all duration-200 ${
                              isCurrent
                                ? "bg-emerald-600/80 text-white"
                                : "bg-emerald-600/60 text-white hover:bg-emerald-600"
                            }`}
                            title={isCurrent ? "Seleccionada" : "Seleccionar"}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadImage(image)}
                            className="p-2 bg-white/10 backdrop-blur-sm rounded-lg text-white hover:bg-white/20 transition-all duration-200"
                            title="Descargar"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteImage(image.id)}
                            className="p-2 bg-white/10 backdrop-blur-sm rounded-lg text-red-400 hover:bg-red-600 transition-all duration-200"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Info bar */}
                      <div className="px-2.5 py-2 space-y-0.5">
                        <p className="text-xs text-slate-300 truncate font-medium">
                          {image.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">
                            {formatFileSize(image.size)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatDate(image.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>

      {/* ── Lightbox Preview ── */}
      {previewImage && (
        <Dialog
          open={!!previewImage}
          onOpenChange={() => setPreviewImage(null)}
        >
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl rounded-xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div className="flex items-center gap-2 min-w-0">
                  <DialogTitle className="text-white truncate">
                    {previewImage.name}
                  </DialogTitle>
                  {previewImage.source === "server" && (
                    <Badge className="text-[10px] bg-blue-600/90 text-white border-0 px-1.5 py-0 shrink-0">
                      Servidor
                    </Badge>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-center bg-slate-800 rounded-lg p-2">
                <img
                  src={getImageSrc(previewImage)}
                  alt={previewImage.name}
                  className="max-h-[70vh] max-w-full object-contain rounded"
                />
              </div>

              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Tamaño: {formatFileSize(previewImage.size)}</span>
                <span>Creada: {formatDate(previewImage.createdAt)}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    onSelectImage(getImageData(previewImage));
                    setPreviewImage(null);
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white transition-all duration-200"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Seleccionar esta imagen
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadImage(previewImage)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPreviewImage(null)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 transition-all duration-200"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
