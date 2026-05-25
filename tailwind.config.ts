import type { Config } from "tailwindcss";
import { PxxConfig } from "./projects/active/config";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			// Shadcn/ui CSS variable system (preserved)
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
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

