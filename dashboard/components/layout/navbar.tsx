'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { href: '/smart-money', label: '💎 Smart Money', icon: '💎' },
    { href: '/arbitrage', label: '💰 Arbitrage', icon: '💰' },
    { href: '/markets', label: '📊 Markets', icon: '📊' },
    { href: '/trading', label: '💱 Trading', icon: '💱' },
    { href: '/analytics', label: '📈 Analytics', icon: '📈' },
    { href: '/onchain', label: '🔧 On-Chain', icon: '🔧' },
    { href: '/settings', label: '⚙️ Settings', icon: '⚙️' },
];

export function Navbar() {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center gap-6">
                        {navItems.slice(0, 4).map((item) => (
                            <NavLink
                                key={item.href}
                                href={item.href}
                                active={pathname?.startsWith(item.href)}
                            >
                                {item.label}
                            </NavLink>
                        ))}

                        {/* More dropdown */}
                        <div className="relative group">
                            <button className="px-4 py-2 text-sm font-medium text-silver-400 hover:text-silver-200 transition">
                                More ▾
                            </button>
                            <div className="absolute top-full right-0 mt-2 w-48 glass rounded-lg border border-silver-600/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                {navItems.slice(4).map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`block px-4 py-3 text-sm hover:bg-white/5 transition ${pathname?.startsWith(item.href)
                                                ? 'text-silver-100 bg-white/5'
                                                : 'text-silver-400'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Status + Mobile Menu Button */}
                    <div className="flex items-center gap-3">
                        <div className="glass px-4 py-2 rounded-lg border border-silver-600/20 hidden sm:block">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                                <span className="text-sm font-medium text-silver-200">Connected</span>
                            </div>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 text-silver-400 hover:text-silver-200 transition"
                        >
                            {mobileMenuOpen ? '✕' : '☰'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden glass border-t border-silver-600/20 animate-fade-in">
                    <div className="max-w-7xl mx-auto px-6 py-4 space-y-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`block px-4 py-3 rounded-lg text-sm font-medium transition ${pathname?.startsWith(item.href)
                                        ? 'bg-white/10 text-silver-100'
                                        : 'text-silver-400 hover:bg-white/5 hover:text-silver-200'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
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
