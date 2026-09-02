'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, WifiOff, Maximize, Minimize } from 'lucide-react';
import { useVideoCache } from '@/hooks/useVideoCache';

interface HlsVideoPlayerProps {
  /** Video URL — MP4 or HLS .m3u8 */
  src: string;
  /** Optional low-bitrate fallback URL (for HLS mode) */
  lowBitrateSrc?: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  priority?: boolean;
  onSourceChange?: (source: string) => void;
}

/**
 * Video player optimized for fast first-frame.
 *
 * MP4 files: src is set immediately in JSX — zero JS delay before browser starts streaming.
 * HLS files (.m3u8): Uses hls.js with lazy initialization (reserved for future long-form content).
 */
export default function HlsVideoPlayer({
  src,
  lowBitrateSrc,
  poster,
  className = '',
  autoPlay = false,
  muted = true,
  priority = false,
  onSourceChange,
}: HlsVideoPlayerProps) {
  // ── CDN URL helper ────────────────────────────────────────────────
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
    // Fallback proxy per a desenvolupament local sense CDN
    if (!cdnUrl && (url.includes('s3.amazonaws.com') || url.includes('s3.eu-north-1.amazonaws.com') || url.includes('pxx-core-v1') || url.includes('pxx-core-vox-v1') || url.includes('amazonaws.com'))) {
      return `/api/media-proxy?url=${encodeURIComponent(url)}`;
    }
    if (cdnUrl && url.startsWith('/') && !url.startsWith('//')) {
      return `${cdnUrl}${url}`;
    }
    return url;
  };

  const finalSrc = formatUrlForCdn(src);
  const isHls = finalSrc.includes('.m3u8');

  // ── Refs & State ──────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Background caching only (non-blocking)
  const videoCache = useVideoCache();

  // ── MP4 Fast Path: Browser downloads instantly via JSX src ────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isHls) return;

    if (video.readyState >= 1) {
      setIsLoaded(true);
    }

    const onLoaded = () => {
      setIsLoaded(true);
      setHasError(false);
      onSourceChange?.('mp4');
    };

    const onError = () => {
      setHasError(true);
      setIsLoaded(true);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
      }
    };

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('canplay', onLoaded);
    video.addEventListener('error', onError);

    // Fire-and-forget background cache for offline support
    if (finalSrc && !finalSrc.startsWith('blob:')) {
      videoCache.cacheVideo(finalSrc).catch(() => {});
    }

    return () => {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('canplay', onLoaded);
      video.removeEventListener('error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalSrc, isHls]);

  // ── HLS Path (for future .m3u8 long-form videos) ──────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isHls) return;

    const initHls = () => {
      if (finalSrc.endsWith('.m3u8') && Hls.isSupported()) {
        const hls = new Hls({
          capLevelToPlayerSize: true,
          autoStartLoad: true,
          startLevel: 0,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          enableWorker: true,
          backBufferLength: 0,
        });
        hlsRef.current = hls;
        hls.loadSource(finalSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoaded(true);
          onSourceChange?.('hls');
          if (autoPlay) video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setHasError(true);
            setIsLoaded(true);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari iOS/macOS)
        video.src = finalSrc;
        video.addEventListener('loadedmetadata', () => {
          setIsLoaded(true);
          onSourceChange?.('hls');
          if (autoPlay) video.play().catch(() => {});
        }, { once: true });
      }
    };

    if (priority) {
      initHls();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            initHls();
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(video);
      return () => observer.disconnect();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalSrc, isHls, priority]);

  // ── Offline detection (event-based, no polling) ───────────────────
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // ── Controls ──────────────────────────────────────────────────────
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
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

  return (
    <div ref={containerRef} className={`relative group overflow-hidden rounded-xl bg-black ${className}`}>
      <video
        ref={videoRef}
        // MP4 FAST PATH: src is provided immediately in JSX
        src={!isHls ? finalSrc : undefined}
        poster={poster}
        muted={isMuted}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        className={`w-full h-auto ${isFullscreen ? 'h-full max-h-screen' : 'max-h-[80vh]'} object-contain`}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Loading Overlay — only visible briefly while first buffer loads */}
      {!isLoaded && !hasError && !isOffline && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/40 backdrop-blur-sm gap-3 pointer-events-none">
          <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Offline Placeholder */}
      {isOffline && hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/80 backdrop-blur-md gap-3 p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center ring-4 ring-white/5">
            <WifiOff className="w-6 h-6 text-stone-400" />
          </div>
          <div>
            <p className="text-white/80 font-medium text-sm">Sense connexió</p>
            <p className="text-stone-400 text-[11px] mt-1 leading-snug max-w-[200px]">
              Connecta&apos;t a WiFi o xarxa mòbil per reproduir el vídeo.
            </p>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausa' : 'Reprodueix'}
            className="text-white hover:text-amber-400 transition-colors pointer-events-auto"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted ? 'Activa so' : 'Silencia'}
            className="text-white hover:text-amber-400 transition-colors pointer-events-auto"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Surt de pantalla completa' : 'Pantalla completa'}
            className="text-white hover:text-amber-400 transition-colors ml-4 pointer-events-auto"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Large Center Play Icon (Mobile Friendly) */}
      {!isPlaying && isLoaded && !isOffline && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Reprodueix vídeo"
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
