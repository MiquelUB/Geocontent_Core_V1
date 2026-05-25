import { Home, BookOpen, Map as MapIcon, User } from "lucide-react";
import { useTranslations } from "next-intl";

interface BottomNavigationProps {
  currentScreen: string;
  onScreenChange: (screen: string) => void;
}

export function BottomNavigation({ currentScreen, onScreenChange }: BottomNavigationProps) {
  const t = useTranslations('nav');
  
  const navItems = [
    {
      id: "home",
      label: t('home'),
      icon: Home,
    },
    {
      id: "legends",
      label: t('legends'),
      icon: BookOpen,
    },
    {
      id: "map",
      label: t('map'),
      icon: MapIcon,
    },
    {
      id: "profile",
      label: t('profile'),
      icon: User,
    },
  ];

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center gap-2 shadow-2xl z-50 mx-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onScreenChange(item.id)}
            className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${isActive
              ? "bg-white text-black scale-110 shadow-lg"
              : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
          >
            <Icon size={20} className={isActive ? "stroke-[2.5px]" : "stroke-[1.5px]"} />
            {isActive && (
              <span className="absolute -bottom-8 text-[10px] font-medium text-black bg-white px-2 py-0.5 rounded-md opacity-0 animate-in fade-in slide-in-from-top-1 hidden">
                {item.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
