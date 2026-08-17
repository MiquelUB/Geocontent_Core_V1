import { useGeolocation as useBaseGeolocation } from '@/hooks/useGeolocation';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  requestPermission: () => void;
  getCurrentPosition: () => void;
  watchPosition: () => void;
  stopWatching: () => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const geo = useBaseGeolocation();

  return {
    latitude: geo.location?.latitude ?? null,
    longitude: geo.location?.longitude ?? null,
    accuracy: geo.accuracy ?? null,
    error: geo.error,
    loading: geo.loading,
    requestPermission: geo.requestPermission,
    getCurrentPosition: geo.getCurrentPosition,
    watchPosition: geo.watchPosition,
    stopWatching: geo.stopWatching,
  };
}
