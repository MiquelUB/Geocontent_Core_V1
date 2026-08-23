import { useState, useEffect, useCallback, useRef } from 'react';

interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

interface GeolocationState {
  location: Location | null;
  /** true if location comes from cached last-known (not live GPS) */
  isLastKnown: boolean;
  error: string | null;
  loading: boolean;
  accuracy: number | null;
}

const LAST_KNOWN_KEY = 'pxx-last-known-location';

function loadLastKnown(): Location | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_KNOWN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastKnown(loc: Location) {
  try {
    localStorage.setItem(LAST_KNOWN_KEY, JSON.stringify(loc));
  } catch { /* storage full — non-fatal */ }
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>(() => {
    const lastKnown = loadLastKnown();
    return {
      location: lastKnown,
      isLastKnown: true,
      error: null,
      loading: true,
      accuracy: null,
    };
  });

  const watchIdRef = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const loc: Location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
    saveLastKnown(loc);
    
    setState(prev => {
      // Check if coordinates are effectively the same (~5 meters) to avoid useless re-renders.
      // We completely ignore accuracy fluctuations because mobile GPS accuracy bounces every second!
      if (prev.location) {
        const latDiff = Math.abs(prev.location.latitude - loc.latitude);
        const lngDiff = Math.abs(prev.location.longitude - loc.longitude);
        
        if (latDiff < 0.00005 && lngDiff < 0.00005) {
          if (!prev.loading && !prev.error && !prev.isLastKnown) {
            return prev; // No meaningful movement, skip React state update
          }
        }
      }
      return {
        location: loc,
        isLastKnown: false,
        error: null,
        loading: false,
        accuracy: position.coords.accuracy,
      };
    });
  }, []);

  const startWatching = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (!window.isSecureContext) {
      setState(prev => ({ ...prev, error: 'Contexto no seguro: El GPS requiere HTTPS', loading: false }));
      return;
    }

    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocalización no soportada', loading: false }));
      return;
    }

    stopWatching();
    setState(prev => ({ ...prev, loading: true }));

    // Strategy 1: Instant low-accuracy fix (cell/Wi-Fi, 5s timeout, maximumAge 30s) so map renders immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => handleSuccess(pos),
      (err) => console.warn("[GPS] Fast location lookup fallback warning:", err.message),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
    );

    // Strategy 2: High-accuracy watch with automatic low-accuracy fallback on hardware timeout
    let highAccuracyFailed = false;

    const highAccuracyOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    };

    const lowAccuracyOptions = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 10000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => handleSuccess(pos),
      (error) => {
        console.warn("[GPS] watchPosition notice:", error.code, error.message);
        
        // If high accuracy times out or fails (and hasn't tried low accuracy yet), fallback to low accuracy!
        if (!highAccuracyFailed && (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)) {
          highAccuracyFailed = true;
          console.log("[GPS] Falling back to low-accuracy network geolocation...");
          stopWatching();
          watchIdRef.current = navigator.geolocation.watchPosition(
            handleSuccess,
            (fallbackErr) => {
              setState(prev => ({
                ...prev,
                isLastKnown: true,
                error: fallbackErr.code === fallbackErr.PERMISSION_DENIED
                  ? 'Permiso de ubicación denegado.'
                  : fallbackErr.message,
                loading: false,
              }));
            },
            lowAccuracyOptions
          );
        } else {
          setState(prev => ({
            ...prev,
            isLastKnown: true,
            error: error.code === error.PERMISSION_DENIED
              ? 'Permiso de ubicación denegado.'
              : error.message,
            loading: false,
          }));
        }
      },
      highAccuracyOptions
    );
  }, [handleSuccess, stopWatching]);

  useEffect(() => {
    startWatching();

    // Listen for permission status changes (e.g. user taps "Allow" after prompt)
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((status) => {
        status.onchange = () => {
          console.log("[GPS] Permission status changed:", status.state);
          if (status.state === 'granted') {
            startWatching();
          }
        };
      }).catch(() => { /* permissions API not fully supported in all browsers */ });
    }

    return () => {
      stopWatching();
    };
  }, [startWatching, stopWatching]);

  return {
    ...state,
    refreshLocation: startWatching,
    requestPermission: startWatching,
    getCurrentPosition: startWatching,
    watchPosition: startWatching,
    stopWatching,
  };
}
