'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, shortenAddress } from '@/lib/utils';

interface Trade {
    id: string;
    trader: string;
    market: string;
    side: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    amount: number;
    price: number;
    timestamp: Date;
}

interface TradeCardProps {
    trade: Trade;
}

export function TradeCard({ trade }: TradeCardProps) {
    const isBuy = trade.side === 'BUY';
    const timeAgo = getTimeAgo(trade.timestamp);

    // Generate avatar color from trader address
    const colors = ['from-silver-500', 'from-emerald-500', 'from-silver-400', 'from-emerald-600'];
    const colorIndex = parseInt(trade.trader.slice(2, 4), 16) % colors.length;

    return (
        <Card className="card-elegant animate-slide-in hover:shadow-glow-silver transition-all">
            <CardContent className="py-4 px-5">
                <div className="flex items-center gap-4">
                    {/* Trader Avatar */}
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[colorIndex]} to-dark-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                        {trade.trader.slice(2, 4).toUpperCase()}
                    </div>

                    {/* Trade Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm text-silver-200">{shortenAddress(trade.trader)}</span>
                            <Badge variant={isBuy ? 'success' : 'danger'} className="text-xs">
                                {trade.side}
                            </Badge>
                            <Badge variant={trade.outcome === 'YES' ? 'success' : 'warning'} className="text-xs">
                                {trade.outcome}
                            </Badge>
                        </div>
                        <p className="text-sm text-silver-400 truncate">{trade.market}</p>
                    </div>

                    {/* Amount & Time */}
                    <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${isBuy ? 'text-emerald-400' : 'text-crimson-400'}`}>
                            {isBuy ? '+' : '-'}{formatCurrency(trade.amount)}
                        </p>
                        <p className="text-xs text-silver-500">@ {(trade.price * 100).toFixed(1)}¢ · {timeAgo}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}
