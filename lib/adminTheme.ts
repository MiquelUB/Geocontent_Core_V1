/**
 * Admin Panel Design System - Global Biome Colors
 * montaña: #2D4636
 * mar: #1A3A5A
 * interior: #B24C39
 * blossom: #D982B5
 * city: #1A1A1A
 */

export const ADMIN_THEMES: Record<string, {
    hex: string;
    text: string;
    mainText: string;
    bg: string;
    bgSoft: string;
    border: string;
    ring: string;
    primary: string;
    hover: string;
    fileBg: string;
    fileText: string;
    fileHover: string;
    chartColors: string[];
}> = {
    mountain: {
        hex: "hsl(var(--primary))",
        text: "text-primary",
        mainText: "text-primary/80",
        bg: "bg-primary/10",
        bgSoft: "bg-primary/5",
        border: "border-primary/20",
        ring: "ring-primary/20",
        primary: "bg-primary",
        hover: "hover:bg-primary/90",
        fileBg: "file:bg-primary/10",
        fileText: "file:text-primary",
        fileHover: "hover:file:bg-primary/20",
        chartColors: ["hsl(var(--primary))", "hsl(var(--primary)/0.8)", "hsl(var(--primary)/0.6)"]
    },
    coast: {
        hex: "hsl(var(--primary))",
        text: "text-primary",
        mainText: "text-primary/80",
        bg: "bg-primary/10",
        bgSoft: "bg-primary/5",
        border: "border-primary/20",
        ring: "ring-primary/20",
        primary: "bg-primary",
        hover: "hover:bg-primary/90",
        fileBg: "file:bg-primary/10",
        fileText: "file:text-primary",
        fileHover: "hover:file:bg-primary/20",
        chartColors: ["hsl(var(--primary))", "hsl(var(--primary)/0.8)", "hsl(var(--primary)/0.6)"]
    },
    interior: {
        hex: "hsl(var(--primary))",
        text: "text-primary",
        mainText: "text-primary/80",
        bg: "bg-primary/10",
        bgSoft: "bg-primary/5",
        border: "border-primary/20",
        ring: "ring-primary/20",
        primary: "bg-primary",
        hover: "hover:bg-primary/90",
        fileBg: "file:bg-primary/10",
        fileText: "file:text-primary",
        fileHover: "hover:file:bg-primary/20",
        chartColors: ["hsl(var(--primary))", "hsl(var(--primary)/0.8)", "hsl(var(--primary)/0.6)"]
    },
    bloom: {
        hex: "hsl(var(--primary))",
        text: "text-primary",
        mainText: "text-primary/80",
        bg: "bg-primary/10",
        bgSoft: "bg-primary/5",
        border: "border-primary/20",
        ring: "ring-primary/20",
        primary: "bg-primary",
        hover: "hover:bg-primary/90",
        fileBg: "file:bg-primary/10",
        fileText: "file:text-primary",
        fileHover: "hover:file:bg-primary/20",
        chartColors: ["hsl(var(--primary))", "hsl(var(--primary)/0.8)", "hsl(var(--primary)/0.6)"]
    },
    city: {
        hex: "hsl(var(--primary))",
        text: "text-primary",
        mainText: "text-primary/70",
        bg: "bg-primary/10",
        bgSoft: "bg-primary/5",
        border: "border-primary/15",
        ring: "ring-primary/15",
        primary: "bg-primary",
        hover: "hover:bg-primary/90",
        fileBg: "file:bg-primary/10",
        fileText: "file:text-primary",
        fileHover: "hover:file:bg-primary/20",
        chartColors: ["hsl(var(--primary))", "hsl(var(--primary)/0.8)", "hsl(var(--primary)/0.6)"]
    }
};

export function getAdminTheme(themeId?: string) {
    if (!themeId) return ADMIN_THEMES.mountain;

    const tid = themeId.toLowerCase();

    // Dynamic mapping based on user nomenclature
    if (tid === 'montaña' || tid === 'montanya' || tid === 'mountain') return ADMIN_THEMES.mountain;
    if (tid === 'mar' || tid === 'coast') return ADMIN_THEMES.coast;
    if (tid === 'blossom' || tid === 'bloom') return ADMIN_THEMES.bloom;
    if (tid === 'interior') return ADMIN_THEMES.interior;
    if (tid === 'city') return ADMIN_THEMES.city;

    return ADMIN_THEMES[tid] || ADMIN_THEMES.mountain;
}
