'use client';

import { GammaMarket, ProcessedOrderbook } from '@catalyst-team/poly-sdk';
import { polyClient } from '@/lib/polymarket';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface MarketOrderbookProps {
    market: GammaMarket;
}

export function MarketOrderbook({ market }: MarketOrderbookProps) {
    const [orderbook, setOrderbook] = useState<ProcessedOrderbook | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOrderbook() {
            try {
                const ob = await polyClient.markets.getOrderbook(market.conditionId);
                setOrderbook(ob);
            } catch (e) {
                console.error('Failed to fetch orderbook', e);
            } finally {
                setLoading(false);
            }
        }

        // Fetch immediately and then poll every 5s
        fetchOrderbook();
        const interval = setInterval(fetchOrderbook, 5000);
        return () => clearInterval(interval);
    }, [market.conditionId]);

    if (loading && !orderbook) {
        return <div className="flex h-[200px] w-full items-center justify-center rounded-xl border bg-card/50"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    if (!orderbook) {
        return <div className="flex h-[200px] w-full items-center justify-center rounded-xl border bg-card/50">Orderbook Unavailable</div>;
    }

    // Helper to render rows
    const renderRow = (price: number, size: number, type: 'bid' | 'ask') => (
        <div className="flex justify-between py-1 text-sm">
            <span className={cn("font-mono font-medium", type === 'bid' ? "text-green-500" : "text-red-500")}>
                {price.toFixed(2)}
            </span>
            <span className="font-mono text-muted-foreground">{size.toFixed(0)}</span>
        </div>
    );

    return (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="mb-4 font-semibold">Orderbook</h3>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                        <span>Bid</span>
                        <span>Size</span>
                    </div>
                    <div className="space-y-0.5">
                        {/* YES Bids */}
                        <div className="text-xs font-semibold text-muted-foreground mb-1">
                            {market.outcomes?.[0] || 'YES'}
                        </div>
                        <div className="text-center italic text-xs text-muted-foreground">
                            Displaying aggregated top of book
                        </div>
                        {/* 
                We use the summary effective prices mostly, but here let's show the raw top level from summary if available 
                or just the processed Yes/No top levels.
                ProcessedOrderbook has yes: { bid, ask, ... } no: { bid, ask ... }
             */}
                        {renderRow(orderbook.yes.bid, orderbook.yes.bidSize, 'bid')}
                    </div>
                </div>

                <div>
                    <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                        <span>Ask</span>
                        <span>Size</span>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">
                            {market.outcomes?.[0] || 'YES'}
                        </div>
                        {renderRow(orderbook.yes.ask, orderbook.yes.askSize, 'ask')}
                    </div>
                </div>
            </div>

            <div className="mt-4 border-t pt-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Spread Analysis</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Long Arb Profit</span>
                        <span className={orderbook.summary.longArbProfit > 0 ? "text-green-500 font-bold" : "text-muted-foreground"}>
                            {(orderbook.summary.longArbProfit * 100).toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Short Arb Profit</span>
                        <span className={orderbook.summary.shortArbProfit > 0 ? "text-green-500 font-bold" : "text-muted-foreground"}>
                            {(orderbook.summary.shortArbProfit * 100).toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
