import { Button } from "../ui/button";
import { Wifi, MapPin, AlertTriangle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

interface ErrorScreenProps {
  type: "no-connection" | "gps-denied" | "general";
  onRetry: () => void;
  onNavigate: (screen: string) => void;
  brand?: any;
}

export function ErrorScreen({ type, onRetry, onNavigate, brand }: ErrorScreenProps) {
  const t = useTranslations('error');
  const t_splash = useTranslations('splash');
  
  const errorConfig = {
    "no-connection": {
      icon: Wifi,
      title: t('no-connection.title'),
      message: t('no-connection.message'),
      action: t('no-connection.action'),
      color: "var(--accent)"
    },
    "gps-denied": {
      icon: MapPin,
      title: t('gps-denied.title'),
      message: t('gps-denied.message'),
      action: t('gps-denied.action'),
      color: "var(--primary)"
    },
    "general": {
      icon: AlertTriangle,
      title: t('general.title'),
      message: t('general.message'),
      action: t('general.action'),
      color: "#d4183d"
    }
  };

  const config = errorConfig[type] || errorConfig["general"];
  const Icon = config.icon;

  return (
    <div className="screen bg-background flex flex-col items-center justify-center p-6 text-center">
      {/* Header amb logo dinàmic */}
      <div className="absolute top-0 left-0 right-0 bg-primary p-4">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-8 h-8 bg-background rounded-full flex items-center justify-center">
            {brand?.logoUrl ? (
                <img src={brand.logoUrl} alt="Logo" className="w-5 h-5 object-contain" />
            ) : (
                <span className="text-sm font-serif font-bold text-primary">
                    {brand?.name?.charAt(0) || 'P'}
                </span>
            )}
          </div>
          <h1 className="text-lg font-serif font-bold text-primary-foreground">
            {brand?.name || t_splash('project')}
          </h1>
        </div>
      </div>

      <div className="space-y-6 max-w-sm mt-12 w-full">
        {/* Icona d'error */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto"
        >
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <Icon 
              className="w-10 h-10"
              style={{ color: config.color }}
            />
          </div>
        </motion.div>

        {/* Títol i missatge */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-2xl font-serif font-bold text-primary">
            {config.title}
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {config.message}
          </p>
        </motion.div>

        {/* Botons d'acció */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <Button 
            onClick={onRetry}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center space-x-2 rounded-lg py-3 font-bold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{config.action}</span>
          </Button>

          <Button 
            variant="outline"
            onClick={() => onNavigate('home')}
            className="w-full border-primary text-primary hover:bg-primary/10 rounded-lg py-3 font-bold transition-colors"
          >
            {t('backToHome')}
          </Button>
        </motion.div>

        {/* Informació adicional per GPS */}
        {type === "gps-denied" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-muted-foreground space-y-2 mt-4 text-left p-4 bg-muted/50 rounded-lg"
          >
            <p className="font-medium">{t('gps-denied.howTo')}</p>
            <ol className="text-left space-y-1">
              <li>{t('gps-denied.step1')}</li>
              <li>{t('gps-denied.step2')}</li>
              <li>{t('gps-denied.step3')}</li>
              <li>{t('gps-denied.step4')}</li>
            </ol>
          </motion.div>
        )}
      </div>

      {/* Decoració de fons */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none"></div>
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground w-full text-center">
        {t('footer')}
      </div>
    </div>
  );
}
