import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { PxxConfig } from "@/projects/active/config";
import { useTranslations } from "next-intl";

interface SplashScreenProps {
  onComplete: () => void;
  brand?: any;
}

export function SplashScreen({ onComplete, brand }: SplashScreenProps) {
  const t = useTranslations('splash');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete; // always up-to-date without re-triggering effect

  useEffect(() => {
    const splashDuration = process.env.NODE_ENV === 'development' ? 800 : 3000;
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, splashDuration);

    return () => clearTimeout(timer);
  }, []); // ← runs only ONCE on mount


  return (
    <div className="h-full flex flex-col items-center justify-center bg-primary relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-background"></div>
        <div className="absolute bottom-20 right-8 w-24 h-24 rounded-full bg-secondary"></div>
        <div className="absolute top-1/3 right-16 w-16 h-16 rounded-full bg-background"></div>
      </div>

      <div className="flex flex-col items-center space-y-8 z-10">
        {/* Logo principal */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 1,
            ease: "easeOut"
          }}
          className="text-center"
        >
          <div className="mb-4">
            <motion.div
              initial={{ rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{
                duration: 1.5,
                delay: 0.2,
                ease: "easeOut"
              }}
              className="w-24 h-24 mx-auto mb-6 bg-background rounded-full flex items-center justify-center shadow-lg"
            >
              {brand?.logoUrl ? (
                <img src={brand.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
              ) : (
                <img src="/logo_web.png" alt="Logo default" className="w-full h-full object-contain p-4" />
              )}
            </motion.div>
          </div>

          {brand?.name ? (
            <>
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.5
                }}
                className="text-4xl font-serif font-bold text-primary-foreground mb-2"
              >
                {brand.name}
              </motion.h1>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.7
                }}
                className="text-lg text-primary-foreground/80"
              >
                {brand.description || PxxConfig.appDescription}
              </motion.p>
            </>
          ) : (
            <div className="h-12 w-48 bg-white/10 animate-pulse rounded-full mt-4" />
          )}
        </motion.div>

        {/* Indicador de càrrega */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.5,
            delay: 1.5
          }}
          className="flex flex-col items-center space-y-4"
        >
          <div className="flex space-x-2">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-3 h-3 bg-background rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: index * 0.2,
                }}
              />
            ))}
          </div>
          <p className="text-sm text-primary-foreground/60">{t('loading')}</p>
        </motion.div>
      </div>

      {/* Elements decoratius */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          duration: 0.8,
          delay: 2
        }}
      >
        <div className="flex items-center space-x-2 text-primary-foreground/40 text-[10px] tracking-[0.2em] font-serif italic uppercase">
          <span>{t('project')}</span>
        </div>
      </motion.div>
    </div>
  );
}
