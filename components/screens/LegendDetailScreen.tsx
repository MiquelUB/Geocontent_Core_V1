import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ArrowLeft, Play, Pause, Heart, Star, Share2, MapPin, Calendar, Volume2, Lock, History, Wifi, WifiOff, Navigation2, Trophy, AlertCircle } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import ImageSlider from "../ui/ImageSlider";
import HlsVideoPlayer from "../ui/HlsVideoPlayer";
import { motion, useScroll, useTransform } from "motion/react";
import { recordVisit } from "@/lib/actions/gamification";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { CheckCircle2 } from "lucide-react";
import PoiQuiz from "../quiz/PoiQuiz";
import FinalRouteQuiz from "../quiz/FinalRouteQuiz";

import { calculateDistance, calculateDistanceRaw } from "@/lib/location";
import iconsMapping from '@/lib/icons-mapping.json';

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

function getPoiIconSrc(poi: any, parentRoute: any, globalBiome?: string) {
  const category = globalBiome || (poi.category || parentRoute?.category || 'mountain').toLowerCase();
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

import { useLocale, useTranslations } from "next-intl";
import { getLocalizedContent } from "@/lib/i18n-db";

interface LegendDetailScreenProps {
  legend: any;
  onNavigate: (screen: string, data?: any) => void;
  brand?: any;
  userLocation?: { latitude: number; longitude: number } | null;
  currentUser?: any;
  onUserUpdate?: (user: any) => void;
}

export function LegendDetailScreen({ legend, onNavigate, brand, userLocation, currentUser, onUserUpdate }: LegendDetailScreenProps) {
  const locale = useLocale();
  const t = useTranslations('detail');
  const tCommon = useTranslations('common');

  // Extract coordinates safely
  const lat = legend?.latitude ?? legend?.coordinates?.lat ?? 0;
  const lng = legend?.longitude ?? legend?.coordinates?.lng ?? 0;

  // Fallback for missing legend data with localization
  const safeLegend = {
    ...legend,
    title: getLocalizedContent(legend, 'title', locale) || getLocalizedContent(legend, 'name', locale) || t('notFound'),
    description: getLocalizedContent(legend, 'description', locale) || "",
    textContent: getLocalizedContent(legend, 'textContent', locale) || "",
    image: legend?.image || legend?.image_url || "",
    location: getLocalizedContent(legend, 'location', locale) || t('unknown'),
    categoryLabel: getLocalizedContent(legend, 'categoryLabel', locale) || t('unknown'),
    coordinates: { lat, lng },
    videoUrls: legend?.videoUrls || (legend?.video_url ? [legend.video_url] : []),
    audioUrl: getLocalizedContent(legend, 'audio', locale) || legend?.audioUrl || legend?.audio || legend?.audio_url, 
    manualQuiz: legend?.manualQuiz,
    userUnlocks: legend?.userUnlocks || [],
    routeName: getLocalizedContent(legend, 'route_name', locale) || getLocalizedContent(legend, 'name', locale) || legend?.routeName
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [showFinalQuiz, setShowFinalQuiz] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const network = useNetworkStatus();

  // Parallax effect for hero
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  // Parse videoMetadata for low-res URLs
  const videoMetadata = safeLegend.videoMetadata || {};
  const videoVariants = videoMetadata.variants || [];

  const distanceStr = userLocation && (lat !== 0 || lng !== 0)
    ? calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      lat,
      lng
    )
    : null;

  // calculateDistance returns a string like "1.2 km" or "300 m", we need numeric meters for comparison
  const getNumericDistance = (distStr: string | null): number | null => {
    if (!distStr) return null;
    if (distStr.includes('km')) return parseFloat(distStr) * 1000;
    return parseFloat(distStr);
  };

  const distanceMeters = getNumericDistance(distanceStr);
  const UNLOCK_DISTANCE = 30; // metres

  // Proxy URLs per S3 (correcció CORS)
  function proxifyUrl(url: string): string {
    if (!url) return '';
    // Les URLs de S3 self-hosted passen pel proxy local
    if (url.startsWith('http') && !url.startsWith(window?.location?.origin || '')) {
      return `/api/img-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  }
  const [isAdminSession, setIsAdminSession] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAdminSession(sessionStorage.getItem('admin_master_unlocked') === 'true');
    }
  }, []);

  // Is Route if safeLegend has pois inside
  const isRoute = !!(safeLegend.pois && safeLegend.pois.length > 0);
  const isAlreadyVisited = !!(currentUser?.id && safeLegend.userUnlocks?.some((u: any) => (u.userId || u.user_id) === currentUser.id));

  // Si té routeId, és un POI dins d'una ruta. Si no el té però té pois, és el contenidor (overview) de la ruta.
  const isRouteContainer = isRoute && !safeLegend.routeId && !safeLegend.poiId;

  // Master Admin bypass: Can see everything if role is admin or superadmin master name OR admin_master_unlocked in session
  const isMasterAdmin = currentUser?.role === 'admin' || currentUser?.username === 'mistic_master' || currentUser?.email === 'mistic_master' || isAdminSession;

  // Normalitzem l'URL de l'àudio (pot venir com 'audioUrl', 'audio' o 'audio_url' depenent de l'origen)
  const effectiveAudioUrl = safeLegend.audioUrl || safeLegend.audio || safeLegend.audio_url;

  // A POI is unlocked if it's a route container, OR it was already visited, OR user is admin, OR user is close enough
  const isUnlocked = isRouteContainer || isAlreadyVisited || isMasterAdmin || (distanceMeters !== null && distanceMeters <= UNLOCK_DISTANCE);

  const allPoisVisited = isRoute && safeLegend.pois?.length > 0 && safeLegend.pois.every((poi: any) =>
    isMasterAdmin || poi.userUnlocks?.some((u: any) => u.userId === currentUser?.id)
  );

  // V2: completedAt indica si la ruta ha estat completada (sense finalQuizPassed)
  const finalQuizPassed = safeLegend.userRouteProgress?.some((urp: any) => urp.userId === currentUser?.id && urp.completedAt != null);

  // Parse POIs to calculate numeric raw distances for sorting
  const poisWithDistances = (safeLegend.pois || []).map((poi: any) => {
    const lat = typeof poi.latitude === 'number' ? poi.latitude : 0;
    const lng = typeof poi.longitude === 'number' ? poi.longitude : 0;

    // Distància raw numèrica per ordenar (0 si no tenim ubicació)
    const rawDist = userLocation && (lat !== 0 || lng !== 0)
      ? calculateDistanceRaw(userLocation.latitude, userLocation.longitude, lat, lng)
      : Infinity;

    // Distància formatada per l'etiqueta ("1.2 km")
    const formattedDist = userLocation && (lat !== 0 || lng !== 0)
      ? calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng)
      : null;

    return {
      ...poi,
      rawDist,
      formattedDist
    };
  });

  // Ordre: els més propers amunt
  const sortedPois = [...poisWithDistances].sort((a, b) => a.rawDist - b.rawDist);


  // Record visit when unlocked
  useEffect(() => {
    if (isUnlocked && currentUser?.id && safeLegend.id) {
      // Fire and forget
      recordVisit(currentUser.id, safeLegend.id)
        .then(res => {
          if (res.success && res.user && onUserUpdate) {
            onUserUpdate(res.user);
          }
        });
    }
  }, [isUnlocked, currentUser, safeLegend.id]);


  const handlePlayAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleRating = (rating: number) => {
    setUserRating(rating);
  };

  const handleShare = async () => {
    const shareData = {
      title: safeLegend.title,
      text: t('shareText', { name: safeLegend.title }),
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error en compartir:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert(t('linkCopied'));
      } catch (err) {
        console.error("Fallada al copiar:", err);
      }
    }
  };

  return (
    <div className="screen bg-background min-h-screen">
      {/* Editorial Hero Image with Parallax */}
      <div className="relative h-[60vh] min-h-[400px] w-full overflow-hidden bg-stone-950">
        <motion.div
          style={{ y }}
          className="absolute inset-0 w-full h-full"
        >
          <ImageWithFallback
            src={proxifyUrl(safeLegend.image || safeLegend.image_url || safeLegend.header16x9)}
            alt={safeLegend.title}
            className="w-full h-full object-cover"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background pointer-events-none z-20"></div>

        {/* Navigation Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('legends')}
            className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-md rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFavorite(!isFavorite)}
              className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-md rounded-full"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-md rounded-full"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <motion.div
          style={{ opacity }}
          className="absolute bottom-12 left-6 right-6 z-10"
        >
          <div className="flex items-center text-white/80 font-medium tracking-widest uppercase text-[10px] mb-1">
            <MapPin className="w-3 h-3 mr-2" />
            {safeLegend.routeName || safeLegend.location}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-2 leading-tight drop-shadow-md">
            {safeLegend.title}
          </h1>
          {safeLegend.routeName && (
            <div className="text-white/60 text-xs font-serif italic">
              {t('partOfRoute', { name: safeLegend.routeName })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Content "Paper" Sheet */}
      <div className="relative -mt-10 bg-background rounded-t-[2.5rem] z-20 px-8 py-10 min-h-[50vh] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">

        {/* Contenid Principal */}
        {(safeLegend.textContent || safeLegend.description) ? (
          <div className="relative group overflow-hidden rounded-3xl mb-12">
            <div className={`prose prose-lg prose-stone max-w-none leading-relaxed font-serif transition-all duration-1000 z-10 relative ${isUnlocked ? 'text-foreground/90' : 'text-stone-300 blur-[8px] select-none scale-[0.98]'}`}>
              {isUnlocked ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="z-10 relative"
                >
                  <p className="first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:text-primary first-letter:float-left first-letter:mr-3 first-letter:mt-[-8px]">
                    {safeLegend.textContent || safeLegend.description}
                  </p>
                  <div className="clear-both"></div>

                  {/* Audio Player Box - Directly under text */}
                  {isUnlocked && effectiveAudioUrl ? (
                    <div className="mt-8 p-4 rounded-xl bg-primary text-primary-foreground shadow-lg flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                          <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">{t('audioGuide')}</div>
                          <div className="text-xs opacity-80">{isPlaying ? t('playing') : t('clickToListen')}</div>
                        </div>
                      </div>

                      <Button
                          variant="ghost"
                          size="icon"
                          onClick={handlePlayAudio}
                          className="hover:bg-white/20 rounded-full h-12 w-12"
                      >
                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                      </Button>
                      <audio ref={audioRef} src={effectiveAudioUrl} onEnded={() => setIsPlaying(false)} />
                    </div>
                  ) : isUnlocked && !isRoute && (
                    <div className="mt-4 p-2 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-[10px] text-red-500 font-bold uppercase tracking-wider">
                      <AlertCircle className="w-3 h-3" />
                      {t('noAudio')}
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="space-y-4 pt-4">
                  <div className="h-6 bg-stone-100 rounded-full w-3/4"></div>
                  <div className="h-6 bg-stone-50 rounded-full w-full"></div>
                  <div className="h-6 bg-stone-50 rounded-full w-5/6"></div>
                  <div className="h-6 bg-stone-50 rounded-full w-full"></div>
                </div>
              )}
            </div>

            {!isUnlocked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-background/40 backdrop-blur-[2px] rounded-3xl z-20">
                <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="w-20 h-20 bg-white/80 backdrop-blur-xl rounded-full shadow-2xl border border-white/50 flex items-center justify-center text-primary mb-6 ring-8 ring-primary/5"
                >
                  <Lock className="w-8 h-8" />
                </motion.div>
                <h4 className="font-serif text-xl font-bold text-primary mb-2">{t('protectedContent')}</h4>
                <p className="text-stone-500 text-sm max-w-[200px] leading-relaxed">
                  {distanceMeters !== null ? (
                    <>{t('distanceTo', { distance: distanceStr || '' })} {t('unlockInstruction', { meters: UNLOCK_DISTANCE })}</>
                  ) : (
                    t('gpsInstruction')
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-stone-400 font-serif italic">{t('noDescription')}</div>
        )}

        <div className="mt-8 space-y-12">



          {/* Multi-Video Section */}
          {safeLegend.videoUrls && safeLegend.videoUrls.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-stone-500 font-serif text-sm px-1">
                <Play className="w-3 h-3" />
                <span>{tCommon('video')}</span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {safeLegend.videoUrls.map((videoUrl: string, idx: number) => {
                  const variant = videoMetadata.variants?.[idx];
                  const lowResSrc = variant?.lowResUrl || undefined;
                  return (
                    <div key={idx} className={`relative ${!isUnlocked ? 'aspect-video' : ''} rounded-2xl overflow-hidden shadow-xl border border-white/20 bg-black`}>
                      {isUnlocked ? (
                        <HlsVideoPlayer
                            src={videoUrl.endsWith('.m3u8') ? videoUrl : videoUrl}
                            lowBitrateSrc={lowResSrc}
                            muted={false}
                            className="w-full"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[200px] bg-stone-900/5 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-stone-400 relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-stone-900/10 to-transparent"></div>
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-2xl flex items-center justify-center text-white ring-4 ring-white/10">
                            <Lock className="w-5 h-5" />
                          </div>
                          <div className="text-center z-10 px-6">
                            <span className="block text-[10px] uppercase tracking-[0.2em] font-black text-stone-500 mb-1">{t('digitalLock')}</span>
                            <p className="text-[11px] leading-tight text-stone-400">{t('videoLocked')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Galeria d'Imatges (Sota el text per aprofitar espai visual) */}
          {((safeLegend.carouselImages?.length > 0) || (safeLegend.images?.length > 1)) && (
            <div className="rounded-3xl overflow-hidden shadow-sm border border-stone-200 bg-stone-950">
              {isUnlocked ? (
                <div className="aspect-[4/5] sm:aspect-[4/3] md:aspect-video w-full relative">
                  <ImageSlider
                      images={(safeLegend.carouselImages?.length > 0 ? safeLegend.carouselImages : safeLegend.images).map(proxifyUrl)}
                      isRecapture={safeLegend.is_recapture}
                  />
                </div>
              ) : (
                <div className="w-full aspect-[4/3] bg-stone-900/5 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-stone-400 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-stone-900/10 to-transparent"></div>
                  <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 shadow-inner z-10">
                    <Lock className="w-5 h-5" />
                  </div>
                  <span className="font-serif font-bold tracking-widest text-sm uppercase text-stone-600 drop-shadow-sm z-10 w-3/4 text-center">
                    {t('galleryLocked')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Punts de la Ruta & Itinerari - Es mostra sempre que hi hagis siblings */}
          {isRoute && (
            <div className="pt-4 space-y-6">


              {/* Llistat de tots els Punts de la Ruta (incloent-hi l'actual desactivat) */}
              {sortedPois.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-serif font-bold text-xl text-primary flex items-center px-1">
                    {t('itinerary')}
                    <Badge variant="secondary" className="ml-3 bg-primary/10 text-primary border-none text-[10px] uppercase">
                      {t('points', { count: sortedPois.length })}
                    </Badge>
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    {sortedPois.map((poi: any, idx: number) => {
                      const isActive = poi.id === safeLegend.id;
                      const poiVisited = !!(currentUser?.id && poi.userUnlocks?.some((u: any) => (u.userId || u.user_id) === currentUser.id));
                      const poiUnlocked = isMasterAdmin || poiVisited || (poi.rawDist !== Infinity && poi.rawDist <= (UNLOCK_DISTANCE / 1000));
                      const distLabel = poi.formattedDist;

                      return (
                        <div
                          key={poi.id}
                          onClick={() => {
                            if (isActive) return; // No navegar al mateix punt
                            poiUnlocked ? onNavigate('legend-detail', poi) : onNavigate('map', poi);
                          }}
                          className={`group relative flex gap-4 rounded-3xl border-2 p-4 transition-all duration-300 ${isActive
                            ? 'border-primary bg-primary/5 shadow-inner scale-[1.02]'
                            : poiUnlocked
                              ? 'border-primary/10 bg-white shadow-sm hover:shadow-md cursor-pointer hover:border-primary/30'
                              : 'border-stone-100 bg-stone-50/50 cursor-pointer grayscale-[0.5]'
                            }`}
                        >
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${isActive
                            ? 'bg-primary text-white ring-4 ring-primary/20'
                            : poiUnlocked
                              ? 'bg-primary/80 text-white'
                              : 'bg-stone-200 text-stone-400'
                            }`}>
                            {idx + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className={`font-serif font-bold text-base leading-tight ${isActive ? 'text-primary' : poiUnlocked ? 'text-stone-800' : 'text-stone-400'
                                }`}>
                                {getLocalizedContent(poi, 'title', locale)}
                                {isActive && (
                                  <span className="ml-2 inline-flex items-center text-[9px] uppercase tracking-tighter bg-primary text-white px-2 py-0.5 rounded-full font-black animate-pulse">
                                    {t('youAreHere')}
                                  </span>
                                )}
                              </h4>
                              {distLabel && !isActive && (
                                <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg ${poiUnlocked ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-300'}`}>
                                  {distLabel}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs leading-relaxed line-clamp-2 ${isActive ? 'text-primary/70' : poiUnlocked ? 'text-stone-500' : 'text-stone-300'
                              }`}>
                              {isActive ? t('youAreHere') : (getLocalizedContent(poi, 'description', locale) || t('unlockInstruction', { meters: UNLOCK_DISTANCE }))}
                            </p>
                          </div>

                          <div className="flex flex-col items-center justify-center p-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-primary text-white rotate-90 shadow-lg' : poiUnlocked ? 'bg-primary/5 text-primary' : 'text-stone-200'
                              }`}>
                              <Navigation2 className="w-5 h-5" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Final Quiz Button */}
              {!showFinalQuiz && (
                <div className="mt-8">
                  {!allPoisVisited ? (
                    <div className="w-full p-5 rounded-3xl bg-stone-100 border-2 border-dashed border-stone-200 flex flex-col items-center gap-2 text-stone-400 text-center">
                      <Lock className="w-6 h-6 mb-1 opacity-20" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t('finalChallengeLocked')}</span>
                      <span className="text-xs">{t('finalChallengeInstruction')}</span>
                    </div>
                  ) : (
                    <Button
                        className="w-full py-8 text-xl font-serif rounded-3xl shadow-xl hover:shadow-2xl transition-all"
                        onClick={() => setShowFinalQuiz(true)}
                    >
                      <Trophy className="w-6 h-6 mr-3 text-yellow-400" />
                      {t('startFinalChallenge')}
                    </Button>
                  )}
                </div>
              )}

              {showFinalQuiz && (
                <div className="mt-6">
                  <FinalRouteQuiz
                      routeId={safeLegend.id}
                      userId={currentUser?.id}
                      pois={safeLegend.pois}
                      finalQuiz={safeLegend.finalQuiz}
                      isAlreadyCompleted={finalQuizPassed}
                      onComplete={(res?: any) => {
                        if (res?.success && res.user && onUserUpdate) {
                          onUserUpdate(res.user);
                        }
                      }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Quiz Section */}
          {isUnlocked && safeLegend.manualQuiz && (
            <div className="pt-2">
              <PoiQuiz
                  poiId={safeLegend.id}
                  userId={currentUser?.id}
                  quiz={safeLegend.manualQuiz}
                  onComplete={(res) => {
                    if (res?.success && res.user && onUserUpdate) {
                      onUserUpdate(res.user);
                    }
                  }}
                  isAlreadyCompleted={!isMasterAdmin && safeLegend.userUnlocks.some((u: any) => u.userId === currentUser?.id && u.progress >= 1.0)}
              />
            </div>
          )}

          {/* System Info Footer */}
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div className="flex items-center justify-end">
              <span className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full ${network.isOnline
                ? (network.isSlowNetwork ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600')
                : 'bg-red-100 text-red-500'
                }`}>
                {network.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {network.isOnline ? (network.isSlowNetwork ? tCommon('slow') : tCommon('connected')) : tCommon('offline')}
              </span>
            </div>
          </div>
        </div>

        <div className="pb-8">
          <Button
              variant="outline"
              className="w-full py-6 border-primary text-primary hover:bg-primary/5 font-serif text-lg"
              onClick={() => onNavigate('map', safeLegend)}
          >
            <MapPin className="w-5 h-5 mr-2" />
            {t('viewOnMap')}
          </Button>
        </div>
      </div>
    </div>
  );
}
