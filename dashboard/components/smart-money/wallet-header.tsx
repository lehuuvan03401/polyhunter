'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { shortenAddress, formatCurrency } from '@/lib/utils';

interface WalletHeaderProps {
    address: string;
    score?: number;
    pnl?: number;
    rank?: number;
    isSmartMoney?: boolean;
}

export function WalletHeader({ address, score, pnl, rank, isSmartMoney }: WalletHeaderProps) {
    const isPositive = (pnl || 0) >= 0;

    return (
        <Card className="animate-fade-in card-elegant hover:shadow-glow-silver transition-all">
            <CardContent className="pt-8 pb-8">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-8">
                        {/* Avatar */}
                        <WalletAvatar address={address} size="large" />

                        {/* Info */}
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <h2 className="text-3xl font-bold font-mono text-silver-100">{shortenAddress(address, 6)}</h2>
                                {isSmartMoney && (
                                    <Badge variant="success" className="text-sm px-3 py-1">
                                        💎 Smart Money
                                    </Badge>
                                )}
                                {rank && rank <= 10 && (
                                    <Badge variant="warning" className="text-sm px-3 py-1">
                                        🏆 Top {rank}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-silver-400 text-sm mb-6">Professional Trader Profile</p>

                            {/* Quick Stats */}
                            <div className="flex items-center gap-8">
                                <div>
                                    <p className="text-xs text-silver-500 mb-2 uppercase tracking-wide">Smart Score</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold gradient-text-emerald">{score || 0}</span>
                                        <span className="text-silver-500 text-lg">/100</span>
                                    </div>
                                </div>
                                <div className="h-16 w-px bg-silver-600/30" />
                                <div>
                                    <p className="text-xs text-silver-500 mb-2 uppercase tracking-wide">Total PnL</p>
                                    <div className={`text-3xl font-bold ${isPositive ? 'text-emerald-400' : 'text-crimson-400'}`}>
                                        {isPositive ? '+' : ''}{formatCurrency(pnl || 0)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" size="sm">
                            📋 Copy Address
                        </Button>
                        <Button variant="primary" size="sm">
                            🔔 Follow Trader
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function WalletAvatar({ address, size = 'medium' }: { address: string; size?: 'medium' | 'large' }) {
    const colors = ['from-silver-500', 'from-emerald-500', 'from-silver-400', 'from-emerald-600'];
    const colorIndex = parseInt(address.slice(2, 4), 16) % colors.length;

    const sizeClasses = {
        medium: 'w-12 h-12 text-lg',
        large: 'w-24 h-24 text-3xl',
    };

    return (
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colors[colorIndex]} to-dark-700 flex items-center justify-center text-white font-bold shadow-glow-emerald border border-silver-600/20`}>
            {address.slice(2, 4).toUpperCase()}
        </div>
    );
}
