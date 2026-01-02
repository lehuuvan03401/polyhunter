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
        extend: {
            colors: {
                // Elegant neutral palette
                dark: {
                    '950': '#0A0A0A',  // Deepest black
                    '900': '#111111',  // Main background
                    '800': '#1A1A1A',  // Card background
                    '700': '#252525',  // Borders
                    '600': '#333333',  // Hover states
                },
                // Metallic accents
                silver: {
                    '100': '#F5F5F5',  // Lightest
                    '200': '#E5E5E5',
                    '300': '#D4D4D4',
                    '400': '#A3A3A3',
                    '500': '#737373',  // Medium silver
                    '600': '#525252',
                },
                // Deep green accent (success, positive)
                emerald: {
                    '400': '#34D399',  // Light emerald
                    '500': '#10B981',  // Main emerald
                    '600': '#059669',  // Deep emerald
                    '700': '#047857',
                },
                // Danger/negative (subtle red)
                crimson: {
                    '400': '#F87171',
                    '500': '#EF4444',
                    '600': '#DC2626',
                },
                // Warning (amber)
                amber: {
                    '400': '#FBBF24',
                    '500': '#F59E0B',
                    '600': '#D97706',
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-elegant': 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)',
                'gradient-silver': 'linear-gradient(135deg, #525252 0%, #737373 100%)',
                'gradient-emerald': 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            },
            backdropBlur: {
                glass: '12px',
            },
            animation: {
                'fade-in': 'fade-in 0.5s ease-out',
                'slide-in': 'slide-in 0.3s ease-out',
                'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-in': {
                    '0%': { transform: 'translateX(-10px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                'pulse-subtle': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
            },
            boxShadow: {
                'glow-silver': '0 0 20px rgba(115, 115, 115, 0.3)',
                'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.3)',
                'glow-elegant': '0 4px 20px rgba(0, 0, 0, 0.5)',
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}

export default config
