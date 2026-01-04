'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LineChart, LayoutDashboard, Wallet, Search } from 'lucide-react';

const navItems = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Markets', href: '/markets', icon: Search },
    { name: 'Smart Money', href: '/smart-money', icon: LineChart },
    { name: 'Portfolio', href: '/portfolio', icon: Wallet },
];

import { usePrivy } from '@privy-io/react-auth';

export function Navbar() {
    const pathname = usePathname();
    const { login, authenticated, user, logout } = usePrivy();

    return (
        <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 max-w-7xl items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center space-x-2">
                    <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-white/80" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">
                        PolyHunter
                    </span>
                </Link>

                {/* Center Nav */}
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
                    <Link href="/" className={cn("transition-colors hover:text-foreground/80", pathname === "/" ? "text-foreground" : "text-muted-foreground")}>
                        Home
                    </Link>
                    <Link href="/markets" className={cn("transition-colors hover:text-foreground/80", pathname.startsWith("/markets") ? "text-foreground" : "text-muted-foreground")}>
                        Markets
                    </Link>
                    <Link href="/pricing" className="text-muted-foreground transition-colors hover:text-foreground/80">
                        Pricing
                    </Link>
                    <Link href="/affiliate" className="text-muted-foreground transition-colors hover:text-foreground/80">
                        Affiliate
                    </Link>
                    <Link href="/portfolio" className={cn("transition-colors hover:text-foreground/80", pathname === "/portfolio" ? "text-foreground" : "text-muted-foreground")}>
                        Dashboard
                    </Link>
                </nav>

                {/* Right Side */}
                <div className="flex items-center gap-4">
                    {authenticated ? (
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-white px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                                {user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : 'Connected'}
                            </div>
                            <button
                                onClick={logout}
                                className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                            >
                                Log out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={login}
                            className="hidden md:flex items-center justify-center rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors border border-white/10"
                        >
                            Log in or sign up
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
