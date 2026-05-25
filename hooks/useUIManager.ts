import { useState, useCallback } from 'react';
import { DashboardButtonConfig } from '@/lib/config/dashboard-data';

// El estado del Stack de UI
// Es un array donde el último elemento es el que está "arriba" (visible e interactivo)
type UIStack = DashboardButtonConfig[];

export interface UIManagerHook {
  stack: UIStack;
  activeScreen: DashboardButtonConfig | null; // El que está arriba del todo
  openScreen: (config: DashboardButtonConfig) => void;
  closeScreen: () => void; // Cierra el top
  closeAll: () => void; // Vuelve al dashboard base
}

export function useUIManager(): UIManagerHook {
  const [stack, setStack] = useState<UIStack>([]);

  // 1. Abrir una nueva pantalla (Push to stack)
  const openScreen = useCallback((config: DashboardButtonConfig) => {
    console.log('UIManager: Opening screen', config.label);
    setStack((prev) => [...prev, config]);
  }, []);

  // 2. Cerrar la pantalla actual (Pop from stack)
  const closeScreen = useCallback(() => {
    console.log('UIManager: Closing top screen');
    setStack((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  // 3. Reset total (Home)
  const closeAll = useCallback(() => {
    setStack([]);
  }, []);

  // Helper para saber quién es el activo
  const activeScreen = stack.length > 0 ? stack[stack.length - 1] : null;

  return {
    stack,
    activeScreen,
    openScreen,
    closeScreen,
    closeAll
  };
}
