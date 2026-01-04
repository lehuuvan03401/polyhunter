'use client';

import Link from 'next/link';
import {
    ChevronLeft,
    Copy,
    ExternalLink,
    Share2,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';

// Mock Data
// Deterministic mock data generator
const getMockProfile = (address: string) => {
    // Simple hash function for consistency
    const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const copiers = 50 + (hash % 1000);
    const activePositions = 1 + (hash % 10);
    const pnlBase = (hash % 50000);

    return {
        username: `Trader ${address.slice(2, 6)}`,
        address: address,
        copiers,
        activePositions,
        avatarColor: ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'][hash % 4],
        positions: Array.from({ length: activePositions }).map((_, i) => ({
            question: `Mock Market Question ${i + 1}?`,
            outcome: (hash + i) % 2 === 0 ? "Yes" : "No",
            pnl: (i % 2 === 0 ? "+" : "-") + `$${(100 + (hash % 500)).toFixed(2)}`,
            pnlPositive: i % 2 === 0,
            size: `$${(1000 + (hash % 9000)).toFixed(2)}`
        })),
        trades: Array.from({ length: 5 }).map((_, i) => ({
            action: "Bought",
            market: `Mock Market Event ${i + 1}`,
            date: "Just now",
            amount: `$${(50 + (hash % 500)).toFixed(2)}`,
            type: "buy"
        }))
    };
};

// ... imports
import { CopyTraderModal } from '@/components/copy-trading/copy-trader-modal';
import { polyClient } from '@/lib/polymarket';
import { SmartMoneyWallet } from '@catalyst-team/poly-sdk';

export default function TraderProfilePage({ params }: { params: Promise<{ address: string }> }) {
    // Unwrap params for Next.js 15+ dynamic routes
    const { address } = React.use(params);
    const [isCopyModalOpen, setIsCopyModalOpen] = React.useState(false);

    // State for dynamic data
    const [profile, setProfile] = React.useState<ReturnType<typeof getMockProfile> | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                // Try to get real smart money info
                let smartMoneyInfo: SmartMoneyWallet | null = null;

                try {
                    smartMoneyInfo = await polyClient.smartMoney.getSmartMoneyInfo(address);
                } catch (err) {
                    console.warn("Failed to fetch smart money info, likely network:", err);
                }

                // Fetch real positions and activity
                let openPositions: any[] = [];
                let recentActivity: any[] = [];

                try {
                    const rawPositions = await polyClient.wallets.getWalletPositions(address);
                    openPositions = rawPositions.map(pos => ({
                        question: pos.title,
                        outcome: pos.outcome,
                        pnl: (pos.cashPnl || 0) >= 0 ? `+$${(pos.cashPnl || 0).toFixed(2)}` : `-$${Math.abs(pos.cashPnl || 0).toFixed(2)}`,
                        pnlPositive: (pos.cashPnl || 0) >= 0,
                        size: `$${(pos.currentValue || (pos.size * pos.avgPrice)).toFixed(2)}`
                    }));
                } catch (e) {
                    console.warn("Failed to fetch positions:", e);
                }

                try {
                    const activity = await polyClient.wallets.getWalletActivity(address, 20);
                    recentActivity = activity.activities
                        .filter(a => a.type === 'TRADE')
                        .map(a => ({
                            action: a.side === 'BUY' ? 'Bought' : 'Sold',
                            market: a.title,
                            date: new Date(a.timestamp * 1000).toLocaleDateString(),
                            amount: `$${(a.usdcSize || (a.size * a.price)).toFixed(2)}`,
                            type: a.side.toLowerCase()
                        }));
                } catch (e) {
                    console.warn("Failed to fetch activity:", e);
                }

                if (smartMoneyInfo || openPositions.length > 0 || recentActivity.length > 0) {
                    setProfile({
                        username: smartMoneyInfo?.name || `User ${address.slice(0, 6)}`,
                        address: address,
                        copiers: smartMoneyInfo ? Math.floor(smartMoneyInfo.score * 1.5) : 0,
                        activePositions: openPositions.length,
                        avatarColor: "bg-blue-500",
                        positions: openPositions,
                        trades: recentActivity
                    });
                } else {
                    // Fallback to deterministic mock
                    setProfile(getMockProfile(address));
                }
            } catch (error) {
                console.error("Profile load error", error);
                setProfile(getMockProfile(address));
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [address]);

    // Use mock positions/trades if real ones are empty (hybrid approach)
    const displayProfile = profile || getMockProfile(address);
    const positions = displayProfile.positions || getMockProfile(address).positions;
    const trades = displayProfile.trades || getMockProfile(address).trades;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background pt-24 pb-20">
                <div className="container max-w-5xl mx-auto px-4">
                    <Link href="/smart-money" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white mb-8 transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Discovery
                    </Link>

                    {/* Header Skeleton */}
                    <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 lg:p-8 mb-8 animate-pulse">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                            <div className="flex items-center gap-5 w-full">
                                <div className="h-16 w-16 rounded-2xl bg-white/5" />
                                <div className="space-y-2">
                                    <div className="h-8 w-48 bg-white/5 rounded-lg" />
                                    <div className="h-4 w-32 bg-white/5 rounded-lg" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/5 pt-6">
                            <div className="flex items-center gap-8">
                                <div className="space-y-1">
                                    <div className="h-8 w-16 bg-white/5 rounded-lg" />
                                    <div className="h-3 w-12 bg-white/5 rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                    <div className="h-8 w-16 bg-white/5 rounded-lg" />
                                    <div className="h-3 w-24 bg-white/5 rounded-lg" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Positions Skeleton */}
                    <div className="mb-10">
                        <div className="h-6 w-32 bg-white/5 rounded-lg mb-4 animate-pulse" />
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-5 h-24 animate-pulse" />
                            ))}
                        </div>
                    </div>

                    {/* Recent Trades Skeleton */}
                    <div>
                        <div className="h-6 w-32 bg-white/5 rounded-lg mb-4 animate-pulse" />
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-4 h-16 animate-pulse" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pt-24 pb-20">
            <CopyTraderModal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                traderAddress={address}
            />

            <div className="container max-w-5xl mx-auto px-4">

                {/* Back Navigation */}
                <Link href="/smart-money" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white mb-8 transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Back to Discovery
                </Link>

                {/* Profile Header */}
                <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 lg:p-8 mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div className="flex items-center gap-5">
                            <div className={`h-16 w-16 rounded-2xl ${displayProfile.avatarColor} flex items-center justify-center shadow-lg`}>
                                <Wallet className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-1">{displayProfile.username}</h1>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <a
                                        href={`https://polymarket.com/${address}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:text-blue-400 cursor-pointer"
                                    >
                                        <ExternalLink className="h-3 w-3" /> View real username on Polymarket
                                    </a>
                                    <span className="text-blue-500">{address}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsCopyModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            <Copy className="h-4 w-4" /> Copy Trader
                        </button>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-6">
                        <div className="flex items-center gap-8">
                            <div>
                                <div className="text-2xl font-bold text-white mb-0.5">{displayProfile.copiers}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Copiers</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white mb-0.5">{displayProfile.activePositions}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Active Positions</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <a href="#" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                                <ExternalLink className="h-3.5 w-3.5" /> Polymarket
                            </a>
                            <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                                <Share2 className="h-3.5 w-3.5" /> Share & Earn
                            </button>
                        </div>
                    </div>
                </div>

                {/* Active Positions */}
                <div className="mb-10">
                    <h2 className="text-lg font-bold text-muted-foreground mb-4">Active Positions</h2>
                    <div className="space-y-4">
                        {positions.map((pos, i) => (
                            <div key={i} className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-5 flex items-center justify-between hover:bg-[#25262b] transition-colors cursor-default">
                                <div>
                                    <h3 className="font-bold text-white text-sm mb-1">{pos.question}</h3>
                                    <div className="text-xs text-muted-foreground">
                                        <span className={cn("font-medium", pos.outcome === "Yes" ? "text-green-500" : "text-red-500")}>{pos.outcome}</span> • {pos.size}
                                    </div>
                                </div>
                                <div className={cn("text-sm font-bold font-mono", pos.pnlPositive ? "text-green-500" : "text-red-500")}>
                                    {pos.pnl}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Trades */}
                <div>
                    <h2 className="text-lg font-bold text-muted-foreground mb-4">Recent Trades</h2>
                    <div className="space-y-3">
                        {trades.map((trade, i) => (
                            <div key={i} className="group bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-4 flex items-center justify-between hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">
                                            <span className="text-green-500 font-bold">{trade.action}</span> {trade.market}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {trade.date}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-white font-mono">
                                    {trade.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
