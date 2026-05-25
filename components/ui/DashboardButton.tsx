'use client'

import { DashboardButtonConfig, getIconByName } from '@/lib/config/dashboard-data';

interface DashboardButtonProps {
  config: DashboardButtonConfig;
  onClick: (config: DashboardButtonConfig) => void;
}

export default function DashboardButton({ config, onClick }: DashboardButtonProps) {
  const IconComponent = config.iconName ? getIconByName(config.iconName) : null;
  
  // Estilos base Art Nouveau
  const baseStyles = "relative flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-300 group overflow-hidden";
  
  // Variantes de diseño (por si queremos botones dorados, rojos, etc)
  const variants = {
    default: "bg-[#faf8f3]/90 hover:bg-[#fffcf5] border-2 border-[#8b7355] hover:border-[#ad8f67] shadow-md hover:shadow-xl",
    gold: "bg-gradient-to-br from-[#c17817] to-[#8b5e1e] text-[#faf8f3] border-2 border-[#5c3d10] shadow-lg hover:brightness-110",
    danger: "bg-red-900/90 text-white border-2 border-red-700"
  };

  const selectedVariant = variants[config.designVariant || 'default'];

  return (
    <button
      onClick={() => onClick(config)}
      className={`${baseStyles} ${selectedVariant} min-h-[140px] w-full`}
    >
      {/* Efecto de brillo interior (pseudo-shine) común en botones de juegos */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Icono */}
      <div className="mb-3 transform group-hover:scale-110 transition-transform duration-300">
        {IconComponent ? (
           <IconComponent 
             className={`w-10 h-10 ${config.designVariant === 'gold' ? 'text-white' : 'text-[#8b7355]'}`} 
             strokeWidth={1.5}
           />
        ) : (
          // Fallback por si no hay icono definido
          <div className="w-10 h-10 bg-gray-300 rounded-full" />
        )}
      </div>

      {/* Etiqueta */}
      <span 
        className={`text-sm font-bold tracking-wide uppercase ${config.designVariant === 'gold' ? 'text-white' : 'text-[#3d2817]'}`}
        style={{ fontFamily: '"Cinzel", serif' }}
      >
        {config.label}
      </span>
      
      {/* Decoración esquinas (opcional, muy Art Nouveau) */}
      {config.designVariant === 'default' && (
        <>
            <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[#8b7355]/50" />
            <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-[#8b7355]/50" />
            <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#8b7355]/50" />
            <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#8b7355]/50" />
        </>
      )}
    </button>
  )
}
