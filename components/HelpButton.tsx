'use client';

import { HelpCircle } from 'lucide-react';

interface HelpButtonProps {
  onOpenOnboarding: () => void;
}

export function HelpButton({ onOpenOnboarding }: HelpButtonProps) {
  return (
    <button
      onClick={onOpenOnboarding}
      className="fixed bottom-20 right-4 z-40 p-3 bg-blue-600 dark:bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-300 hover:scale-110"
      title="Ajuda"
      aria-label="Obrir tutorial"
    >
      <HelpCircle className="w-6 h-6" />
    </button>
  );
}
