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
    <div className="bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-pallars-cream border-t border-pallars-green/20 flex flex-row justify-around items-center z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onScreenChange(item.id)}
            className={`flex flex-col items-center justify-center gap-1 touch-target rounded-lg transition-all duration-200 ${
              isActive 
                ? "text-pallars-green bg-pallars-green/10 scale-105" 
                : "text-pallars-brown hover:text-pallars-green hover:bg-pallars-green/5"
            }`}
          >
            <Icon size={20} />
            <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
              {item.label}
            </span>
            {isActive && (
              <div className="w-4 h-0.5 bg-pallars-green rounded-full"></div>
            )}
          </button>
        );
      })}
    </div>
  );
}
