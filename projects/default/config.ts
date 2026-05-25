export const MisticConfig = {
  appName: "GeoContent Core",
  appDescription: "Core engine for geolocation-based multimedia experiences.",
  theme: {
    primaryColor: "#1a1a1a", // Deep grey/black from current layout
    accentColor: "#f59e0b",  // Generic amber accent
    backgroundColor: "#ffffff",
  },
  vocabulary: {
    pointOfInterest: "Lugar",
    actionButton: "Ver detalles",
  },
  metadata: {
    url: process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com",
    ogImage: "/og-image.jpg",
    creator: "GeoContent Core",
    publisher: "GeoContent Core",
    keywords: ["geofencing", "location-based", "multimedia", "PWA"],
    locale: "es_ES", // Defaulting to Spanish since user is Spanish-speaking
  },
  pwa: {
    shortName: "GCCore",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
  }
};
