'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, shortenAddress } from "@/lib/utils";
import Link from "next/link";

interface SmartMoneyWallet {
    address: string;
    pnl: number;
    volume: number;
    score: number;
    rank: number;
    winRate?: number;
    trades?: number;
}

interface LeaderboardTableProps {
    wallets: SmartMoneyWallet[];
    isLoading?: boolean;
}

export function LeaderboardTable({ wallets, isLoading }: LeaderboardTableProps) {
    if (isLoading) {
        return (
            <div className="glass rounded-xl p-12 text-center card-elegant">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-white/5 rounded w-1/4 mx-auto"></div>
                    <div className="h-4 bg-white/5 rounded w-1/2 mx-auto"></div>
                </div>
                <p className="text-silver-400 mt-4">Loading smart money data...</p>
            </div>
        );
    }

    if (!wallets || wallets.length === 0) {
        return (
            <div className="glass rounded-xl p-12 text-center card-elegant">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-bold gradient-text mb-2">No Data Available</h3>
                <p className="text-silver-400">Smart money leaderboard will appear here once data is loaded.</p>
            </div>
        );
    }

    return (
        <div className="glass rounded-xl overflow-hidden card-elegant">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">PnL</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Trades</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {wallets.map((wallet, index) => (
                        <TableRow key={wallet.address} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                            <TableCell>
                                <RankBadge rank={wallet.rank || index + 1} />
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <WalletAvatar address={wallet.address} />
                                    <div>
                                        <div className="font-mono text-sm text-silver-200">{shortenAddress(wallet.address)}</div>
                                        <div className="text-xs text-silver-500">Trader #{wallet.rank || index + 1}</div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <div className="text-lg font-bold gradient-text-emerald">{wallet.score || 0}</div>
                                    <div className="text-xs text-silver-500">/100</div>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <PnLDisplay value={wallet.pnl} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="font-semibold text-silver-200">{formatCurrency(wallet.volume || 0, 0)}</div>
                            </TableCell>
                            <TableCell className="text-right">
                                <WinRateBar value={wallet.winRate || 0.5} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="text-silver-400">{wallet.trades || 0}</div>
                            </TableCell>
                            <TableCell className="text-right">
                                <Link href={`/smart-money/${wallet.address}`}>
                                    <Button variant="secondary" size="sm">
                                        View
                                    </Button>
                                </Link>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function RankBadge({ rank }: { rank: number }) {
    const getVariant = () => {
        if (rank === 1) return 'success';
        if (rank <= 3) return 'warning';
        if (rank <= 10) return 'info';
        return 'default';
    };

    return (
        <Badge variant={getVariant()} className="w-10 h-10 rounded-full flex items-center justify-center font-bold">
            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
        </Badge>
    );
}

function WalletAvatar({ address }: { address: string }) {
    const colors = ['from-silver-500', 'from-emerald-500', 'from-silver-400', 'from-emerald-600'];
    const colorIndex = parseInt(address.slice(2, 4), 16) % colors.length;

    return (
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[colorIndex]} to-dark-700 flex items-center justify-center text-white font-bold shadow-glow-silver`}>
            {address.slice(2, 4).toUpperCase()}
        </div>
    );
}

function PnLDisplay({ value }: { value: number }) {
    const isPositive = value >= 0;

    return (
        <div className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-crimson-400'}`}>
            {isPositive ? '+' : ''}{formatCurrency(value)}
        </div>
    );
}

function WinRateBar({ value }: { value: number }) {
    const percent = Math.round(value * 100);
    const isGood = value >= 0.6;

    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-dark-700 rounded-full overflow-hidden border border-silver-600/20">
                <div
                    className={`h-full ${isGood ? 'bg-emerald-500' : 'bg-amber-500'} transition-all`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-sm font-medium w-10 text-right text-silver-300">{percent}%</span>
        </div>
    );
}
