import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { MapPin, Navigation, Info, X, ArrowLeft, Filter, HelpCircle } from 'lucide-react';
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { motion } from "motion/react";
import MapLibreMap from "../map/MapLibreMap";
import { Marker, Popup } from "react-map-gl/maplibre";

import { getLegends } from "@/lib/actions/queries";
import { PxxConfig } from "@/projects/active/config";
import iconsMapping from '@/lib/icons-mapping.json';
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
  const category = (poi.category || globalBiome || 'mountain').toLowerCase();
  const biome = BIOME_MAP[category] || BIOME_MAP['mountain']; // Fallback a Montanya si no trobem el bioma

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

interface MapScreenProps {
  onNavigate: (screen: string, data?: any) => void;
  onOpenHelp: () => void;
  focusLegend?: any;
  brand?: any;
  userLocation: { latitude: number; longitude: number } | null;
  error?: string | null;
}

export function MapScreen({ onNavigate, onOpenHelp, focusLegend, brand, userLocation, error: geoError }: MapScreenProps) {
  const t = useTranslations('map');
  const tHome = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [selectedLegend, setSelectedLegend] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [legends, setLegends] = useState<any[]>([]);
  const [viewState, setViewState] = useState({
    longitude: 0.9870,
    latitude: 42.4140,
    zoom: 11
  });

  const [filterChips, setFilterChips] = useState<any[]>([{ id: "all", label: t('all') }]);
  const [hasInitialPosition, setHasInitialPosition] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const data = await getLegends();
      if (data) {
        const activeCategory = brand?.themeId || 'mountain';
        const theme = PxxConfig.chameleonThemes[activeCategory as keyof typeof PxxConfig.chameleonThemes] || PxxConfig.chameleonThemes['mountain'];
        const biomeColor = theme.primary;

        const mapped = data.map((l: any) => ({
          ...l,
          location: l.location_name || "",
          coordinates: { lat: l.latitude, lng: l.longitude },
          image: l.image_url,
          hero: l.hero_image_url,
          audio: l.audio_url,
          video: l.video_url,
          color: biomeColor,
        }));
        setLegends(mapped);

        const chips = [
          { id: "all", label: t('all'), color: biomeColor },
          ...mapped.map(l => ({
            id: l.id,
            label: getLocalizedContent(l, 'title', locale),
            color: biomeColor
          }))
        ];
        setFilterChips(chips);
      }
    }
    fetchData();
  }, [locale, t, brand]);

  useEffect(() => {
    if (focusLegend) {
      setViewState({
        longitude: focusLegend.coordinates?.lng ?? focusLegend.longitude ?? 0.9870,
        latitude: focusLegend.coordinates?.lat ?? focusLegend.latitude ?? 42.4140,
        zoom: 14
      });
      setSelectedLegend(focusLegend);
      setHasInitialPosition(true);
    }
    else if (userLocation && !hasInitialPosition) {
      setViewState({
        longitude: userLocation.longitude,
        latitude: userLocation.latitude,
        zoom: 12
      });
      setHasInitialPosition(true);
    }
  }, [focusLegend, userLocation, hasInitialPosition]);

  const filteredLegends = selectedRoute === "all"
    ? legends
    : legends.filter(legend => legend.id === selectedRoute);

  const allMapPoints = filteredLegends.flatMap(legend =>
    legend.pois.map((poi: any) => ({
      ...poi,
      routeId: legend.id,
      routeName: getLocalizedContent(legend, 'title', locale),
      category: legend.category, 
      location: legend.location,
      image: poi.image_url || legend.image,
      audioUrl: getLocalizedContent(poi, 'audio', locale) || poi.audioUrl || poi.audio || poi.audio_url || getLocalizedContent(legend, 'audio', locale) || legend.audio || legend.audio_url || '',
      parentRoutePois: legend.pois,
      coordinates: { lat: poi.latitude, lng: poi.longitude }
    }))
  );

  return (
    <div className="screen-full bg-background flex flex-col h-full">

        <div className="bg-primary/80 backdrop-blur-sm p-3 z-20">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {filterChips.map((chip) => {
              const isSelected = selectedRoute === chip.id;
              const activeCategory = brand?.themeId || 'mountain';
              const theme = PxxConfig.chameleonThemes[activeCategory as keyof typeof PxxConfig.chameleonThemes] || PxxConfig.chameleonThemes['mountain'];

              return (
                <Button
                  key={chip.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRoute(chip.id)}
                  className={`whitespace-nowrap flex-shrink-0 rounded-full font-bold transition-all px-4 ${isSelected
                    ? "bg-white shadow-md"
                    : "text-white border border-white/30 hover:bg-white/10"
                    }`}
                  style={isSelected ? { color: theme.primary } : {}}
                >
                  {chip.label}
                </Button>
              );
            })}
          </div>

          <div className="flex mt-1 items-center space-x-2">
            {geoError ? (
              <>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }} className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[10px] text-red-100 uppercase font-bold tracking-wider italic">{geoError}</span>
              </>
            ) : !userLocation ? (
              <>
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-[10px] text-primary-foreground/70 uppercase font-bold tracking-wider italic">{tHome('searchingGps')}</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[10px] text-primary-foreground/70 uppercase font-bold tracking-wider">{tHome('gpsActive')}</span>
              </>
            )}
          </div>
        </div>

      <div className="relative w-full h-full bg-gray-100">
        <MapLibreMap
          id="main-map"
          center={
            selectedLegend
              ? [
                selectedLegend.coordinates?.lng || selectedLegend.longitude || 0.9870,
                selectedLegend.coordinates?.lat || selectedLegend.latitude || 42.4140
              ]
              : (userLocation ? [userLocation.longitude, userLocation.latitude] : [0.9870, 42.4140])
          }
          zoom={selectedLegend ? 14 : 10} 
          userLocation={userLocation}
        >

          {allMapPoints.map((poi, index) => (
            <Marker
              key={`${poi.id}-${index}`}
              longitude={poi.longitude}
              latitude={poi.latitude}
              anchor="bottom"
            >
              <div
                className="relative cursor-pointer hover:scale-110 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLegend(poi);
                }}
              >
                {(() => {
                  const iconSrc = getPoiIconSrc(poi, brand?.themeId);
                  return iconSrc ? (
                    <img
                      src={iconSrc}
                      className="w-10 h-10 drop-shadow-md object-contain"
                      alt={getLocalizedContent(poi, 'title', locale)}
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
                    <Navigation
                      className="w-8 h-8 text-primary drop-shadow-md"
                    />
                  );
                })()}
              </div>
            </Marker>
          ))}
        </MapLibreMap>

        {selectedLegend && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-4 left-4 right-4 z-50"
          >
            <div
              className="bg-white rounded-lg p-4 shadow-xl border border-gray-200 cursor-pointer active:scale-95 transition-transform"
              onClick={() => onNavigate('legend-detail', selectedLegend)}
            >
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <ImageWithFallback
                    src={selectedLegend.image || selectedLegend.hero}
                    alt={getLocalizedContent(selectedLegend, 'title', locale)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif font-medium text-primary mb-1">
                    {getLocalizedContent(selectedLegend, 'title', locale)}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                    <MapPin className="w-3 h-3" />
                    <span>{selectedLegend.location}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {getLocalizedContent(selectedLegend, 'description', locale)}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLegend(null);
                        }}
                        className="text-xs"
                      >
                        {tCommon('close')}
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-primary text-primary-foreground pointer-events-none"
                      >
                        {tCommon('viewDetail')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
