'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center glow">
                            <span className="text-2xl">⚡</span>
                        </div>
                        <span className="text-xl font-bold gradient-text">
                            Polymarket Pro
                        </span>
                    </Link>

                    {/* Navigation */}
                    <div className="hidden md:flex items-center gap-6">
                        <NavLink href="/smart-money" active={pathname?.startsWith('/smart-money')}>
                            💎 Smart Money
                        </NavLink>
                        <NavLink href="/arbitrage" active={pathname?.startsWith('/arbitrage')}>
                            💰 Arbitrage
                        </NavLink>
                        <NavLink href="/markets" active={pathname?.startsWith('/markets')}>
                            📊 Markets
                        </NavLink>
                        <NavLink href="/trading" active={pathname?.startsWith('/trading')}>
                            💱 Trading
                        </NavLink>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <div className="glass px-4 py-2 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                                <span className="text-sm font-medium">Connected</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}

function NavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className={`relative px-4 py-2 text-sm font-medium transition-all ${active
                    ? 'text-neon-blue glow'
                    : 'text-gray-400 hover:text-white'
                }`}
        >
            {children}
            {active && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-full" />
            )}
        </Link>
    );
}
