'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname, routing } from '@/i18n/routing';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Languages, Check } from 'lucide-react';

interface LanguageSelectorProps {
  dark?: boolean;
}

export default function LanguageSelector({ dark = false }: LanguageSelectorProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const textColor = dark ? 'text-[#2F1B0C]' : 'text-white';
  const bgColor = dark ? 'bg-[#2F1B0C]/10' : 'bg-white/10';
  const borderColor = dark ? 'border-[#2F1B0C]/20' : 'border-white/20';

  const languages = [
    { code: 'ca', name: 'Català' },
    { code: 'es', name: 'Castellano' },
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' }
  ];

  const handleLanguageChange = (newLocale: string) => {
    setIsOpen(false);
    // @ts-ignore
    router.push(pathname, { locale: newLocale });
  };

  return (
    <div className="relative z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${bgColor} backdrop-blur-md border ${borderColor} p-2 rounded-full hover:bg-white/20 transition-all`}
        aria-label="Change language"
      >
        <Languages size={20} className={textColor} />
        <span className={`text-[12px] font-bold ${textColor} uppercase`}>{locale}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-transparent"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10, x: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10, x: -20 }}
              className="absolute right-0 mt-2 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 overflow-hidden"
            >
              <div className="flex flex-col gap-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                      locale === lang.code 
                        ? 'bg-white/20 text-white' 
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold uppercase w-6 text-center text-white/80">{lang.code}</span>
                      <span className="text-sm font-medium">{lang.name}</span>
                    </div>
                    {locale === lang.code && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
