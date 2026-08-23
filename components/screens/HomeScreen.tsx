import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Navigation, MapPin, HelpCircle } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { motion } from "motion/react";
import MapLibreMap from '@/components/map/MapLibreMap';
import { calculateDistance, calculateDistanceRaw } from "@/lib/location";
import { Marker, useMap } from "react-map-gl/maplibre";
import iconsMapping from '@/lib/icons-mapping.json';
import { PxxConfig } from "@/projects/active/config";
import { getLegends, getAppBranding } from "@/lib/actions/queries";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedContent } from "@/lib/i18n-db";

const BIOME_MAP: Record<string, string> = {
  mountain: 'Montanya',
  coast: 'Mar',
  city: 'City',
  interior: 'Interior',
  bloom: 'Blossom',
};

const typeToIconName: Record<string, string> = {
  'RELIGIOS': 'Esglesia',
  'CIVIL': 'Casa',
  'DEFENSIU': 'Castell',
  'LLEGENDA': 'Castell',
  'AIGUA': 'Aigua',
  'MIRADOR': 'Vistes',
  'NATURA': 'Arbre',
  'GUERRA_CIVIL': 'Civil_war',
  'PERSONA_ILLUSTRE': 'Personatje',
};

function getPoiIconSrc(poi: any, globalBiome?: string) {
  const category = (poi.parentRoute?.category || poi.category || globalBiome || 'mountain').toLowerCase();
  const biome = BIOME_MAP[category] || BIOME_MAP['mountain'];

  if (poi.icon) {
    const baseName = poi.icon.split('.')[0];
    return `/icons/${biome}/${baseName}.webp`;
  }

  const type = (poi.type || '').toUpperCase();
  const mappedName = typeToIconName[type] || 'punt_interest';

  const availableFiles = (iconsMapping as any)[biome] || [];
  const finalIcon = availableFiles.find((f: string) =>
    f.toLowerCase().startsWith(mappedName.toLowerCase())
  ) || 'punt_interest.webp';

  return `/icons/${biome}/${finalIcon}`;
}

function MapBoundsFitter({ pois, userLoc }: { pois: any[], userLoc: any }) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map || !pois || pois.length === 0) return;

    // We must wait for the DOM to paint the map container, otherwise fitBounds 
    // will calculate a NaN zoom (due to 0 height - padding) and CRASH WebGL!
    const timer = setTimeout(() => {
      let minLng = pois[0].longitude;
      let maxLng = pois[0].longitude;
      let minLat = pois[0].latitude;
      let maxLat = pois[0].latitude;

      pois.forEach(p => {
        if (p.longitude < minLng) minLng = p.longitude;
        if (p.longitude > maxLng) maxLng = p.longitude;
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
      });

      // Extra protection against NaN coordinates creeping into bounds
      if (isNaN(minLng) || isNaN(maxLng) || isNaN(minLat) || isNaN(maxLat)) return;

      try {
        const container = map.getContainer();
        const clientHeight = container?.clientHeight || 0;
        const clientWidth = container?.clientWidth || 0;

        // If the map hasn't rendered a valid size yet, do not fit bounds
        if (clientHeight < 50 || clientWidth < 50) return;

        // Dynamic safe padding (max 10% of container or 20px) to prevent negative viewport math
        const safePadding = Math.min(20, Math.floor(Math.min(clientHeight, clientWidth) * 0.1));

        const isSinglePoint = minLng === maxLng && minLat === maxLat;
        if (isSinglePoint) {
          map.flyTo({ center: [minLng, minLat], zoom: 16, duration: 1000 });
        } else {
          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: safePadding, maxZoom: 15, duration: 1000 }
          );
        }
      } catch (e) {
        console.error("Error fitting bounds", e);
      }
    }, 500); // Wait 500ms for React and Maplibre to finish mounting and measuring

    return () => clearTimeout(timer);
  }, [map, pois]);

  return null;
}

interface HomeScreenProps {
  onNavigate: (screen: string, data?: any) => void;
  onOpenHelp: () => void;
  brand?: any;
  userLocation?: { latitude: number; longitude: number } | null;
  error?: string | null;
  currentUser?: any;
}

