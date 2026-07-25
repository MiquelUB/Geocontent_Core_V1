'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function OnboardingModal({ isOpen, onComplete, onSkip, onNavigate }: OnboardingModalProps) {
  const t = useTranslations('onboarding');
  const t_common = useTranslations('common');

  if (!isOpen) return null;

  const handleStart = () => {
    onComplete();
    if (onNavigate) {
      onNavigate('map');
    }
  };

  const InstructionItem = ({ title, desc }: { title: string, desc: string }) => (
    <div className="flex flex-col space-y-1">
      <h3 className="font-serif text-base font-bold tracking-tight text-foreground">{title}</h3>
      <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );

  return (
    <div className="fixed top-[90px] bottom-[95px] inset-x-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto">
      <div className="relative w-full max-w-md max-h-full h-auto bg-background border border-primary/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-primary/10 bg-background/95 backdrop-blur-md z-10 shrink-0">
          <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tighter text-primary">
            {t('title')}
          </h2>
          <button
            onClick={onSkip}
            className="p-1.5 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-colors text-secondary"
            aria-label={t_common('close')}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrolling Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 scrollbar-thin scrollbar-thumb-primary/20">
          <div className="space-y-4 sm:space-y-5">
            <InstructionItem
              title={t('items.parking.title')}
              desc={t('items.parking.desc')}
            />

            <InstructionItem
              title={t('items.silence.title')}
              desc={t('items.silence.desc')}
            />

            <InstructionItem
              title={t('items.offline.title')}
              desc={t('items.offline.desc')}
            />

            <InstructionItem
              title={t('items.timeslider.title')}
              desc={t('items.timeslider.desc')}
            />

            <InstructionItem
              title={t('items.legacy.title')}
              desc={t('items.legacy.desc')}
            />

            <InstructionItem
              title={t('items.gps.title')}
              desc={t('items.gps.desc')}
            />
          </div>
        </div>

        {/* Footer actions - Fixed */}
        <div className="p-4 sm:p-5 pt-3 bg-background border-t border-primary/10 z-10 shrink-0">
          <button
            onClick={handleStart}
            className="w-full py-3 px-5 font-serif font-bold text-sm sm:text-base tracking-widest text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-md uppercase"
          >
            {t('start')}
          </button>
        </div>
      </div>
    </div>
  );
}
