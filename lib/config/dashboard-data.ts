import { LucideIcon } from 'lucide-react';
import { Video, FileText, Map, Globe, Image as ImageIcon } from 'lucide-react';

export type ScreenType = 
  | 'VIDEO' 
  | 'TEXT'
  | 'WEB' 
  | 'MAP' 
  | 'LEGEND_LIST'
  | 'PROXIMITY_ALERT'
  | 'MENU';

export interface GameButtonConfig {
  id: string;
  label: string;
  actionType: ScreenType;
  payload: string; 
  position: { x: number; y: number }; // % del lienzo
  width: number; // % del ancho
  height?: number; // % del alto
  imageSrc: string; // "" = Hitbox
  iconName?: string;
  designVariant?: 'default' | 'gold' | 'danger';
}

// ==========================================
// HITBOXES ALINEADOS A LA IMAGEN (3 Botones Circulares)
// ==========================================
// Visualmente botones están abajo, centrados horizontalmente.
// Estimación de coordenadas basada en screenshot cuadrado.
// X: 20% (Izq), 50% (Centro), 80% (Der) aprox.
// Y: ~75-85% (Parte inferior de la imagen cuadrada)

// Ajuste Fino: Como el contenedor es 9:16 pero la imagen es cuadrada (contain),
// la imagen ocupa la zona central vertical.
// Si Y=0 es top del contenedor 9:16 y Y=100 es bottom, la imagen vive entre Y=25 y Y=75 (aprox).
// Por tanto, los botones (parte baja de la imagen) deben estar en Y ~ 70%.

const HITBOX_Y = 70; // Posición vertical en el CANVAS 9:16 (ajustado para imagen cuadrada centrada)
const HITBOX_SIZE = 18; // Ancho %

export const MAIN_DASHBOARD_CONFIG: GameButtonConfig[] = [
  {
    id: 'btn_leyendas', // Libro (Izq) -> Leyendas
    label: 'Leyendas',
    actionType: 'LEGEND_LIST',
    payload: '',
    position: { x: 20, y: HITBOX_Y },
    width: HITBOX_SIZE,
    height: 10,
    imageSrc: '' 
  },
  {
    id: 'btn_map', // Telescopio (Centro) -> Mapa
    label: 'Mapa',
    actionType: 'MAP',
    payload: 'focus_center',
    position: { x: 41, y: HITBOX_Y },
    width: HITBOX_SIZE,
    height: 10,
    imageSrc: ''
  },
  {
    id: 'btn_alert', // Runa (Der) -> Alerta Proximidad (Demo)
    label: 'Cerca de Ti',
    actionType: 'PROXIMITY_ALERT',
    payload: 'demo_alert',
    position: { x: 62, y: HITBOX_Y },
    width: HITBOX_SIZE,
    height: 10,
    imageSrc: ''
  }
];

export type DashboardButtonConfig = GameButtonConfig;

export const getIconByName = (name: string): LucideIcon => {
  return ImageIcon;
};
