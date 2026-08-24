/**
 * Admin Panel Design System - Global Biome Colors
 * montaña: #2D4636
 * mar: #1A3A5A
 * interior: #B24C39
 * blossom: #D982B5
 * city: #1A1A1A
 */

export const ADMIN_THEMES: Record<string, {
    hex: string;      // Raw HEX color
    text: string;     // Primary brand color text
    mainText: string; // Slightly muted version for secondary text
    bg: string;       // Very light background (5-10% opacity)
    bgSoft: string;   // Ultra light background (2-5% opacity)
    border: string;   // Border color (10-20% opacity)
    ring: string;     // Focus ring color
    primary: string;  // Primary button/action background
    hover: string;    // Hover state of primary action
    fileBg: string;   // Input file background
    fileText: string; // Input file text
    fileHover: string;// Input file hover
    chartColors: string[]; // Gradient steps for charts
}> = {
    mountain: {
        hex: "#2D4636",
        text: "text-[#2D4636]",
        mainText: "text-[#2D4636]/80",
        bg: "bg-[#2D4636]/10",
        bgSoft: "bg-[#2D4636]/5",
        border: "border-[#2D4636]/20",
        ring: "ring-[#2D4636]/20",
        primary: "bg-[#2D4636]",
        hover: "hover:bg-[#1E2F24]",
        fileBg: "file:bg-[#2D4636]/10",
        fileText: "file:text-[#2D4636]",
        fileHover: "hover:file:bg-[#2D4636]/20",
        chartColors: ["#2D4636", "#43614F", "#5D7A68"]
    },
    coast: {
        hex: "#1A3A5A",
        text: "text-[#1A3A5A]",
        mainText: "text-[#1A3A5A]/80",
        bg: "bg-[#1A3A5A]/10",
        bgSoft: "bg-[#1A3A5A]/5",
        border: "border-[#1A3A5A]/20",
        ring: "ring-[#1A3A5A]/20",
        primary: "bg-[#1A3A5A]",
        hover: "hover:bg-[#11263B]",
        fileBg: "file:bg-[#1A3A5A]/10",
        fileText: "file:text-[#1A3A5A]",
        fileHover: "hover:file:bg-[#1A3A5A]/20",
        chartColors: ["#1A3A5A", "#2B5178", "#416E98"]
    },
    interior: {
        hex: "#B24C39",
        text: "text-[#B24C39]",
        mainText: "text-[#B24C39]/80",
        bg: "bg-[#B24C39]/10",
        bgSoft: "bg-[#B24C39]/5",
        border: "border-[#B24C39]/20",
        ring: "ring-[#B24C39]/20",
        primary: "bg-[#B24C39]",
        hover: "hover:bg-[#913E2E]",
        fileBg: "file:bg-[#B24C39]/10",
        fileText: "file:text-[#B24C39]",
        fileHover: "hover:file:bg-[#B24C39]/20",
        chartColors: ["#B24C39", "#CD6B59", "#E58D7D"]
    },
    bloom: {
        hex: "#D982B5",
        text: "text-[#D982B5]",
        mainText: "text-[#D982B5]/80",
        bg: "bg-[#D982B5]/10",
        bgSoft: "bg-[#D982B5]/5",
        border: "border-[#D982B5]/20",
        ring: "ring-[#D982B5]/20",
        primary: "bg-[#D982B5]",
        hover: "hover:bg-[#BD6AA0]",
        fileBg: "file:bg-[#D982B5]/10",
        fileText: "file:text-[#D982B5]",
        fileHover: "hover:file:bg-[#D982B5]/20",
        chartColors: ["#D982B5", "#E4A1C8", "#F0C1DA"]
    },
    city: {
        hex: "#1A1A1A",
        text: "text-[#1A1A1A]",
        mainText: "text-[#1A1A1A]/70",
        bg: "bg-[#1A1A1A]/10",
        bgSoft: "bg-[#1A1A1A]/5",
        border: "border-[#1A1A1A]/15",
        ring: "ring-[#1A1A1A]/15",
        primary: "bg-[#1A1A1A]",
        hover: "hover:bg-[#000000]",
        fileBg: "file:bg-[#1A1A1A]/10",
        fileText: "file:text-[#1A1A1A]",
        fileHover: "hover:file:bg-[#1A1A1A]/20",
        chartColors: ["#1A1A1A", "#333333", "#4D4D4D"]
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
