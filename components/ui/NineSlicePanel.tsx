'use client'

import { ReactNode } from 'react'

interface NineSlicePanelProps {
  children: ReactNode;
  className?: string;
  // Propiedades opcionales si queremos cambiar la imagen base en vuelo
  imageSrc?: string; 
  sliceSize?: number; // Píxeles del borde que no se estiran (default 30 aprox)
}

export default function NineSlicePanel({ 
  children, 
  className = '', 
  imageSrc = '/targeta_1.jpg', 
  sliceSize = 40 
}: NineSlicePanelProps) {
  return (
    <div 
      className={`relative p-8 ${className}`}
      style={{
        // TÉCNICA 9-SLICE CSS
        border: `${sliceSize}px solid transparent`,
        borderImageSource: `url(${imageSrc})`,
        borderImageSlice: sliceSize,
        borderImageRepeat: 'stretch', // O 'round' si el patrón lo permite
        // Aseguramos que el contenido tenga fondo (el centro de la imagen)
        backgroundClip: 'padding-box',
      }}
    >
      {/* 
         Fallback visual: Si border-image falla o para rellenar el centro si la imagen es transparente.
         En este caso confiamos en que border-image rellene el centro si 'fill' está implícito o el navegador lo soporta bien.
         Para máxima seguridad, ponemos un background color semitransparente por si acaso.
      */}
      <div className="absolute inset-0 bg-[#faf8f3]/80 -z-10 rounded-xl" />

      {/* Contenido */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  )
}
