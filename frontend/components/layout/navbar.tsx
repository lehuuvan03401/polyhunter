'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LineChart, LayoutDashboard, Wallet, Search } from 'lucide-react';
import { ethers } from 'ethers';

const navItems = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Markets', href: '/markets', icon: Search },
    { name: 'Smart Money', href: '/smart-money', icon: LineChart },
    { name: 'Portfolio', href: '/portfolio', icon: Wallet },
];

import { usePrivyLogin } from '@/lib/privy-login';
import { UserMenu } from './user-menu';

export function Navbar() {
    const pathname = usePathname();
    const { login, authenticated, user, logout, ready } = usePrivyLogin();
    const [usdcBalance, setUsdcBalance] = React.useState<number | null>(null);

    // Fetch USDC balance when authenticated
    React.useEffect(() => {
        if (!authenticated || !user?.wallet?.address) {
            setUsdcBalance(null);
            return;
        }

        const fetchBalance = async () => {
            if (!user?.wallet?.address) {
                setUsdcBalance(null);
                return;
            }

            try {
                const USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
                const USDC_ABI = ['function balanceOf(address) view returns (uint256)'];
                const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
                const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
                const usdcContract = new ethers.Contract(USDC_CONTRACT, USDC_ABI, provider);
                const rawBalance = await usdcContract.balanceOf(user.wallet.address);
                // USDC has 6 decimals
                const balance = Number(rawBalance) / 1e6;
                setUsdcBalance(balance);
            } catch (err) {
                console.warn("Failed to fetch USDC balance in navbar", err);
                setUsdcBalance(null);
            }
        };

        fetchBalance();
        // Refresh balance every 30 seconds
        const interval = setInterval(fetchBalance, 30000);
        return () => clearInterval(interval);
    }, [authenticated, user?.wallet?.address]);

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 max-w-7xl items-center justify-between">


                {/* Logo */}
                <Link href="/" className="flex items-center space-x-2">
                    <div className="relative h-8 w-8 overflow-hidden rounded-full">
                        <img
                            src="/polyhunter.png"
                            alt="PolyHunter Logo"
                            className="object-cover w-full h-full"
                        />
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
                    {authenticated ? (
                        // 已登录用户看到的菜单
                        <>
                            <Link href="/smart-money" className={cn("transition-colors hover:text-foreground/80", pathname.startsWith("/smart-money") ? "text-foreground" : "text-muted-foreground")}>
                                Smart Money
                            </Link>
                            <Link href="/affiliate" className={cn("transition-colors hover:text-foreground/80", pathname === "/affiliate" ? "text-foreground" : "text-muted-foreground")}>
                                Affiliate
                            </Link>
                            <Link href="/portfolio" className={cn("transition-colors hover:text-foreground/80", pathname === "/portfolio" ? "text-foreground" : "text-muted-foreground")}>
                                Dashboard
                            </Link>
                            <Link href="/settings" className={cn("transition-colors hover:text-foreground/80", pathname === "/settings" ? "text-foreground" : "text-muted-foreground")}>
                                Settings
                            </Link>
                        </>
                    ) : (
                        // 未登录用户看到的菜单
                        <>
                            <Link href="/pricing" className={cn("transition-colors hover:text-foreground/80", pathname === "/pricing" ? "text-foreground" : "text-muted-foreground")}>
                                Pricing
                            </Link>
                            <Link href="/affiliate" className={cn("transition-colors hover:text-foreground/80", pathname === "/affiliate" ? "text-foreground" : "text-muted-foreground")}>
                                Affiliate
                            </Link>
                        </>
                    )}
                </nav>

                {/* Right Side */}
                <div className="flex items-center gap-4">
                    {!ready ? (
                        // Loading Skeleton
                        <div className="h-9 w-24 bg-white/5 animate-pulse rounded-lg" />
                    ) : authenticated ? (
                        <div className="flex items-center gap-6">
                            {/* Balance Stats */}
                            <div className="hidden lg:flex items-center gap-6 mr-2">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-muted-foreground tracking-wider mb-0.5">TOTAL</span>
                                    <span className="text-sm font-bold text-[#22c55e] font-mono tracking-tight">
                                        {usdcBalance !== null ? `$${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-muted-foreground tracking-wider mb-0.5">CASH</span>
                                    <span className="text-sm font-bold text-[#22c55e] font-mono tracking-tight">
                                        {usdcBalance !== null ? `$${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                                    </span>
                                </div>
                            </div>

                            <UserMenu />
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
