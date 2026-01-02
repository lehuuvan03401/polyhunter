'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, shortenAddress } from '@/lib/utils';

interface Trade {
    id: string;
    timestamp: Date;
    market: string;
    side: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    amount: number;
    price: number;
    pnl?: number;
    status: 'filled' | 'pending' | 'cancelled';
}

interface TradeHistoryTableProps {
    trades: Trade[];
    isLoading?: boolean;
    onLoadMore?: () => void;
    hasMore?: boolean;
}

export function TradeHistoryTable({ trades, isLoading, onLoadMore, hasMore }: TradeHistoryTableProps) {
    const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');

    const filteredTrades = trades.filter(t => {
        if (filter === 'all') return true;
        return filter === 'buy' ? t.side === 'BUY' : t.side === 'SELL';
    });

    return (
        <Card className="card-elegant">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-silver-100">Trade History</CardTitle>
                    <div className="flex gap-2">
                        {(['all', 'buy', 'sell'] as const).map((f) => (
                            <Badge
                                key={f}
                                variant={filter === f ? 'success' : 'default'}
                                className="cursor-pointer capitalize"
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </Badge>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : filteredTrades.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-4">📜</div>
                        <p className="text-silver-400">No trades found</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="grid grid-cols-6 text-xs text-silver-500 uppercase tracking-wide pb-3 border-b border-silver-600/20">
                            <span>Time</span>
                            <span className="col-span-2">Market</span>
                            <span className="text-center">Side</span>
                            <span className="text-right">Amount</span>
                            <span className="text-right">PnL</span>
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-silver-600/10">
                            {filteredTrades.map((trade, index) => (
                                <TradeRow key={trade.id} trade={trade} index={index} />
                            ))}
                        </div>

                        {/* Load More */}
                        {hasMore && onLoadMore && (
                            <div className="pt-4 text-center">
                                <button
                                    onClick={onLoadMore}
                                    className="px-4 py-2 text-sm text-silver-400 hover:text-silver-200 transition"
                                >
                                    Load More
                                </button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function TradeRow({ trade, index }: { trade: Trade; index: number }) {
    const isBuy = trade.side === 'BUY';
    const hasPnl = trade.pnl !== undefined;
    const isPnlPositive = (trade.pnl || 0) >= 0;

    return (
        <div
            className="grid grid-cols-6 py-4 items-center hover:bg-white/5 transition animate-fade-in"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            <span className="text-sm text-silver-400">
                {trade.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <br />
                <span className="text-xs text-silver-500">
                    {trade.timestamp.toLocaleDateString()}
                </span>
            </span>

            <span className="col-span-2 text-silver-200 truncate pr-4">
                {trade.market}
            </span>

            <div className="text-center">
                <Badge variant={isBuy ? 'success' : 'danger'} className="text-xs">
                    {trade.side}
                </Badge>
                <span className="block text-xs text-silver-500 mt-1">{trade.outcome}</span>
            </div>

            <span className="text-right font-mono text-silver-200">
                {formatCurrency(trade.amount)}
                <br />
                <span className="text-xs text-silver-500">@ {(trade.price * 100).toFixed(1)}¢</span>
            </span>

            <span className={`text-right font-mono ${hasPnl
                ? isPnlPositive ? 'text-emerald-400' : 'text-crimson-400'
                : 'text-silver-500'
                }`}>
                {hasPnl ? `${isPnlPositive ? '+' : ''}${formatCurrency(trade.pnl!)}` : '—'}
            </span>
        </div>
    );
}

// Mock data generator
export function generateMockTrades(): Trade[] {
    const markets = [
        'Will Bitcoin reach $100k in 2025?',
        'US Presidential Election 2024',
        'Will ETH flip BTC by 2026?',
        'Next Fed interest rate decision',
        'SpaceX Mars landing by 2030?',
    ];

    return Array.from({ length: 20 }, (_, i): Trade => ({
        id: `trade-${i}`,
        timestamp: new Date(Date.now() - i * 3600000 * (Math.random() * 5 + 1)),
        market: markets[Math.floor(Math.random() * markets.length)],
        side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        outcome: Math.random() > 0.5 ? 'YES' : 'NO',
        amount: Math.floor(Math.random() * 1000) + 50,
        price: Math.random() * 0.8 + 0.1,
        pnl: Math.random() > 0.3 ? (Math.random() - 0.4) * 200 : undefined,
        status: 'filled',
    })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
