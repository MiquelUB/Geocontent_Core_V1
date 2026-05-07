export interface TerritorialPackage {
  version: string; // Hash o Timestamp (ex: "20260429-1530") per avaluar deltes
  municipality: {
    id: string;
    name: string;
    bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat] per centrar el MapLibre
  };
  config: {
    biomeTheme: string; // Ex: 'Blossom', 'City'
    iconsMappingUrl: string; // URL a l'sprite o JSON d'icones
  };
  cartography: {
    vectorTileUrl: string; // URL al .pmtiles de l'emmagatzematge S3 (< 30MB)
    styleUrl: string; // JSON d'estils Mapbox/MapLibre GL compatible
  };
  routes: OfflineRoute[];
}

export interface OfflineRoute {
  id: string;
  slug: string;
  title: Record<string, string>; // i18n { ca: "", es: "", en: "", fr: "" }
  description: Record<string, string>;
  estimatedTime: number;
  distance: number;
  pois: OfflinePoi[];
}

export interface OfflinePoi {
  id: string;
  latitude: number;
  longitude: number;
  title: Record<string, string>;
  icon: string;
  mediaUrls: string[]; // Llista d'imatges/vídeos a descarregar (CacheManager)
  quiz: {
    question: Record<string, string>;
    options: Array<Record<string, string>>;
    correctAnswer: number;
  } | null; // El JSON del repte per gamificació offline
}
