'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface Position {
    id: string;
    market: string;
    outcome: 'YES' | 'NO';
    shares: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
}

interface PortfolioProps {
    positions: Position[];
    totalValue: number;
    totalPnL: number;
}

export function Portfolio({ positions, totalValue, totalPnL }: PortfolioProps) {
    const isPositive = totalPnL >= 0;

    return (
        <Card className="card-elegant">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-silver-100">Portfolio</CardTitle>
                    <div className="text-right">
                        <p className="text-2xl font-bold gradient-text">{formatCurrency(totalValue)}</p>
                        <p className={`text-sm ${isPositive ? 'text-emerald-400' : 'text-crimson-400'}`}>
                            {isPositive ? '+' : ''}{formatCurrency(totalPnL)} ({isPositive ? '+' : ''}{((totalPnL / totalValue) * 100).toFixed(2)}%)
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {positions.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">💼</div>
                        <p className="text-silver-400">No positions yet</p>
                        <p className="text-sm text-silver-500 mt-1">Start trading to build your portfolio</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {positions.map((position) => (
                            <PositionCard key={position.id} position={position} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PositionCard({ position }: { position: Position }) {
    const isPositive = position.pnl >= 0;

    return (
        <div className="p-4 bg-dark-900/50 rounded-lg border border-silver-600/10 hover:border-silver-600/30 transition">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant={position.outcome === 'YES' ? 'success' : 'warning'}>
                            {position.outcome}
                        </Badge>
                        <span className="text-silver-200 font-medium truncate">{position.market}</span>
                    </div>
                    <p className="text-sm text-silver-500">
                        {position.shares} shares @ {(position.avgPrice * 100).toFixed(1)}¢
                    </p>
                </div>
                <div className="text-right">
                    <p className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-crimson-400'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(position.pnl)}
                    </p>
                    <p className={`text-sm ${isPositive ? 'text-emerald-400' : 'text-crimson-400'}`}>
                        {isPositive ? '+' : ''}{position.pnlPercent.toFixed(1)}%
                    </p>
                </div>
            </div>

            {/* Price bar */}
            <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isPositive ? 'bg-emerald-500' : 'bg-crimson-500'} transition-all`}
                        style={{ width: `${position.currentPrice * 100}%` }}
                    />
                </div>
                <span className="text-sm font-mono text-silver-300">
                    {(position.currentPrice * 100).toFixed(1)}¢
                </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1">
                    Add
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 text-crimson-400 hover:text-crimson-300">
                    Sell
                </Button>
            </div>
        </div>
    );
}

// Mock data generator
export function generateMockPortfolio(): { positions: Position[]; totalValue: number; totalPnL: number } {
    const positions: Position[] = [
        {
            id: '1',
            market: 'Will Bitcoin reach $100k in 2025?',
            outcome: 'YES',
            shares: 500,
            avgPrice: 0.45,
            currentPrice: 0.52,
            pnl: 35,
            pnlPercent: 15.5,
        },
        {
            id: '2',
            market: 'US Presidential Election 2024',
            outcome: 'NO',
            shares: 1000,
            avgPrice: 0.35,
            currentPrice: 0.41,
            pnl: 60,
            pnlPercent: 17.1,
        },
        {
            id: '3',
            market: 'Will ETH flip BTC by 2026?',
            outcome: 'YES',
            shares: 200,
            avgPrice: 0.22,
            currentPrice: 0.18,
            pnl: -8,
            pnlPercent: -18.2,
        },
    ];

    const totalValue = positions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0);
    const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

    return { positions, totalValue, totalPnL };
}
