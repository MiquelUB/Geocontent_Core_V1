'use client';

import { useState, useEffect } from 'react';

export function useOnboarding(canAutoOpen: boolean = true) {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true); // Start as true to avoid flash
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has seen onboarding
    const seen = localStorage.getItem('hasSeenOnboarding_v2');
    setHasSeenOnboarding(!!seen);
    setIsLoading(false);

    // Show onboarding on first visit after a small delay, ONLY if we're allowed to trigger now
    if (!seen && canAutoOpen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500); // 500ms delay for better UX

      return () => clearTimeout(timer);
    }
  }, [canAutoOpen]);

  const completeOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding_v2', 'true');
    setHasSeenOnboarding(true);
    setIsOpen(false);
  };

  const skipOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding_v2', 'true');
    setHasSeenOnboarding(true);
    setIsOpen(false);
  };

  const reopenOnboarding = () => {
    setIsOpen(true);
  };

  return {
    isOpen,
    isLoading,
    hasSeenOnboarding,
    completeOnboarding,
    skipOnboarding,
    reopenOnboarding,
  };
}
