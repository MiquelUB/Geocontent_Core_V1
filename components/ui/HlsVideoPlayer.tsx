'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Zap, HardDrive, Signal, WifiOff, Maximize, Minimize } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useVideoCache } from '@/hooks/useVideoCache';

type VideoSource = 'hls' | 'cache' | 'lowres' | 'offline';

interface HlsVideoPlayerProps {
  /** Primary HLS streaming URL (720p .m3u8) */
  src: string;
  /** Optional 480p progressive fallback URL */
  lowBitrateSrc?: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  /** Callback fired when source type changes */
  onSourceChange?: (source: VideoSource) => void;
}

/**
 * Smart video player with network-aware source switching.
 *
 * Priority chain:
 * 1. Local Cache (blob URL) → offline-safe
 * 2. Online + Fast → HLS streaming (720p)
 * 3. Online + Slow → Low-bitrate progressive (480p)
 * 4. Offline + No cache → "No connection" placeholder
 */
export default function HlsVideoPlayer({
  src,
  lowBitrateSrc,
  poster,
  className = '',
  autoPlay = false,
  muted = true,
  onSourceChange,
}: HlsVideoPlayerProps) {
  // Helpers to use CDN URL for S3 links
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || '';
  const formatUrlForCdn = (url: string | undefined): string => {
    if (!url) return '';
    if (cdnUrl && (url.includes('s3.amazonaws.com') || url.includes('s3.eu-north-1.amazonaws.com'))) {
      try {
        const urlObj = new URL(url);
        return `${cdnUrl}${urlObj.pathname}`;
      } catch (e) {
        return url;
      }
    }
    // Si és una ruta relativa (però no blob ni data), força la CDN si existeix
    if (cdnUrl && url.startsWith('/') && !url.startsWith('//')) {
      return `${cdnUrl}${url}`;
    }
    return url;
  };

  const finalSrc = formatUrlForCdn(src);
  const finalLowBitrateSrc = lowBitrateSrc ? formatUrlForCdn(lowBitrateSrc) : undefined;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeSource, setActiveSource] = useState<VideoSource>('offline');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const network = useNetworkStatus();
  const videoCache = useVideoCache();

  // Resolve the best available source
  const resolveSource = useCallback(async (): Promise<{ type: VideoSource; url: string | null }> => {
    // 1. Check local cache first (always preferred)
    const cachedUrl = await videoCache.getCachedVideoUrl(finalSrc);
    if (cachedUrl) {
      return { type: 'cache', url: cachedUrl };
    }

    // Also check lowres cache
    if (finalLowBitrateSrc) {
      const cachedLow = await videoCache.getCachedVideoUrl(finalLowBitrateSrc);
      if (cachedLow && !network.isOnline) {
        return { type: 'cache', url: cachedLow };
      }
    }

    // 2. Online + fast → HLS
    if (network.isOnline && !network.isSlowNetwork) {
      return { type: 'hls', url: finalSrc };
    }

    // 3. Online + slow → low bitrate fallback
    if (network.isOnline && network.isSlowNetwork && finalLowBitrateSrc) {
      return { type: 'lowres', url: finalLowBitrateSrc };
    }

    // 4. Online + slow but no lowres → HLS anyway (best effort)
    if (network.isOnline) {
      return { type: 'hls', url: finalSrc };
    }

    // 5. Offline + not cached
    return { type: 'offline', url: null };
  }, [finalSrc, finalLowBitrateSrc, network.isOnline, network.isSlowNetwork, videoCache]);

  // Destroy existing HLS instance
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Initialize or switch video source
  const initializePlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const { type, url } = await resolveSource();

    // No change needed
    if (type === activeSource && type !== 'offline') return;

    setIsTransitioning(true);
    destroyHls();

    if (!url) {
      setActiveSource('offline');
      setIsLoaded(false);
      setIsTransitioning(false);
      onSourceChange?.('offline');
      return;
    }

    if (type === 'hls' && url.endsWith('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        startLevel: -1, // auto quality
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoaded(true);
        setIsTransitioning(false);
        if (autoPlay) video.play();
      });

      // On network error → fallback chain
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.warn('[SmartPlayer] Network error, attempting fallback...');
          // Try low-res, then cache, then offline
          if (finalLowBitrateSrc && activeSource !== 'lowres') {
            destroyHls();
            video.src = finalLowBitrateSrc;
            setActiveSource('lowres');
            onSourceChange?.('lowres');
          }
        }
      });

      // Background: cache the video for future offline use
      videoCache.cacheVideo(finalLowBitrateSrc || finalSrc);

    } else if (type === 'hls' && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoaded(true);
        setIsTransitioning(false);
        if (autoPlay) video.play();
      }, { once: true });
      videoCache.cacheVideo(finalLowBitrateSrc || finalSrc);

    } else {
      // Progressive MP4 (cache or lowres)
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoaded(true);
        setIsTransitioning(false);
        if (autoPlay) video.play();
      }, { once: true });
    }

    setActiveSource(type);
    onSourceChange?.(type);
  }, [resolveSource, activeSource, destroyHls, autoPlay, finalLowBitrateSrc, finalSrc, onSourceChange, videoCache]);

  // Initialize on mount via IntersectionObserver (lazy)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          initializePlayer();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      destroyHls();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to network changes — switch source if needed
  useEffect(() => {
    if (isLoaded) {
      initializePlayer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network.isOnline, network.isSlowNetwork]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Source indicator config
  const sourceIndicator = {
    hls: { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/20', label: 'HQ Streaming' },
    cache: { icon: HardDrive, color: 'text-emerald-400', bg: 'bg-emerald-400/20', label: 'Offline' },
    lowres: { icon: Signal, color: 'text-orange-400', bg: 'bg-orange-400/20', label: '480p', animate: true },
    offline: { icon: WifiOff, color: 'text-red-400', bg: 'bg-red-400/20', label: 'Sense connexió' },
  };

  const indicator = sourceIndicator[activeSource];
  const IndicatorIcon = indicator.icon;

  return (
    <div ref={containerRef} className={`relative group overflow-hidden rounded-xl bg-black ${className}`}>
      <video
        ref={videoRef}
        poster={poster}
        muted={isMuted}
        playsInline
        className={`w-full h-auto ${isFullscreen ? 'h-full max-h-screen' : 'max-h-[80vh]'} object-contain`}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Loading / Transitioning Overlay */}
      {(!isLoaded || isTransitioning) && activeSource !== 'offline' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/60 backdrop-blur-sm gap-3">
          <div className="w-8 h-8 border-4 border-terracotta-500 border-t-transparent rounded-full animate-spin" />
          {isTransitioning && (
            <span className="text-white/70 text-[10px] uppercase tracking-widest font-medium animate-pulse">
              Ajustant qualitat...
            </span>
          )}
        </div>
      )}

      {/* Offline Placeholder */}
      {activeSource === 'offline' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/80 backdrop-blur-md gap-3 p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center ring-4 ring-white/5">
            <WifiOff className="w-6 h-6 text-stone-400" />
          </div>
          <div>
            <p className="text-white/80 font-medium text-sm">Sense connexió</p>
            <p className="text-stone-400 text-[11px] mt-1 leading-snug max-w-[200px]">
              Connecta&apos;t a WiFi o xarxa mòbil per reproduir el vídeo, o visita el punt amb connexió per descarregar-lo.
            </p>
          </div>
        </div>
      )}

      {/* Source Indicator Badge (top-right) */}
      {isLoaded && activeSource !== 'offline' && (
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${indicator.bg} backdrop-blur-xl border border-white/10 shadow-lg transition-all duration-500`}>
          <IndicatorIcon className={`w-3 h-3 ${indicator.color} ${'animate' in indicator && indicator.animate ? 'animate-pulse' : ''}`} />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${indicator.color}`}>
            {indicator.label}
          </span>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <div className="flex items-center justify-between">
          <button onClick={togglePlay} className="text-white hover:text-terracotta-400 transition-colors">
            {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
          </button>
          <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-terracotta-400 transition-colors">
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button onClick={toggleFullscreen} className="text-white hover:text-terracotta-400 transition-colors ml-4">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Large Center Play Icon (Mobile Friendly) */}
      {!isPlaying && isLoaded && activeSource !== 'offline' && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 hover:scale-110 transition-transform">
            <Play className="w-8 h-8 text-white fill-current ml-1" />
          </div>
        </button>
      )}
    </div>
  );
}
