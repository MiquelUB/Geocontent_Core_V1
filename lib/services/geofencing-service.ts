import { point, polygon } from '@turf/helpers'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

export interface Location {
  id: string
  name: string
  description: string | null
  zone: string | { type: string; coordinates: number[][][] } // GeoJSON Polygon or WKT string
  active: boolean
  points_value: number
}

export interface GeofenceEvent {
  location: Location
  entered: boolean
  timestamp: Date
}

export class GeofencingService {
  private locations: Location[] = []
  private currentGeofences: Set<string> = new Set()
  private onEnterCallbacks: ((event: GeofenceEvent) => void)[] = []
  private onExitCallbacks: ((event: GeofenceEvent) => void)[] = []

  /**
   * Cargar geocercas en memoria
   */
  loadGeofences(locations: Location[]) {
    this.locations = locations.filter(loc => loc.active)
  }

  /**
   * Verificar si una posición está dentro de alguna geocerca
   */
  checkPosition(latitude: number, longitude: number): Location[] {
    const userPoint = point([longitude, latitude])
    const activeGeofences: Location[] = []

    for (const location of this.locations) {
      try {
        // Convertir zone a GeoJSON Polygon si es necesario
        let poly
        
        if (typeof location.zone === 'string') {
          // Si es WKT (Well-Known Text) de PostGIS
          poly = this.wktToGeoJSON(location.zone)
        } else if (location.zone.type === 'Polygon') {
          // Si ya es GeoJSON
          poly = polygon(location.zone.coordinates)
        } else {
          console.warn(`Formato de zona no reconocido para ${location.name}`)
          continue
        }

        // Verificar si el punto está dentro del polígono
        if (booleanPointInPolygon(userPoint, poly)) {
          activeGeofences.push(location)

          // Detectar entrada en nueva geocerca
          if (!this.currentGeofences.has(location.id)) {
            this.currentGeofences.add(location.id)
            this.triggerEnter(location)
          }
        } else {
          // Detectar salida de geocerca
          if (this.currentGeofences.has(location.id)) {
            this.currentGeofences.delete(location.id)
            this.triggerExit(location)
          }
        }
      } catch (error) {
        console.error(`Error procesando geocerca ${location.name}:`, error)
      }
    }

    return activeGeofences
  }

  /**
   * Obtener geocercas activas actualmente
   */
  getActiveGeofences(): Location[] {
    return this.locations.filter(loc => this.currentGeofences.has(loc.id))
  }

  /**
   * Registrar callback para evento de entrada
   */
  onEnter(callback: (event: GeofenceEvent) => void) {
    this.onEnterCallbacks.push(callback)
  }

  /**
   * Registrar callback para evento de salida
   */
  onExit(callback: (event: GeofenceEvent) => void) {
    this.onExitCallbacks.push(callback)
  }

  /**
   * Disparar evento de entrada
   */
  private triggerEnter(location: Location) {
    const event: GeofenceEvent = {
      location,
      entered: true,
      timestamp: new Date(),
    }

    this.onEnterCallbacks.forEach(callback => callback(event))
  }

  /**
   * Disparar evento de salida
   */
  private triggerExit(location: Location) {
    const event: GeofenceEvent = {
      location,
      entered: false,
      timestamp: new Date(),
    }

    this.onExitCallbacks.forEach(callback => callback(event))
  }

  /**
   * Convertir WKT (Well-Known Text) a GeoJSON
   * PostGIS devuelve geometrías en formato WKT
   */
  private wktToGeoJSON(wkt: string) {
    // Implementación básica para POLYGON
    // En producción, considera usar una librería como wellknown
    if (wkt.startsWith('POLYGON')) {
      const coordsStr = wkt.match(/\(\(([^)]+)\)\)/)?.[1]
      if (!coordsStr) throw new Error('WKT inválido')

      const coordinates = coordsStr.split(',').map(pair => {
        const [lon, lat] = pair.trim().split(' ').map(Number)
        return [lon, lat]
      })

      return polygon([coordinates])
    }

    throw new Error('Formato WKT no soportado')
  }

  /**
   * Limpiar estado
   */
  reset() {
    this.currentGeofences.clear()
    this.onEnterCallbacks = []
    this.onExitCallbacks = []
  }
}

// Instancia singleton
export const geofencingService = new GeofencingService()
