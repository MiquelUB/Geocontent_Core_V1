'use client'

import { Location } from '@/lib/services/geofencing-service'
import { MapPin, Award } from 'lucide-react'

interface ActiveGeofencesListProps {
  geofences: Location[]
}

export default function ActiveGeofencesList({ geofences }: ActiveGeofencesListProps) {
  if (geofences.length === 0) {
    return null
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
      <div className="max-w-sm mx-auto pointer-events-auto">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">
              Estás en {geofences.length} {geofences.length === 1 ? 'ubicación' : 'ubicaciones'}
            </h3>
          </div>

          <div className="space-y-2">
            {geofences.map((geofence) => (
              <div
                key={geofence.id}
                className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{geofence.name}</p>
                  {geofence.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {geofence.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-blue-600">
                  <Award className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    {geofence.points_value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
