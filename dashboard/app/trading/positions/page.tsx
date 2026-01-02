'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface Position {
    id: string;
    market: string;
    outcome: 'YES' | 'NO';
    shares: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
    value: number;
}

// Mock positions
const mockPositions: Position[] = [
    { id: '1', market: 'Will Bitcoin reach $100k in 2025?', outcome: 'YES', shares: 500, avgPrice: 0.45, currentPrice: 0.55, pnl: 50, pnlPercent: 22.2, value: 275 },
    { id: '2', market: 'US Presidential Election 2024', outcome: 'NO', shares: 300, avgPrice: 0.52, currentPrice: 0.48, pnl: -12, pnlPercent: -7.7, value: 144 },
    { id: '3', market: 'Will ETH flip BTC by 2026?', outcome: 'YES', shares: 1000, avgPrice: 0.15, currentPrice: 0.22, pnl: 70, pnlPercent: 46.7, value: 220 },
    { id: '4', market: 'SpaceX Mars landing by 2030?', outcome: 'YES', shares: 200, avgPrice: 0.35, currentPrice: 0.38, pnl: 6, pnlPercent: 8.6, value: 76 },
];

export default function PositionsPage() {
    const [sortBy, setSortBy] = useState<'value' | 'pnl'>('value');

    const sortedPositions = [...mockPositions].sort((a, b) =>
        sortBy === 'value' ? b.value - a.value : Math.abs(b.pnl) - Math.abs(a.pnl)
    );

    const totalValue = mockPositions.reduce((s, p) => s + p.value, 0);
    const totalPnL = mockPositions.reduce((s, p) => s + p.pnl, 0);
    const winningPositions = mockPositions.filter(p => p.pnl > 0).length;

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Positions</h1>
                        <p className="text-silver-400">Track and manage your open positions</p>
                    </div>
                    <a href="/trading" className="text-silver-400 hover:text-silver-200 transition">
                        ← Back to Trading
                    </a>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="card-elegant">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-silver-400 uppercase tracking-wide mb-1">Total Value</p>
                            <p className="text-2xl font-bold gradient-text">{formatCurrency(totalValue)}</p>
                        </CardContent>
                    </Card>
                    <Card className="card-elegant">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-silver-400 uppercase tracking-wide mb-1">Total PnL</p>
                            <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-crimson-400'}`}>
                                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="card-elegant">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-silver-400 uppercase tracking-wide mb-1">Positions</p>
                            <p className="text-2xl font-bold gradient-text">{mockPositions.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="card-elegant">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-silver-400 uppercase tracking-wide mb-1">Win Rate</p>
                            <p className="text-2xl font-bold text-emerald-400">
                                {formatPercent(winningPositions / mockPositions.length)}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Sort Controls */}
                <div className="flex gap-4 mb-6">
                    <Badge
                        variant={sortBy === 'value' ? 'success' : 'default'}
                        className="cursor-pointer px-4 py-2"
                        onClick={() => setSortBy('value')}
                    >
                        Sort by Value
                    </Badge>
                    <Badge
                        variant={sortBy === 'pnl' ? 'success' : 'default'}
                        className="cursor-pointer px-4 py-2"
                        onClick={() => setSortBy('pnl')}
                    >
                        Sort by PnL
                    </Badge>
                </div>

                {/* Positions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sortedPositions.map((position, index) => (
                        <PositionCard key={position.id} position={position} index={index} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function PositionCard({ position, index }: { position: Position; index: number }) {
    const isProfitable = position.pnl >= 0;

    return (
        <Card
            className="card-elegant hover:shadow-glow-silver transition-all animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <p className="text-silver-200 font-medium mb-2 line-clamp-2">{position.market}</p>
                        <Badge variant={position.outcome === 'YES' ? 'success' : 'danger'}>
                            {position.outcome}
                        </Badge>
                    </div>
                    <div className="text-right">
                        <p className={`text-xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-crimson-400'}`}>
                            {isProfitable ? '+' : ''}{formatCurrency(position.pnl)}
                        </p>
                        <p className={`text-sm ${isProfitable ? 'text-emerald-400' : 'text-crimson-400'}`}>
                            {isProfitable ? '+' : ''}{position.pnlPercent.toFixed(1)}%
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <p className="text-xs text-silver-500">Shares</p>
                        <p className="font-mono text-silver-200">{position.shares}</p>
                    </div>
                    <div>
                        <p className="text-xs text-silver-500">Avg Price</p>
                        <p className="font-mono text-silver-200">{(position.avgPrice * 100).toFixed(1)}¢</p>
                    </div>
                    <div>
                        <p className="text-xs text-silver-500">Current</p>
                        <p className="font-mono text-silver-200">{(position.currentPrice * 100).toFixed(1)}¢</p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-silver-600/20">
                    <div>
                        <p className="text-xs text-silver-500">Value</p>
                        <p className="font-bold gradient-text">{formatCurrency(position.value)}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm">Add</Button>
                        <Button variant="danger" size="sm">Close</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
