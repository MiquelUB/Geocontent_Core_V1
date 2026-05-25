'use client'

import Image from 'next/image'
import { ReactNode } from 'react'

interface AbsoluteSpriteProps {
  x: number;
  y: number;
  width: number;
  // height?: number; // Opcional, si queremos forzar height para hitboxes 
  
  src: string; // Si es "" se renderiza invisible (hitbox)
  alt: string;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
  
  // Nuevo: altura específica para hitboxes (en % del alto del contenedor, o aspect ratio)
  // Para simplificar, usaremos un div vacío con aspect ratio o height manual si no hay imagen
  height?: number; 
}

export default function AbsoluteSprite({ 
  x, 
  y, 
  width, 
  height,
  src, 
  alt, 
  onClick, 
  className = '',
  children 
}: AbsoluteSpriteProps) {
  
  const isHitbox = !src; // Si no hay source, es un hitbox transparente

  return (
    <div
      onClick={onClick}
      className={`absolute z-20 cursor-pointer select-none transition-transform active:scale-95 ${className} ${isHitbox ? 'bg-red-500/0 hover:bg-white/10' : 'hover:brightness-110'}`} // Debug: hover brillante para hitboxes
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: height ? `${height}%` : 'auto', // Si es hitbox, necesita altural manual
      }}
    >
      <div className="relative w-full h-full">
         
         {!isHitbox && (
             <Image 
               src={src} 
               alt={alt}
               width={500} 
               height={500}
               className="w-full h-auto object-contain pointer-events-none" 
               priority 
             />
         )}
         
         {/* Para hitboxes, el div padre ya tiene dimensiones. No renderizamos nada más. */}
         
         {children && (
            <div className="absolute inset-0 flex items-center justify-center text-center pointer-events-none">
                {children}
            </div>
         )}
      </div>
    </div>
  )
}
