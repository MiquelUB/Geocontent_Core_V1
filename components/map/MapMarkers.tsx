import React from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { MapPin } from 'lucide-react';

interface MarkerData {
  id: string;
  title: string;
  latitude: number; 
  longitude: number;
  type: 'castle' | 'church' | 'cave' | 'poi';
}

interface MapMarkersProps {
  onMarkerClick?: (marker: MarkerData) => void;
}

export default function MapMarkers({ onMarkerClick }: MapMarkersProps) {
  // Mock Geospatial Data (Center around 41.1234, 1.1234 as per MapLibreMap default)
  const markers: MarkerData[] = [
    { id: '1', title: 'Castell de Mur', latitude: 41.1250, longitude: 1.1200, type: 'castle' },
    { id: '2', title: 'Sant Pere', latitude: 41.1220, longitude: 1.1280, type: 'church' },
    { id: '3', title: 'Cova del Drac', latitude: 41.1200, longitude: 1.1234, type: 'cave' },
    { id: '4', title: 'El Pozo de los Deseos', latitude: 41.1240, longitude: 1.1250, type: 'poi' } 
  ];

  const handleClick = (marker: MarkerData, e: any) => {
    e.originalEvent?.stopPropagation();
    if (onMarkerClick) onMarkerClick(marker);
  };

  return (
    <>
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          latitude={marker.latitude}
          longitude={marker.longitude}
          anchor="bottom"
          onClick={(e) => handleClick(marker, e)}
        >
             <div className="group relative flex flex-col items-center">
                {/* Pin Animado */}
                <div className={`relative flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-transform hover:scale-125 cursor-pointer ${
                    marker.type === 'poi' ? 'bg-[#a33333] border-[#7a2626]' : 'bg-[#faf8f3] border-[#8b7355]'
                } border-2`}>
                    <MapPin className={`w-6 h-6 ${marker.type === 'poi' ? 'text-white' : 'text-[#8b7355]'}`} />
                    
                    {/* Ripple Effect (Ondas) para llamar la atención */}
                    <div className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping opacity-75"></div>
                </div>

                {/* Tooltip con nombre hover */}
                <span className="absolute -top-10 bg-[#3d2817] text-[#faf8f3] text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                    {marker.title}
                </span>
            </div>
        </Marker>
      ))}
    </>
  )
}
