import type { Config } from "tailwindcss";
import { PxxConfig } from "./projects/active/config";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			// Shadcn/ui CSS variable system (preserved)
  			background: 'hsl(var(--background) / <alpha-value>)',
  			foreground: 'hsl(var(--foreground) / <alpha-value>)',
  			card: {
  				DEFAULT: 'hsl(var(--card) / <alpha-value>)',
  				foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
  				foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
  				foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
  				foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
  				foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
  				foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
  				foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
  			},
  			border: 'hsl(var(--border) / <alpha-value>)',
  			input: 'hsl(var(--input) / <alpha-value>)',
  			ring: 'hsl(var(--ring) / <alpha-value>)',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},

  			// ==============================
  			// PXX Design System — Dynamic Theme Strategy
  			// ==============================
  			'pxx-base':  PxxConfig.theme.colors.base,
  			'pxx-dark':  PxxConfig.theme.colors.dark,
  			'pxx-terra': PxxConfig.theme.colors.terra,
  			'pxx-olive': PxxConfig.theme.colors.olive,
  			'pxx-gold':  PxxConfig.theme.colors.gold,
  			'pxx-stone': PxxConfig.theme.colors.stone,

			// Chameleon Engine — Route Themes (dinàmic des de PxxConfig — single source of truth)
			...Object.fromEntries(
				Object.entries(PxxConfig.chameleonThemes).map(([key, theme]) => [`chameleon-${key}`, theme.primary])
			),

			// Custom Colors
			terracotta: {
				500: '#E08E6D',
				600: '#D27D56',
				700: '#C06C45',
			},
  		},
  		fontFamily: {
  			'display': [PxxConfig.theme.fonts.display, 'serif'],
  			'title': [PxxConfig.theme.fonts.display, 'serif'],
  			'sans': [PxxConfig.theme.fonts.body, 'sans-serif'],
  			'mono': [PxxConfig.theme.fonts.mono, 'monospace'],
  		},
  		borderRadius: {
  			lg: '1rem', // ROUND_FOUR (16px) - Surgical Standard
  			md: '0.75rem', // 12px
  			sm: '0.5rem'   // 8px
  		},
		backgroundImage: {
			// Textura local — sense CDN extern (Sobirania Tècnica ✅)
			'paper-texture': "url('/textures/cream-paper.png')",
		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

