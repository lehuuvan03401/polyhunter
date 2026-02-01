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
    User,
    AlertCircle,
    TrendingUp,
    BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { useTranslations } from 'next-intl';

// Type definitions for profile data
interface Position {
    question: string;
    outcome: string;
    pnl: string;
    pnlPositive: boolean;
    size: string;
}

interface Trade {
    action: string;
    market?: string;
    date: string;
    time?: string;
    amount: string;
    shares?: string;
    price?: string;
    type: string;
}

interface TraderProfile {
    username: string;
    address: string;
    pnl: number;
    volume: number;
    score: number;
    winRate: number;
    totalTrades: number;
    positionCount: number;
    lastActive: string;
    positions: Position[];
    trades: Trade[];
}

import { CopyTraderModal } from '@/components/copy-trading/copy-trader-modal';

export default function TraderProfilePage({ params }: { params: Promise<{ address: string }> }) {
    // Unwrap params for Next.js 15+ dynamic routes
    const { address } = React.use(params);
    const t = useTranslations('TraderProfile');
    const [isCopyModalOpen, setIsCopyModalOpen] = React.useState(false);

    // State for dynamic data
    const [profile, setProfile] = React.useState<TraderProfile | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Use cached API endpoint for faster loading
                const response = await fetch(`/api/traders/${address}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch profile');
                }

                const data = await response.json();

                if (data.profile) {
                    setProfile({
                        username: data.profile.username,
                        address: data.profile.address,
                        pnl: data.profile.pnl || 0,
                        volume: data.profile.volume || 0,
                        score: data.profile.score || 0,
                        winRate: data.profile.winRate || 0,
                        totalTrades: data.profile.totalTrades || 0,
                        positionCount: data.profile.positionCount || 0,
                        lastActive: data.profile.lastActive,
                        positions: data.profile.positions || [],
                        trades: data.profile.recentTrades || [],
                    });
                } else {
                    throw new Error('Invalid profile data');
                }
            } catch (err) {
                console.error("Profile load error", err);
                setError('Failed to load trader profile. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        if (address) {
            fetchProfile();
        }
    }, [address]);

    // Format large numbers
    const formatPnL = (pnl: number) => {
        if (pnl >= 1000000) {
            return `$${(pnl / 1000000).toFixed(2)}M`;
        } else if (pnl >= 1000) {
            return `$${(pnl / 1000).toFixed(1)}K`;
        }
        return `$${pnl.toFixed(2)}`;
    };

    const formatVolume = (volume: number) => {
        if (volume >= 1000000) {
            return `$${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `$${(volume / 1000).toFixed(0)}K`;
        }
        return `$${volume.toFixed(0)}`;
    };

    const formatTrades = (count: number) => {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    };

    // Use real data only
    const positions = profile?.positions || [];
    const trades = profile?.trades || [];

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background pt-24 pb-20">
                <div className="container max-w-5xl mx-auto px-4">
                    <Link href="/smart-money" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white mb-8 transition-colors">
                        <ChevronLeft className="h-4 w-4" /> {t('backToDiscovery')}
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
                {/* Back Navigation */}
                <Link href="/smart-money" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white mb-8 transition-colors">
                    <ChevronLeft className="h-4 w-4" /> {t('backToDiscovery')}
                </Link>

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-8 flex items-center gap-4">
                        <AlertCircle className="h-6 w-6 text-red-400" />
                        <div>
                            <div className="font-medium text-red-400">{t('errorTitle')}</div>
                            <div className="text-sm text-muted-foreground">{t('errorDesc')}</div>
                        </div>
                    </div>
                )}

                {/* Profile Header */}
                <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 lg:p-8 mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div className="flex items-center gap-5 min-w-0 flex-1">
                            <div className="h-16 w-16 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg flex-shrink-0">
                                <Wallet className="h-8 w-8 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-bold text-white mb-1 truncate">
                                        {profile?.username || `${address.slice(0, 6)}...${address.slice(-4)}`}
                                    </h1>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(address)}
                                        className="text-muted-foreground hover:text-white transition-colors p-1"
                                        title={t('copyAddress')}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <a
                                        href={`https://polymarket.com/${address}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:text-blue-400 cursor-pointer transition-colors bg-white/5 px-2 py-1 rounded w-fit"
                                    >
                                        <ExternalLink className="h-3 w-3" /> {t('viewOnPolymarket')}
                                    </a>
                                    <span className="font-mono bg-white/5 px-2 py-1 rounded truncate">
                                        {address}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsCopyModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20 whitespace-nowrap flex-shrink-0"
                        >
                            <Copy className="h-4 w-4" /> {t('copyTrader')}
                        </button>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-6">
                        <div className="flex items-center gap-8">
                            <div>
                                <div className={`text-2xl font-bold mb-0.5 ${(profile?.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {(profile?.pnl || 0) >= 0 ? '+' : ''}{formatPnL(profile?.pnl || 0)}
                                </div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('stats.pnl')} <span className="text-muted-foreground/50 scale-90 inline-block">{t('stats.allTime')}</span></div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white mb-0.5">{formatVolume(profile?.volume || 0)}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('stats.volume')} <span className="text-muted-foreground/50 scale-90 inline-block">{t('stats.allTime')}</span></div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white mb-0.5">{profile?.winRate || 0}%</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('stats.winRate')} <span className="text-muted-foreground/50 scale-90 inline-block">{t('stats.allTime')}</span></div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white mb-0.5">
                                    {formatTrades(profile?.totalTrades || 0)}
                                    {(profile?.totalTrades || 0) <= 20 && (profile?.volume || 0) > 10000 && <span className="text-sm text-muted-foreground align-top ml-0.5">+</span>}
                                </div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('stats.trades')} <span className="text-muted-foreground/50 scale-90 inline-block">{t('stats.allTime')}</span></div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white mb-0.5">{profile?.positionCount || positions.length}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('stats.positions')}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                                <Share2 className="h-3.5 w-3.5" /> {t('shareEarn')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Active Positions */}
                <div className="mb-10">
                    <h2 className="text-lg font-bold text-muted-foreground mb-4">{t('activePositions.title')}</h2>
                    {positions.length === 0 ? (
                        <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-8 text-center">
                            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <div className="text-sm text-muted-foreground">{t('activePositions.empty')}</div>
                        </div>
                    ) : (
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
                    )}
                </div>

                {/* Recent Trades */}
                <div>
                    <h2 className="text-lg font-bold text-muted-foreground mb-4">{t('recentTrades.title')}</h2>
                    {trades.length === 0 ? (
                        <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-8 text-center">
                            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <div className="text-sm text-muted-foreground">{t('recentTrades.empty')}</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {trades.map((trade, i) => (
                                <div key={i} className="group bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-4 hover:border-white/10 transition-colors">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", trade.type === 'buy' ? 'bg-green-500/10' : 'bg-red-500/10')}>
                                                {trade.type === 'buy' ? (
                                                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white line-clamp-1 max-w-[300px] sm:max-w-md" title={trade.market}>
                                                    <span className={cn("font-bold mr-1.5", trade.type === 'buy' ? 'text-green-500' : 'text-red-500')}>
                                                        {trade.action}
                                                    </span>
                                                    {trade.market}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white font-mono">
                                                {trade.amount}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-muted-foreground pl-11">
                                        <div className="flex items-center gap-2">
                                            {/* Date / Time */}
                                            <span>{trade.date}, {trade.time}</span>
                                        </div>

                                        {/* Price / Shares Details - Only show if data exists */}
                                        {(trade.price || trade.shares) && (
                                            <div className="flex items-center gap-1.5">
                                                {trade.shares && <span>{trade.shares}</span>}
                                                {trade.price && trade.shares && <span>@</span>}
                                                {trade.price && <span className="text-white font-medium">{trade.price}</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
