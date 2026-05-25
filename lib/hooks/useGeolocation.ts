import { useState, useEffect, useCallback } from 'react'

interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  loading: boolean
}

interface UseGeolocationReturn extends GeolocationState {
  requestPermission: () => void
  getCurrentPosition: () => void
  watchPosition: () => void
  stopWatching: () => void
}

export function useGeolocation(): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  })

  const [watchId, setWatchId] = useState<number | null>(null)

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      error: null,
      loading: false,
    })
  }, [])

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Error desconocido'
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permiso de geolocalización denegado. Por favor, habilita la ubicación en tu navegador.'
        break
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Ubicación no disponible. Verifica tu conexión GPS.'
        break
      case error.TIMEOUT:
        errorMessage = 'Tiempo de espera agotado al obtener la ubicación.'
        break
    }

    setState(prev => ({
      ...prev,
      error: errorMessage,
      loading: false,
    }))
  }, [])

  const requestPermission = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Tu navegador no soporta geolocalización.',
        loading: false,
      }))
      return
    }

    setState(prev => ({ ...prev, loading: true }))
    
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [handleSuccess, handleError])

  const getCurrentPosition = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Tu navegador no soporta geolocalización.',
      }))
      return
    }

    setState(prev => ({ ...prev, loading: true }))

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [handleSuccess, handleError])

  const watchPosition = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Tu navegador no soporta geolocalización.',
      }))
      return
    }

    setState(prev => ({ ...prev, loading: true }))

    const id = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )

    setWatchId(id)
  }, [handleSuccess, handleError])

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }, [watchId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  return {
    ...state,
    requestPermission,
    getCurrentPosition,
    watchPosition,
    stopWatching,
  }
}
