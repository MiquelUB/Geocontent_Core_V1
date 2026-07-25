'use client'

import { useRouter } from '@/i18n/routing'
import LanguageSelector from '@/components/LanguageSelector'
import { signOut } from 'next-auth/react'

interface HeaderProps {
  visitedCount?: number
  unvisitedCount?: number
  nearbyCount?: number
  onNavigate?: (screen: string) => void
  onOpenHelp?: () => void
  brand?: any
}

export default function Header({ visitedCount = 0, unvisitedCount = 0, nearbyCount = 0, onNavigate, onOpenHelp, brand }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await signOut({ redirect: false })
    localStorage.removeItem("core_user")
    router.push('/login')
  }

  const isInterior = brand?.themeId?.toLowerCase() === 'interior';
  const textColor = isInterior ? 'text-[#2F1B0C]' : 'text-white';
  const iconColor = isInterior ? 'text-[#2F1B0C]' : 'text-white';
  const subtextColor = isInterior ? 'text-[#2F1B0C]/60' : 'text-white/60';
  const borderColor = isInterior ? 'border-[#2F1B0C]/20' : 'border-white/20';
  const bgColor = isInterior ? 'bg-[#2F1B0C]/10' : 'bg-white/10';

  return (
    <header 
      className="relative w-full shrink-0 z-[60] shadow-md"
      style={{
        backgroundColor: `hsl(var(--primary))`,
        height: '90px',
      }}
    >
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex items-center justify-between">
        {/* Left section: Municipality Logo & Name */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className={`w-12 h-12 rounded-xl ${bgColor} backdrop-blur-md border ${borderColor} p-1 flex items-center justify-center shadow-inner`}>
            {brand?.logoUrl ? (
              <img src={brand.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-white/10 animate-pulse rounded-lg" />
            )}
          </div>
          
          <div className="flex flex-col">
            <span className={`text-xs font-black ${textColor} uppercase tracking-wider leading-tight drop-shadow-sm`}>
              {brand?.name || 'Explora'}
            </span>
            <span className={`text-[9px] font-bold ${subtextColor} uppercase tracking-widest leading-none`}>
              Territori Viu
            </span>
          </div>
        </div>

        {/* Right section: Language Selector & Help */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <LanguageSelector dark={isInterior} />
          
          <button
            onClick={onOpenHelp}
            className={`w-10 h-10 flex items-center justify-center rounded-full ${bgColor} backdrop-blur-sm border ${borderColor} ${iconColor} hover:bg-white/20 transition-all active:scale-95 shadow-lg`}
            title="Ajuda"
          >
            <span className="text-xl font-bold">?</span>
          </button>
        </div>
      </div>
    </header>
  )
}
