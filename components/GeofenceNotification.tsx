'use client'

import { useEffect, useState } from 'react'
import { Location } from '@/lib/services/geofencing-service'
import { MapPin, X } from 'lucide-react'

interface GeofenceNotificationProps {
  location: Location
  onClose: () => void
}

export default function GeofenceNotification({ location, onClose }: GeofenceNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300) // Esperar animación de salida
  }

  useEffect(() => {
    // Animación de entrada
    setIsVisible(true)

    // Auto-cerrar después de 5 segundos
    const timer = setTimeout(() => {
      handleClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg shadow-2xl p-4 max-w-sm mx-4">
        <div className="flex items-start gap-3">
          {/* Icono */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              ¡Has llegado a {location.name}!
            </h3>
            {location.description && (
              <p className="text-sm text-white/90">
                {location.description}
              </p>
            )}
            <p className="text-xs text-white/80 mt-2">
              +{location.points_value} puntos disponibles
            </p>
          </div>

          {/* Botón cerrar */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/60 rounded-full animate-progress"
            style={{ animation: 'progress 5s linear' }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}
