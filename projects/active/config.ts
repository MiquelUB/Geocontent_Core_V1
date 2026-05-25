/**
 * PXX — Projecte Xino Xano
 * Active project configuration
 * 
 * This file defines the identity, theme, and vocabulary for the 
 * currently active deployment. Change this to white-label for a 
 * different municipality.
 */

// Theme Strategy: Define 4 Design Tokens (Pells)
const ThemePresets = {
  // 1. Muntanya (Verified Mountain Design - "Stitch Green")
  muntanya: {
    colors: {
      base: "#F9F7F2",  // Cream (No pure white)
      dark: "#1A1C19",  // Ink
      terra: "#8B4513",  // Saddle Brown (Secondary/Accent)
      olive: "#578e6a",  // Stitch Green (Primary Action)
      gold: "#D4AF37",  // Gold
      stone: "#44403c",  // Stone Gray
    },
    fonts: {
      display: "var(--font-newsreader)", // Serif for "Editorial/Institutional" feel
      body: "var(--font-geist-sans)",    // Sans for UI readability
      mono: "var(--font-geist-mono)",
    }
  },

  // 2. Mar (Coast - "Bitàcola Marina")
  mar: {
    colors: {
      base: "#F0F8FF",  // Alice Blue
      dark: "#0A1929",  // Deep Navy
      terra: "#0077BE",  // Ocean Blue (Primary Action)
      olive: "#20B2AA",  // Light Sea Green (Secondary)
      gold: "#FFD700",  // Gold (Sand/Sun)
      stone: "#708090",  // Slate Grey
    },
    fonts: {
      display: "Montserrat",
      body: "Lato",
      mono: "Source Code Pro",
    }
  },

  // 3. Interior (Rural - "Crònica de Poble")
  interior: {
    colors: {
      base: "#FAF0E6",  // Linen
      dark: "#2F1B0C",  // Dark Coffee
      terra: "#8B4513",  // Saddle Brown
      olive: "#556B2F",  // Dark Olive
      gold: "#DAA520",  // Goldenrod
      stone: "#808080",  // Grey
    },
    fonts: {
      display: "Merriweather",
      body: "Open Sans",
      mono: "Courier Prime",
    }
  },

  // 4. City (Urban - "Guia Metropolitana")
  city: {
    colors: {
      base: "#FFFFFF",  // Pure White
      dark: "#000000",  // Pure Black
      terra: "#E63946",  // Vivid Red
      olive: "#2A9D8F",  // Teal
      gold: "#E9C46A",  // Yellow
      stone: "#264653",  // Charcoal
    },
    fonts: {
      display: "Oswald",
      body: "Roboto",
      mono: "Fira Code",
    }
  }
};

// Select theme from ENV or default to 'muntanya'
const SELECTED_THEME_ID = (process.env.NEXT_PUBLIC_THEME_ID as keyof typeof ThemePresets) || 'muntanya';
const activeTheme = ThemePresets[SELECTED_THEME_ID] || ThemePresets.muntanya;

export const PxxConfig = {
  appName: "Projecte Xino Xano",
  appDescription: "Descobreix el patrimoni cultural i natural del territori amb rutes interactives.",

  // Dynamic Theme Strategy
  themeId: SELECTED_THEME_ID,
  theme: activeTheme,

  // Chameleon Engine — 5 visual themes per route
  chameleonThemes: {
    mountain: { primary: "#4A5D23", accent: "#BC5D36", bg: "#F9F7F2", icon: "⛰️", label: "Muntanya" },
    coast: { primary: "#1B6B93", accent: "#F4D160", bg: "#F5F5F0", icon: "🌊", label: "Costa" },
    city: { primary: "#2C3E50", accent: "#E74C3C", bg: "#ECEFF1", icon: "🏛️", label: "Ciutat" },
    interior: { primary: "#8B6914", accent: "#A0522D", bg: "#FFF8DC", icon: "🌾", label: "Interior" },
    bloom: { primary: "#C2185B", accent: "#FF6F91", bg: "#FFF0F5", icon: "🌸", label: "Floració" },
  },

  vocabulary: {
    pointOfInterest: "Punt d'Interès",
    route: "Ruta",
    passport: "Passaport",
    quiz: "Repte",
    stamp: "Segell",
    actionButton: "Descobrir",
  },

  metadata: {
    url: process.env.NEXT_PUBLIC_APP_URL || "https://xinoxano.cat",
    ogImage: "/og-image.jpg",
    creator: "Projecte Xino Xano",
    publisher: "Projecte Xino Xano",
    keywords: ["patrimoni", "turisme", "senderisme", "Catalunya", "passaport"],
    locale: "ca_ES",
    supportedLocales: ["ca", "es", "fr", "en"],
    defaultLocale: "ca",
  },

  pwa: {
    shortName: "XinoXano",
    background_color: activeTheme.colors.base,
    theme_color: activeTheme.colors.terra,
  },
};

// Type-safe theme access
export type ChameleonThemeId = keyof typeof PxxConfig.chameleonThemes;
export type ChameleonTheme = typeof PxxConfig.chameleonThemes[ChameleonThemeId];



