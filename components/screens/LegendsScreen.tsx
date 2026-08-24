import { useState, useEffect } from "react";
import { MapPin, Bookmark, Heart, SlidersHorizontal, BarChart, Mountain, HelpCircle } from "lucide-react";
import { Button } from "../ui/button";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { motion } from "motion/react";
import { getLegends, getAppBranding } from "@/lib/actions/queries";
import { PxxConfig } from "@/projects/active/config";
import { downloadTerritorialPackage, isRouteCached, SyncProgress } from "@/lib/services/sync-service";
import { CheckCircle2, Download, Loader2, AlertCircle } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedContent } from "@/lib/i18n-db";

interface LegendsScreenProps {
    onNavigate: (screen: string, data?: any) => void;
    onOpenHelp: () => void;
    brand?: any;
    currentUser?: any;
    globalLegends?: any[];
}

// Difficulty derived deterministically from POI count (no Math.random)
function getDifficultyKey(poiCount: number): string {
    if (poiCount >= 8) return 'expert';
    if (poiCount >= 4) return 'medium';
    return 'easy';
}

function hexToHsl(hex: string) {
    if (!hex || typeof hex !== 'string') return "0 0% 0%";

    let r = 0, g = 0, b = 0;
    const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;

    if (cleanHex.length === 4) {
        r = parseInt(cleanHex[1] + cleanHex[1], 16);
        g = parseInt(cleanHex[2] + cleanHex[2], 16);
        b = parseInt(cleanHex[3] + cleanHex[3], 16);
    } else if (cleanHex.length === 7) {
        r = parseInt(cleanHex.substring(1, 3), 16);
        g = parseInt(cleanHex.substring(3, 5), 16);
        b = parseInt(cleanHex.substring(5, 7), 16);
    } else {
        return "0 0% 0%";
    }

    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}


