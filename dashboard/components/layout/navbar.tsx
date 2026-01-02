'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-silver-600/20">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
                        <div className="w-10 h-10 rounded-lg bg-gradient-elegant flex items-center justify-center border border-silver-600/30">
                            <span className="text-2xl">⚡</span>
                        </div>
                        <span className="text-xl font-bold gradient-text">
                            Polymarket Pro
                        </span>
                    </Link>

                    {/* Navigation */}
                    <div className="hidden md:flex items-center gap-8">
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
                        <div className="glass px-4 py-2 rounded-lg border border-silver-600/20">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                                <span className="text-sm font-medium text-silver-200">Connected</span>
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
                    ? 'text-silver-100'
                    : 'text-silver-400 hover:text-silver-200'
                }`}
        >
            {children}
            {active && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-silver rounded-full" />
            )}
        </Link>
    );
}
