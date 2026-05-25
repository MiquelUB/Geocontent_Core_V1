import React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "../globals.css";
import { PxxConfig } from "@/projects/active/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false, // Desactivat per evitar avisos de preload no utilitzat
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

import { getTranslations } from 'next-intl/server';
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}): Promise<Metadata> {
  const { locale } = await params;

  // Si el locale no és vàlid, no generem metadata per evitar crides innecessàries, 
  // però NO llancem notFound() aquí perquè trenca l'enviament de capçaleres (ERR_HTTP_HEADERS_SENT).
  // El notFound() es llança dins del component RootLayout.
  if (!routing.locales.includes(locale as any)) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: 'meta' });
  
  let brand = null;
  try {
    brand = await getAppBranding();
  } catch (e) {
    // Graceful fallback during build-time static generation
  }
  const appName = brand?.name || t('title') || PxxConfig.appName;

  return {
    metadataBase: new URL(PxxConfig.metadata.url),
    title: appName,
    description: t('description') || PxxConfig.appDescription,
    keywords: PxxConfig.metadata.keywords,
    authors: [{ name: PxxConfig.metadata.creator }],
    creator: PxxConfig.metadata.creator,
    publisher: PxxConfig.metadata.publisher,
    openGraph: {
      title: appName,
      description: PxxConfig.appDescription,
      url: PxxConfig.metadata.url,
      siteName: appName,
      images: [
        {
          url: PxxConfig.metadata.ogImage,
          width: 1200,
          height: 630,
          alt: appName,
        },
      ],
      locale: PxxConfig.metadata.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: appName,
      description: PxxConfig.appDescription,
      images: [PxxConfig.metadata.ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
    manifest: "/manifest.json",
    icons: {
      icon: brand?.logoUrl || "/favicon.png",
      apple: brand?.logoUrl || "/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: PxxConfig.theme.colors.terra,
};

import { getAppBranding } from "@/lib/actions/queries";
import { Toaster } from "sonner";

function hexToHsl(hex: string) {
  if (!hex || typeof hex !== 'string') return "0 0% 0%";

  let r = 0, g = 0, b = 0;
  const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;

  if (cleanHex.length === 4) {
    r = parseInt(cleanHex[1] + cleanHex[1], 16);
    g = parseInt(cleanHex[2] + cleanHex[2], 16);
    b = parseInt(cleanHex[3] + cleanHex[3], 16);
  } else if (cleanHex.length === 7) {
    r = parseInt(cleanHex.substring(1, 3), 16);
    g = parseInt(cleanHex.substring(3, 5), 16);
    b = parseInt(cleanHex.substring(5, 7), 16);
  } else {
    return "0 0% 0%";
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate that the incoming `locale` parameter is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  let brand = null;
  try {
    brand = await getAppBranding();
  } catch (e) {
    // Graceful fallback during build-time static generation
  }

  const themeId = (brand as any)?.themeId || 'mountain';
  const theme = (PxxConfig.chameleonThemes as any)[themeId] || PxxConfig.chameleonThemes.mountain;

  const themeStyles = {
    '--primary': hexToHsl(theme.primary),
    '--accent': hexToHsl(theme.accent),
    '--background': hexToHsl(theme.bg),
  } as React.CSSProperties;

  return (
    <html lang={locale} suppressHydrationWarning={true}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
            `
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: PxxConfig.appName,
              url: PxxConfig.metadata.url,
              description: PxxConfig.appDescription,
              applicationCategory: "TravelApplication",
              operatingSystem: "Android, iOS",
              screenshot: `${PxxConfig.metadata.url}${PxxConfig.metadata.ogImage}`,
              genre: "Folklore, Culture, Tourism",
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${geistSans.className} antialiased`}
        style={themeStyles}
        suppressHydrationWarning={true}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
