'use client';

import { GammaMarket } from '@catalyst-team/poly-sdk';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Wallet } from 'lucide-react';

interface MarketTradingProps {
    market: GammaMarket;
}

export function MarketTrading({ market }: MarketTradingProps) {
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
    const [amount, setAmount] = useState('');

    const price = outcome === 'yes' ? market.outcomePrices[0] : market.outcomePrices[1];

    return (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="mb-4 font-semibold">Trade</h3>

            {/* Side Selector */}
            <div className="mb-6 grid grid-cols-2 rounded-lg bg-muted p-1">
                <button
                    onClick={() => setSide('buy')}
                    className={cn(
                        "rounded-md py-1.5 text-sm font-medium transition-all",
                        side === 'buy' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Buy
                </button>
                <button
                    onClick={() => setSide('sell')}
                    className={cn(
                        "rounded-md py-1.5 text-sm font-medium transition-all",
                        side === 'sell' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Sell
                </button>
            </div>

            {/* Outcome Selector */}
            <div className="mb-6 grid grid-cols-2 gap-3">
                <button
                    onClick={() => setOutcome('yes')}
                    className={cn(
                        "border border-border rounded-lg p-3 text-left transition-all",
                        outcome === 'yes'
                            ? "border-green-500 bg-green-500/5 ring-1 ring-green-500"
                            : "hover:border-green-500/50"
                    )}
                >
                    <div className="text-sm font-medium text-green-500">YES</div>
                    <div className="text-lg font-bold">{(market.outcomePrices[0] * 100).toFixed(1)}%</div>
                </button>
                <button
                    onClick={() => setOutcome('no')}
                    className={cn(
                        "border border-border rounded-lg p-3 text-left transition-all",
                        outcome === 'no'
                            ? "border-red-500 bg-red-500/5 ring-1 ring-red-500"
                            : "hover:border-red-500/50"
                    )}
                >
                    <div className="text-sm font-medium text-red-500">NO</div>
                    <div className="text-lg font-bold">{(market.outcomePrices[1] * 100).toFixed(1)}%</div>
                </button>
            </div>

            {/* Amount Input */}
            <div className="mb-6 space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Amount (USDC)</label>
                <div className="relative">
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-lg font-medium placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        USDC
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="mb-6 space-y-2 rounded-lg bg-secondary/50 p-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-medium">${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Return</span>
                    <span className="font-medium text-green-500">
                        {amount ? `$${(Number(amount) / price).toFixed(2)}` : '-'}
                    </span>
                </div>
            </div>

            {/* Action Button */}
            <button
                className={cn(
                    "w-full rounded-lg py-3 font-semibold text-white shadow-sm transition-all active:scale-[0.98]",
                    side === 'buy' ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
                )}
            >
                {side === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Wallet className="h-3 w-3" />
                <span>Connect wallet to trade</span>
            </div>
        </div>
    );
}
