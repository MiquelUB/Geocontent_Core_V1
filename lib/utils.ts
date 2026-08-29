import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extreu el nom del fitxer d'una URL de S3, eliminant l'UUID si existeix.
 */
export function parseS3Filename(url: string | null | undefined): string {
  if (!url) return '';
  try {
    // 1. Obtenir només l'última part de la URL (després de l'últim '/')
    // i treure paràmetres de consulta (després de '?')
    let baseName = url.split('/').pop()?.split('?')[0] || url;
    
    // 2. Descodificar caràcters com %20 (espais)
    baseName = decodeURIComponent(baseName);
    
    // 3. Eliminar prefix UUIDv4 si existeix (ex: 123e4567-e89b-12d3-a456-426614174000_nom_fitxer.mp4)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i.test(baseName)) {
      baseName = baseName.substring(37);
    }
    
    return baseName;
  } catch (e) {
    return url;
  }
}

