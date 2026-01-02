'use client';

import { useState } from 'react';
import { CopyTradingForm } from '@/components/smart-money/copy-trading-form';
import { CopyTradingStats } from '@/components/smart-money/copy-trading-stats';
import { TradeFeed } from '@/components/smart-money/trade-feed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CopyTradingConfig {
    selectedWallets: string[];
    copyRatio: number;
    maxPerTrade: number;
    slippage: number;
    orderType: 'MARKET' | 'LIMIT';
    testMode: boolean;
}

export default function CopyTradingPage() {
    const [isActive, setIsActive] = useState(false);
    const [stats, setStats] = useState({
        tradesDetected: 0,
        tradesExecuted: 0,
        successRate: 0,
        totalPnL: 0,
        activeTime: 0,
    });

    const handleStart = (config: CopyTradingConfig) => {
        console.log('Starting copy trading with config:', config);
        setIsActive(true);

        // Simulate stats updates
        const interval = setInterval(() => {
            setStats(prev => ({
                tradesDetected: prev.tradesDetected + Math.floor(Math.random() * 2),
                tradesExecuted: prev.tradesExecuted + (Math.random() > 0.3 ? 1 : 0),
                successRate: Math.min(100, prev.successRate + (Math.random() - 0.3) * 5),
                totalPnL: prev.totalPnL + (Math.random() - 0.4) * 50,
                activeTime: prev.activeTime + 5,
            }));
        }, 5000);

        // Store interval ID for cleanup
        (window as unknown as { copyTradingInterval?: NodeJS.Timeout }).copyTradingInterval = interval;
    };

    const handleStop = () => {
        setIsActive(false);
        const w = window as unknown as { copyTradingInterval?: NodeJS.Timeout };
        if (w.copyTradingInterval) {
            clearInterval(w.copyTradingInterval);
        }
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Copy Trading</h1>
                        <p className="text-silver-400">Automatically copy trades from smart money wallets</p>
                    </div>
                    <div className={`glass px-4 py-2 rounded-lg border ${isActive ? 'border-emerald-500/50' : 'border-silver-600/20'
                        }`}>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-silver-500'
                                }`} />
                            <span className="text-sm font-medium text-silver-200">
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="mb-8">
                    <CopyTradingStats isActive={isActive} stats={stats} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Configuration */}
                    <div>
                        <CopyTradingForm
                            onStart={handleStart}
                            onStop={handleStop}
                            isActive={isActive}
                        />
                    </div>

                    {/* Live Feed */}
                    <div>
                        <TradeFeed maxTrades={8} />
                    </div>
                </div>

                {/* Execution Log */}
                <Card className="card-elegant mt-8">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-silver-100">Execution Log</CardTitle>
                            <Badge variant={isActive ? 'success' : 'default'}>
                                {isActive ? 'Recording' : 'Idle'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12">
                            <div className="text-4xl mb-4">📋</div>
                            <p className="text-silver-400">
                                {isActive
                                    ? 'Waiting for trades to copy...'
                                    : 'Start copy trading to see execution logs'
                                }
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
