'use client'

import { ReactNode } from 'react'
import Image from 'next/image'

interface GameContainerProps {
  backgroundImage?: string;
  children: ReactNode;
}

export default function GameContainer({ backgroundImage = '/dashboard_complete_final_1766088117082.png', children }: GameContainerProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#F3E5C9] overflow-hidden">
      {/* 
         Game Container Refactorizado:
         1. No forzamos un aspect-ratio arbitrario (9/16) en el contenedor CSS.
         2. Dejamos que la IMAGEN dicte el tamaño.
         3. Usamos 'object-fit: contain' para asegurar que se vea 100% de la imagen sin recortes.
      */}
      <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center">
         
         {/* 
            Capa de UI (Game Box 9:16)
            Solo renderizamos ESTO. El resto es negro (letterboxing).
            Esto garantiza 1 sola imagen, sin deformación, tamaño exacto.
         */}
          <div 
            className="relative shadow-2xl overflow-hidden"
            style={{
                // Forzamos el ratio 9/16 exacto
                aspectRatio: '9/16',
                // Logica de "Contain" manual:
                // El box intentará ser tan alto como la pantalla (100dvh)
                // O tan ancho como la pantalla (100vw).
                // Pero 'aspect-ratio' limitará la otra dimensión automáticamente.
                height: '100%',
                maxHeight: '100dvh',
                width: 'auto',
                maxWidth: '100vw', 
            }}
          >
             {/* Fondo del Juego (ÚNICA VEZ QUE SE RENDERIZA) */}
             {backgroundImage && (
                <Image
                    src={backgroundImage}
                    alt="Background"
                    fill
                    className="object-contain" 
                    priority
                    draggable={false}
                />
             )}

             {/* Los hijos */}
             {children}
          </div>

      </div>
    </div>
  )
}
