import { useState, useEffect, useCallback } from 'react'
import { geofencingService, Location, GeofenceEvent } from '@/lib/services/geofencing-service'
import { circle } from '@turf/turf'
import { getLegends } from "@/lib/actions/queries";

interface UseGeofencingReturn {
  activeGeofences: Location[]
  loading: boolean
  error: string | null
  checkPosition: (latitude: number, longitude: number) => void
}

export function useGeofencing(
  latitude: number | null,
  longitude: number | null
): UseGeofencingReturn {
  const [activeGeofences, setActiveGeofences] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar geocercas sincronizadas con las rutas oficiales
  useEffect(() => {
    async function loadGeofences() {
      console.log(`🔍 useGeofencing v1.1.0 [${new Date().toLocaleTimeString()}]: Syncing...`);
      try {
        setLoading(true)
        
        // Obtenim les rutes oficials igual que la HomeScreen
        const routes = await getLegends();
        const allPois = routes.flatMap(r => r.pois);

        if (allPois.length > 0) {
          // Convertir punts amb radi a format de geofencing (cercle de 50m)
          const locations: Location[] = allPois.map((loc: any) => {
            let zoneData = null;
            
            if (loc.latitude && loc.longitude) {
              const c = circle([loc.longitude, loc.latitude], 0.05, { units: 'kilometers' });
              zoneData = c.geometry;
            }

            return {
              id: loc.id,
              name: loc.title || 'Punt d\'interès',
              description: loc.description,
              zone: zoneData as any,
              active: true,
              points_value: loc.quiz_xp_reward || 100,
            }
          }).filter((l: any) => l.zone);

          console.log(`✅ Loaded ${locations.length} valid geofences from official routes.`);
          geofencingService.loadGeofences(locations)
        }

        setError(null)
      } catch (err) {
        console.error('Error loading geofences:', err)
        setError('Error al cargar las geocercas')
      } finally {
        setLoading(false)
      }
    }

    loadGeofences()
  }, [])

  // Verificar posición cuando cambia la ubicación
  const checkPosition = useCallback((lat: number, lon: number) => {
    const active = geofencingService.checkPosition(lat, lon)
    setActiveGeofences(active)
  }, [])

  // Auto-verificar cuando cambia la ubicación del usuario
  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      checkPosition(latitude, longitude)
    }
  }, [latitude, longitude, checkPosition])

  // Configurar callbacks para eventos de entrada/salida
  useEffect(() => {
    const handleEnter = (event: GeofenceEvent) => {
      // Handled in page.tsx
    }

    const handleExit = (event: GeofenceEvent) => {
      // Handled in page.tsx
    }

    geofencingService.onEnter(handleEnter)
    geofencingService.onExit(handleExit)

    return () => {
      geofencingService.reset()
    }
  }, [])

  return {
    activeGeofences,
    loading,
    error,
    checkPosition,
  }
}
