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
                dark: {
                    '900': '#0A0E27',
                    '800': '#0F1429',
                    '700': '#1A1F3A',
                    '600': '#252B4A',
                },
                neon: {
                    blue: '#00D9FF',
                    purple: '#A855F7',
                    green: '#00FF88',
                    red: '#FF0055',
                    yellow: '#FFD700',
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'cyber-grid': 'linear-gradient(rgba(0, 217, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 217, 255, 0.1) 1px, transparent 1px)',
            },
            backdropBlur: {
                glass: '12px',
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-in': 'slide-in 0.3s ease-out',
                'fade-in': 'fade-in 0.5s ease-out',
                'number-roll': 'number-roll 0.5s ease-out',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': {
                        boxShadow: '0 0 20px rgba(0, 217, 255, 0.5)',
                    },
                    '50%': {
                        boxShadow: '0 0 40px rgba(0, 217, 255, 0.8)',
                    },
                },
                'slide-in': {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'number-roll': {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}

export default config
