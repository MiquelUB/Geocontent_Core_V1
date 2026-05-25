'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, History, Maximize, Minimize } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface ImageSliderProps {
  images: string[];
  isRecapture?: boolean;
}

export default function ImageSlider({ images: rawImages, isRecapture = false }: ImageSliderProps) {
  const images = (rawImages || []).filter((url) => !!url && url.trim() !== '');
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  if (images.length === 0) {
    return (
      <div className="w-full h-full bg-stone-900 flex items-center justify-center text-stone-500 text-sm">
        Cap imatge disponible
      </div>
    );
  }

  const next = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div ref={containerRef} className={`relative w-full h-full group bg-stone-950 overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}>
      {/* Recapture Badge */}
      {isRecapture && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-amber-700/90 text-white text-xs font-bold rounded-full backdrop-blur-sm">
          <History size={14} />
          RECUPERACIÓ HISTÒRICA
        </div>
      )}

      {/* Images — cross-fade */}
      {images.map((imgUrl, i) => (
        <img
          key={i}
          src={imgUrl}
          alt={`Imatge ${i + 1}`}
          className={`absolute inset-0 w-full h-full ${isFullscreen ? 'object-contain' : 'object-contain'} transition-opacity duration-700 ${i === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
        />
      ))}

      {/* Navigation arrows — show on hover */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={22} />
          </button>

          {/* Fullscreen toggle button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>

          {/* Dots */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`rounded-full transition-all duration-300 ${i === currentIndex ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/50'
                  }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
