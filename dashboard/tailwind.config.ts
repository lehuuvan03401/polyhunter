import type { Config } from "tailwindcss"

const config: Config = {
    darkMode: "class",
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // Existing custom colors for backward compatibility if needed
                dark: {
                    '950': '#0A0A0A',
                    '900': '#111111',
                    '800': '#1A1A1A',
                    '700': '#252525',
                    '600': '#333333',
                },
                silver: {
                    '100': '#F5F5F5',
                    '200': '#E5E5E5',
                    '300': '#D4D4D4',
                    '400': '#A3A3A3',
                    '500': '#737373',
                    '600': '#525252',
                },
                emerald: {
                    '400': '#34D399',
                    '500': '#10B981',
                    '600': '#059669',
                    '700': '#047857',
                },
                crimson: {
                    '400': '#F87171',
                    '500': '#EF4444',
                    '600': '#DC2626',
                },
                amber: {
                    '400': '#FBBF24',
                    '500': '#F59E0B',
                    '600': '#D97706',
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'pulse-subtle': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                'fade-in': 'fade-in 0.5s ease-out',
                'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            backgroundImage: {
                'gradient-elegant': 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)',
            },
            boxShadow: {
                'glow-silver': '0 0 20px rgba(115, 115, 115, 0.3)',
            }
        },
    },
    plugins: [require("tailwindcss-animate")],
}

export default config