export function HomeScreen({ onNavigate, onOpenHelp, brand: propBrand, userLocation, error: geoError, currentUser }: HomeScreenProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  const [nearbyPois, setNearbyPois] = useState<any[]>([]);
  const [mapPois, setMapPois] = useState<any[]>([]);
  const [brand, setBrand] = useState<any>(propBrand);

  const [allLegends, setAllLegends] = useState<any[]>([]);

  // 1. Fetch data from server ONCE
  useEffect(() => {
    async function fetchInitialData() {
      const [legendsData, brandData] = await Promise.all([
        getLegends(currentUser?.id),
        !propBrand ? getAppBranding() : Promise.resolve(propBrand)
      ]);
      if (!propBrand) setBrand(brandData);
      if (legendsData) setAllLegends(legendsData);
    }
    fetchInitialData();
  }, [propBrand, currentUser?.id]);

  // 2. Recalculate distances only when userLocation or allLegends changes
  useEffect(() => {
    if (allLegends.length === 0) return;

    const defaultLoc = { latitude: 42.4140, longitude: 0.9870 };
    const currentLoc = userLocation || defaultLoc;

    const allPois: any[] = [];
    allLegends.forEach((l: any) => {
      if (l.pois && Array.isArray(l.pois)) {
        l.pois.forEach((poi: any) => {
          allPois.push({
            ...poi,
            parentRoute: l,
            distance: calculateDistance(
              currentLoc.latitude,
              currentLoc.longitude,
              poi.latitude,
              poi.longitude
            ),
            distanceRaw: calculateDistanceRaw(
              currentLoc.latitude,
              currentLoc.longitude,
              poi.latitude,
              poi.longitude
            ),
            image: poi.image_url || l.image_url,
            rating: l.rating || 4.5,
            location: getLocalizedContent(l, 'location_name', locale) || t('defaultLocationName'),
          });
        });
      }
    });

    const validPois = allPois.filter(p => 
      typeof p.latitude === 'number' && 
      typeof p.longitude === 'number' &&
      !isNaN(p.latitude) && 
      !isNaN(p.longitude)
    );

    const uniquePoisMap = new Map();
    validPois.forEach(p => {
      if (!uniquePoisMap.has(p.id)) {
        uniquePoisMap.set(p.id, p);
      }
    });
    
    // Sort all unique valid POIs by distance to user
    const allSortedPois = Array.from(uniquePoisMap.values())
      .sort((a, b) => a.distanceRaw - b.distanceRaw);

    // Limit nearby to 3, and map POIs to 30 to prevent WebGL Marker DOM crashes
    setNearbyPois(allSortedPois.slice(0, 3));
    setMapPois(allSortedPois.slice(0, 30));
  }, [userLocation, allLegends, locale, t]);

  const defaultLoc = { latitude: 42.4140, longitude: 0.9870 };
  const currentLoc = userLocation || defaultLoc;

  return (
    <div className="screen bg-background">

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative h-64 mx-4 mt-4 rounded-lg overflow-hidden bg-gradient-to-br from-green-100 to-blue-100 shadow-md pointer-events-none"
      >
        <div className="absolute inset-0 z-0">
          <MapLibreMap id="home-map" center={[currentLoc.longitude, currentLoc.latitude]} zoom={12}>
            <MapBoundsFitter pois={mapPois.length > 0 ? mapPois : nearbyPois} userLoc={userLocation} />
            {mapPois.map((p, idx) => (
              <Marker key={`p-${idx}-${p.id}`} longitude=
              {p.longitude} latitude={p.latitude} anchor="bottom">
                <div className="flex flex-col items-center pointer-events-none">
                  {(() => {
                    const iconSrc = getPoiIconSrc(p, brand?.themeId);
                    return iconSrc ? (
                      <img
                        src={iconSrc}
                        className="w-10 h-10 drop-shadow-md object-contain"
                        alt={getLocalizedContent(p, 'title', locale)}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.fallback-lucide')) {
                            const icon = document.createElement('div');
                            icon.className = 'fallback-lucide w-8 h-8 text-primary flex items-center justify-center';
                            icon.innerHTML = '📍';
                            parent.appendChild(icon);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-white shadow-md overflow-hidden bg-primary/20 backdrop-blur-sm relative z-10">
                        {p.image ? (
                          <ImageWithFallback src={p.image} alt={getLocalizedContent(p, 'title', locale)} className="w-full h-full object-cover" />
                        ) : (
                          <MapPin className="w-4 h-4 text-white m-1.5" />
                        )}
                      </div>
                    );
                  })()}
                </div>
              </Marker>
            ))}
          </MapLibreMap>
        </div>

        <div
          className="absolute inset-0 z-10 cursor-pointer pointer-events-auto"
          onClick={() => onNavigate('map')}
        ></div>


        <div className="absolute bottom-4 left-4 bg-primary/95 backdrop-blur-sm rounded-lg px-3 py-2 z-20 flex items-center space-x-2 border border-white/10 shadow-lg">
          {geoError ? (
            <>
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }} className="w-2 h-2 rounded-full bg-red-400" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-200">
                {geoError}
              </p>
            </>
          ) : !userLocation ? (
            <>
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]"
              />
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/90">
                {t('searchingGps')}
              </p>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/90">
                {t('gpsActive')}
              </p>
            </>
          )}
        </div>
      </motion.div>

      <div className="p-4 pb-20"> 
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-between mb-4"
        >
          <h2 className="text-xl font-serif font-semibold text-primary">
            {t('nearbyPlaces')}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('legends')}
            className="text-secondary hover:bg-secondary/10"
          >
            {t('viewAll')}
          </Button>
        </motion.div>

        <div className="space-y-3">
          {nearbyPois.map((poi, index) => (
            <motion.div
              key={poi.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 + (index * 0.1) }}
              onClick={() => onNavigate('legend-detail', poi.parentRoute)}
              className="pallars-card cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex space-x-3">
                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                  <ImageWithFallback
                    src={poi.image}
                    alt={getLocalizedContent(poi, 'title', locale)}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-serif font-medium text-primary truncate">
                      {getLocalizedContent(poi, 'title', locale)}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-1 text-sm text-muted-foreground mb-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{poi.location}</span>
                  </div>

                  <p className="text-sm text-foreground/80 line-clamp-1 mb-2">
                    {getLocalizedContent(poi, 'description', locale) || getLocalizedContent(poi.parentRoute, 'title', locale)}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-full font-medium">
                      {t('toUnlock', { distance: poi.distance })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </div>
  );
}