export function LegendsScreen({ onNavigate, onOpenHelp, brand: propBrand, currentUser, globalLegends = [] }: LegendsScreenProps) {
    const t = useTranslations('legends');
    const tCommon = useTranslations('common');
    const locale = useLocale();

    const [selectedRoute, setSelectedRoute] = useState("all");
    const [legends, setLegends] = useState<any[]>([]);
    const [brand, setBrand] = useState<any>(propBrand);

    // Filter Buttons (Routes)
    const [filterChips, setFilterChips] = useState<any[]>([{ id: "all", label: t('all') }]);

    // Download Status Tracking
    const [downloadStatuses, setDownloadStatuses] = useState<Record<string, 'idle' | 'syncing' | 'ready'>>({});
    const [downloadProgress, setDownloadProgress] = useState<Record<string, SyncProgress | null>>({});

    const network = useNetworkStatus();

    useEffect(() => {
        if (!propBrand) {
            getAppBranding().then(b => setBrand(b));
        }

        if (globalLegends && globalLegends.length > 0) {
            const mapped = globalLegends.map((l: any) => ({
                ...l,
                location: getLocalizedContent(l, 'location_name', locale) || '',
                coordinates: { lat: l.latitude, lng: l.longitude },
                image: l.image_url,
                hero: l.hero_image_url,
                difficultyKey: getDifficultyKey(l.poiCount ?? 0),
                poiCount: l.poiCount ?? (l.pois?.length ?? 0),
            }));
            setLegends(mapped);

            // Create chips for each individual route
            const routeChips = [
                { id: "all", label: t('all'), category: "all" },
                ...mapped.map((l: any) => ({
                    id: l.id,
                    label: getLocalizedContent(l, 'title', locale),
                    category: l.category
                }))
            ];
            setFilterChips(routeChips);
        }
    }, [locale, t, propBrand, globalLegends]);

    // Initialize cached status
    useEffect(() => {
        if (legends.length > 0) {
            const initialStatuses: Record<string, 'idle' | 'syncing' | 'ready'> = {};
            legends.forEach(l => {
                if (isRouteCached(l.id)) {
                    initialStatuses[l.id] = 'ready';
                }
            });
            setDownloadStatuses(prev => ({ ...prev, ...initialStatuses }));
        }
    }, [legends]);

    const handleDownload = async (e: React.MouseEvent, route: any) => {
        e.stopPropagation();
        const routeId = route.id;

        if (downloadStatuses[routeId] === 'syncing') return;

        setDownloadStatuses(prev => ({ ...prev, [routeId]: 'syncing' }));

        const pois = route.pois || [];
        const result = await downloadTerritorialPackage(routeId, pois, (p) => {
            setDownloadProgress(prev => ({ ...prev, [routeId]: p }));
        });

        if (result.success) {
            setDownloadStatuses(prev => ({ ...prev, [routeId]: 'ready' }));
        } else {
            setDownloadStatuses(prev => ({ ...prev, [routeId]: 'idle' }));
            alert(t('downloadError', { error: result.error || tCommon('unknown') }));
        }
    };

    // Filter by selected route ID ("all" shows everything)
    const filteredLegends = selectedRoute === 'all'
        ? legends
        : legends.filter(l => l.id === selectedRoute);

    const activeChip = filterChips.find(c => c.id === selectedRoute);
    const activeLabel = activeChip?.label ?? t('all');

    // El bioma de la plana SEMPRE ha de ser el del municipi (brand), no el de la ruta filtrada
    const activeCategory = brand?.themeId || 'mountain';
    const theme = PxxConfig.chameleonThemes[activeCategory as keyof typeof PxxConfig.chameleonThemes] || PxxConfig.chameleonThemes['mountain'];

    // We explicitly cast to string, then React.CSSProperties
    const themeStyles = {
        '--primary': hexToHsl(theme.primary),
        '--accent': hexToHsl(theme.accent),
        '--background': hexToHsl(theme.bg),
    } as any;


    return (
        <div
            className="bg-background min-h-screen font-serif text-foreground flex flex-col transition-colors duration-500"
            style={themeStyles}
        >


            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto pb-32 no-scrollbar">

                {/* Filter Chips (Horizontal Scroll) */}
                <div className="flex gap-3 px-6 overflow-x-auto pb-6 pt-6 no-scrollbar">
                    {filterChips.map(chip => {
                        const isSelected = selectedRoute === chip.id;
                        const globalThemeId = brand?.themeId || 'mountain';

                        // Use global biome color for chips
                        const biomeColor = PxxConfig.chameleonThemes[globalThemeId as keyof typeof PxxConfig.chameleonThemes]?.primary || PxxConfig.chameleonThemes['mountain'].primary;

                        return (
                            <button
                                key={chip.id}
                                onClick={() => setSelectedRoute(chip.id)}
                                className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-transform shadow-sm active:scale-95`}
                                style={{
                                    backgroundColor: isSelected ? biomeColor : 'transparent',
                                    color: isSelected ? 'white' : biomeColor,
                                    border: `2px solid ${biomeColor}`
                                }}
                            >
                                {chip.label}
                            </button>
                        );
                    })}
                </div>

                {/* Route List */}
                <div className="px-6 space-y-8">
                    {/* Section Header */}
                    <div className="flex items-center gap-4">
                        <h2 className="font-serif text-2xl text-foreground font-bold">
                            {selectedRoute === 'all' ? t('libraryTitle') : activeLabel}
                        </h2>
                        <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                        <span className="text-sm text-gray-400">{t('routesCount', { count: filteredLegends.length })}</span>
                    </div>

                    {/* Empty state */}
                    {filteredLegends.length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                            <Mountain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-serif text-lg">{t('noRoutes')}</p>
                            <p className="text-sm mt-1">{t('createAdmin')}</p>
                        </div>
                    )}

                    {/* Route Cards */}
                    {filteredLegends.map((legend, index) => (
                        <div
                            key={legend.id}
                            onClick={() => onNavigate('legend-detail', legend)}
                            className="group relative bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100 dark:border-zinc-800 cursor-pointer"
                        >
                            {/* Image Area */}
                            <div className="relative h-64 w-full overflow-hidden">
                                <ImageWithFallback
                                    src={legend.hero || legend.image}
                                    alt={getLocalizedContent(legend, 'title', locale)}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>

                                <div className="absolute bottom-0 left-0 w-full p-5">
                                    <h3 className="font-serif text-white text-2xl font-bold mb-3 tracking-wide drop-shadow-md">{getLocalizedContent(legend, 'title', locale)}</h3>

                                    <div className="flex flex-wrap gap-2 text-xs font-bold tracking-wide text-white">
                                        {legend.location && (
                                            <div
                                                className="px-3 py-1 rounded shadow-sm"
                                                style={{
                                                    backgroundColor: PxxConfig.chameleonThemes[legend.category as keyof typeof PxxConfig.chameleonThemes]?.primary || 'hsl(var(--primary))'
                                                }}
                                            >
                                                <span>{legend.location}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Short Description & Offline Button */}
                            <div className="p-4 bg-white dark:bg-zinc-900 space-y-4">
                                <p className="text-gray-600 dark:text-gray-400 font-serif text-base leading-relaxed line-clamp-2">
                                    {getLocalizedContent(legend, 'description', locale)}
                                </p>

                                {/* Punt D'Or - ONLY if downloadRequired is true in DB config */}
                                {legend.downloadRequired && (
                                    <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                                        {downloadStatuses[legend.id] === 'ready' ? (
                                            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm border border-emerald-100">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span>{t('alreadyOffline')}</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <Button
                                                    variant="secondary"
                                                    size="lg"
                                                    onClick={(e) => handleDownload(e, legend)}
                                                    disabled={downloadStatuses[legend.id] === 'syncing' || !network.isOnline}
                                                    className="w-full h-12 text-xs uppercase font-black tracking-widest bg-amber-50 text-amber-900 border-2 border-amber-200 hover:bg-amber-100 shadow-sm rounded-xl"
                                                >
                                                    {downloadStatuses[legend.id] === 'syncing' ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            {t('downloading')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download className="w-4 h-4 mr-2" />
                                                            {t('offlineUsage')}
                                                        </>
                                                    )}
                                                </Button>

                                                {downloadStatuses[legend.id] === 'syncing' && downloadProgress[legend.id] && (
                                                    <div className="space-y-1.5">
                                                        <div className="h-1.5 w-full bg-amber-200/50 rounded-full overflow-hidden">
                                                            <motion.div
                                                                className="h-full bg-amber-500"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${(downloadProgress[legend.id]!.current / downloadProgress[legend.id]!.total) * 100}%` }}
                                                            />
                                                        </div>
                                                        <div className="text-[9px] text-amber-700 font-bold text-center italic uppercase tracking-tighter">
                                                            {downloadProgress[legend.id]?.label}...
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
