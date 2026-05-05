/**
 * Constants globals de seguretat i configuració per a Geocontent Core V2.
 */

export const SECURITY_CONFIG = {
  // SEC-08: Límit de mida de fitxers (50MB)
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  
  // SEC-04: Rate Limiting
  RATE_LIMITS: {
    LOGIN: { attempts: 5, windowSeconds: 300 }, // 5 intents cada 5 minuts
    AI_GENERATE: { attempts: 10, windowSeconds: 60 }, // 10 peticions per minut
    REPORT_GENERATE: { attempts: 3, windowSeconds: 3600 }, // 3 informes per hora
  },

  // SEC-07: SSRF Protection
  ALLOWED_PROXY_HOSTS: [
    'tile.openstreetmap.org',
    // El host de S3 s'afegeix dinàmicament des d'env
  ]
};
