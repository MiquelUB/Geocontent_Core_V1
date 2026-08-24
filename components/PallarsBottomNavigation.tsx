import { Home, BookOpen, Map as MapIcon, User } from "lucide-react";

interface PallarsBottomNavigationProps {
  currentScreen: string;
  onScreenChange: (screen: string) => void;
}

export function PallarsBottomNavigation({ currentScreen, onScreenChange }: PallarsBottomNavigationProps) {
  const navItems = [
    {
      id: "home",
      label: "Inici",
      icon: Home,
    },
    {
      id: "legends",
      label: "Llegendes",
      icon: BookOpen,
    },
    {
      id: "map",
      label: "Mapa",
      icon: MapIcon,
    },
    {
      id: "profile",
      label: "Perfil",
      icon: User,
    },
  ];

  return (
    <div className="bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-[#F9F7F2] dark:bg-[#151c19] border-t border-primary/20 flex flex-row justify-around items-center z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onScreenChange(item.id)}
            className={`flex flex-col items-center justify-center gap-1 touch-target rounded-lg transition-all duration-200 ${
              isActive 
                ? "text-primary bg-primary/10 scale-105" 
                : "text-stone-500 hover:text-primary hover:bg-primary/5"
            }`}
          >
            <Icon size={20} />
            <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
              {item.label}
            </span>
            {isActive && (
              <div className="w-4 h-0.5 bg-primary rounded-full"></div>
            )}
          </button>
        );
      })}
    </div>
  );
}
