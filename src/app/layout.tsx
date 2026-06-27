import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { headers } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RiyoStream",
  description:
    "Disfruta del mejor contenido premium al mejor precio. Cuentas seguras, entregas rápidas y total garantía en tu entretenimiento favorito.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" }, // Fallback para navegadores viejos
      { url: "/favicon.svg", type: "image/svg+xml" }, // El mejor y más nítido para navegadores modernos
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }, // Para iPhone/iPad
    ],
    other: [
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        url: "/web-app-manifest-192x192.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "512x512",
        url: "/web-app-manifest-512x512.png",
      },
    ],
  },
  authors: [{ name: "RiyoStream Team" }],

  openGraph: {
    title: "RiyoStream",
    description: "Tu plataforma de confianza para cuentas de streaming premium",
    url: "https://riyostream.com",
    siteName: "RiyoStream",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RiyoStream",
    description: "Tu plataforma de confianza para cuentas de streaming premium",
  },
  other: {
    "color-scheme": "light dark",
    "supported-color-schemes": "light dark",
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") || "";

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="darkreader-lock" content="true" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster
          position="top-center"
          expand={false}
          richColors
          closeButton={false}
          theme="dark"
          toastOptions={{
            style: {
              borderRadius: "12px",
              padding: "16px 20px",
              margin: "8px",
              backdropFilter: "blur(12px)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "600",
              boxShadow:
                "0 6px 24px rgba(139, 92, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
              minWidth: "320px",
              maxWidth: "520px",
            },
            className: "vibrant-toast",
          }}
        />
      </body>
    </html>
  );
}
