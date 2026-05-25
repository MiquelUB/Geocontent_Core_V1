
import { useState, useEffect } from 'react';

interface Location {
  latitude: number;
  longitude: number;
}

interface GeolocationState {
  location: Location | null;
  /** true if location comes from cached last-known (not live GPS) */
  isLastKnown: boolean;
  error: string | null;
  loading: boolean;
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
  const [state, setState] = useState<GeolocationState>({
    location: loadLastKnown(), // Seed with last-known so map renders immediately
    isLastKnown: true,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setState(prev => ({ ...prev, error: 'Contexto no seguro: El GPS requiere HTTPS o localhost', loading: false }));
      return;
    }

    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocation not supported', loading: false }));
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const loc: Location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      saveLastKnown(loc); // Persist for next session / offline fallback
      setState({ location: loc, isLastKnown: false, error: null, loading: false });
    };

    const handleError = (error: GeolocationPositionError) => {
      // GPS failed — keep last-known position, just flag it
      setState(prev => ({
        ...prev,
        isLastKnown: true,
        error: error.message,
        loading: false,
      }));
    };

    const options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return state;
}

