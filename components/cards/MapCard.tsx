'use client'

import { useState } from 'react'
import Card from './Card'
import MapLibreMap from '../map/MapLibreMap'
import { Maximize2 } from 'lucide-react'

interface MapCardProps {
  location: {
    lat: number
    lng: number
    label: string
  }
}

export default function MapCard({ location }: MapCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <MapLibreMap
          center={[location.lng, location.lat]}
          zoom={13}
          className="h-full w-full"
        />
        <button
          onClick={() => setIsExpanded(false)}
          className="absolute top-4 right-4 bg-white text-gray-900 p-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <Card className="relative overflow-hidden h-64">
      <MapLibreMap
        center={[location.lng, location.lat]}
        zoom={13}
        className="h-full w-full"
      />
      <button
        onClick={() => setIsExpanded(true)}
        className="absolute bottom-4 right-4 bg-white text-blue-600 p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors"
        title="Expandir mapa"
      >
        <Maximize2 className="w-5 h-5" />
      </button>
    </Card>
  )
}
