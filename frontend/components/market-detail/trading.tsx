'use client';

import { GammaMarket } from '@catalyst-team/poly-sdk';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Wallet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { usePrivyLogin } from '@/lib/privy-login';
import { toast } from 'sonner';

interface MarketTradingProps {
    market: GammaMarket;
}

export function MarketTrading({ market }: MarketTradingProps) {
    const { authenticated, login, user, isLoggingIn } = usePrivyLogin();
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const price = outcome === 'yes' ? market.outcomePrices[0] : market.outcomePrices[1];
    const estimatedShares = amount ? Number(amount) / price : 0;

    // For real trading, we would need to fetch token IDs from the CLOB API using market.conditionId
    // The flow would be: polyClient.markets.getMarketInfo(conditionId) -> tokens[0/1].token_id
    // For demo mode, we use conditionId as reference
    const marketRef = market.conditionId;

    const handleTrade = async () => {
        if (!authenticated) {
            if (isLoggingIn) return;
            login();
            return;
        }

        if (!amount || Number(amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (!marketRef) {
            toast.error('Market information unavailable');
            return;
        }

        setIsLoading(true);

        try {
            // Note: For actual trading, user would need to:
            // 1. Have their Privy wallet funded with USDC
            // 2. Have authorized the trading contract
            // 
            // For now, we simulate the trade flow and show what would happen
            // Real implementation would use TradingService with user's private key

            // Simulate network delay for demo purposes
            await new Promise(resolve => setTimeout(resolve, 1500));

            // In real implementation:
            // const tradingService = new TradingService(rateLimiter, cache, { 
            //   privateKey: userPrivateKey 
            // });
            // await tradingService.initialize();
            // const result = await tradingService.createMarketOrder({
            //   tokenId,
            //   side: side.toUpperCase() as 'BUY' | 'SELL',
            //   amount: Number(amount),
            //   orderType: 'FOK'
            // });

            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-medium">Order Simulation Complete</span>
                    <span className="text-xs text-muted-foreground">
                        {side.toUpperCase()} {estimatedShares.toFixed(2)} {outcome.toUpperCase()} shares @ ${price.toFixed(3)}
                    </span>
                </div>
            );

            setAmount('');
        } catch (error: any) {
            console.error('Trade failed:', error);
            toast.error(error.message || 'Failed to place order. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="mb-4 font-semibold">Trade</h3>

            {/* Side Selector */}
            <div className="mb-6 grid grid-cols-2 rounded-lg bg-muted p-1">
                <button
                    onClick={() => setSide('buy')}
                    disabled={isLoading}
                    className={cn(
                        "rounded-md py-1.5 text-sm font-medium transition-all",
                        side === 'buy' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Buy
                </button>
                <button
                    onClick={() => setSide('sell')}
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                        disabled={isLoading}
                        min="1"
                        step="0.01"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-lg font-medium placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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
                    <span className="font-medium">${price.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Shares</span>
                    <span className="font-medium text-green-500">
                        {amount ? `${estimatedShares.toFixed(2)} ${outcome.toUpperCase()}` : '-'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Payout</span>
                    <span className="font-medium">
                        {amount ? `$${estimatedShares.toFixed(2)}` : '-'}
                    </span>
                </div>
            </div>

            {/* Action Button */}
            <button
                onClick={handleTrade}
                disabled={isLoading || (authenticated && (!amount || Number(amount) <= 0)) || (!authenticated && isLoggingIn)}
                className={cn(
                    "w-full rounded-lg py-3 font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                    side === 'buy' ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"
                )}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                    </>
                ) : !authenticated ? (
                    <>
                        {isLoggingIn ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Wallet className="h-4 w-4" />
                                Connect Wallet to Trade
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {side === 'buy' ? 'Buy' : 'Sell'} {outcome.toUpperCase()}
                    </>
                )}
            </button>

            {authenticated && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Connected: {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}</span>
                </div>
            )}

            {/* Demo Notice */}
            <div className="mt-4 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                    Demo Mode: Orders are simulated. Connect your wallet for real trading.
                </p>
            </div>
        </div>
    );
}
