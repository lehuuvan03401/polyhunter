'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CopyTradingConfig {
    selectedWallets: string[];
    copyRatio: number;
    maxPerTrade: number;
    slippage: number;
    orderType: 'MARKET' | 'LIMIT';
    testMode: boolean;
}

interface CopyTradingFormProps {
    onStart: (config: CopyTradingConfig) => void;
    onStop: () => void;
    isActive: boolean;
}

const SMART_WALLETS = [
    { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f9EC32', name: 'Whale #1', score: 95 },
    { address: '0x1A2b3C4d5E6f7890AbCdEf1234567890aBcDeF12', name: 'ProTrader', score: 88 },
    { address: '0x9876543210FeDcBa0987654321FeDcBa09876543', name: 'SmartMoney', score: 82 },
    { address: '0xDeadBeef123456789DeadBeef123456789DeaD00', name: 'Alpha Hunter', score: 79 },
];

export function CopyTradingForm({ onStart, onStop, isActive }: CopyTradingFormProps) {
    const [config, setConfig] = useState<CopyTradingConfig>({
        selectedWallets: [],
        copyRatio: 10,
        maxPerTrade: 500,
        slippage: 1,
        orderType: 'MARKET',
        testMode: true,
    });

    const toggleWallet = (address: string) => {
        setConfig(prev => ({
            ...prev,
            selectedWallets: prev.selectedWallets.includes(address)
                ? prev.selectedWallets.filter(w => w !== address)
                : [...prev.selectedWallets, address]
        }));
    };

    return (
        <Card className="card-elegant">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-silver-100">Copy Trading Configuration</CardTitle>
                    {isActive && (
                        <Badge variant="success" className="animate-pulse">
                            🔴 Active
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Wallet Selection */}
                <div>
                    <label className="block text-sm text-silver-400 mb-3">Select Wallets to Copy</label>
                    <div className="space-y-2">
                        {SMART_WALLETS.map(wallet => (
                            <button
                                key={wallet.address}
                                onClick={() => toggleWallet(wallet.address)}
                                className={`w-full p-3 rounded-lg border transition-all flex items-center justify-between ${config.selectedWallets.includes(wallet.address)
                                        ? 'bg-emerald-500/20 border-emerald-500/50'
                                        : 'bg-dark-800 border-silver-600/30 hover:border-silver-500'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-silver-500 to-dark-700 flex items-center justify-center text-white font-bold text-xs">
                                        {wallet.address.slice(2, 4)}
                                    </div>
                                    <span className="text-silver-200">{wallet.name}</span>
                                </div>
                                <Badge variant="info">Score: {wallet.score}</Badge>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Copy Ratio */}
                <div>
                    <label className="block text-sm text-silver-400 mb-2">
                        Copy Ratio: {config.copyRatio}%
                    </label>
                    <input
                        type="range"
                        value={config.copyRatio}
                        onChange={(e) => setConfig(prev => ({ ...prev, copyRatio: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        min="1"
                        max="100"
                    />
                    <div className="flex justify-between text-xs text-silver-500 mt-1">
                        <span>1%</span>
                        <span>100%</span>
                    </div>
                </div>

                {/* Max Per Trade */}
                <div>
                    <label className="block text-sm text-silver-400 mb-2">Max Per Trade (USD)</label>
                    <input
                        type="number"
                        value={config.maxPerTrade}
                        onChange={(e) => setConfig(prev => ({ ...prev, maxPerTrade: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 bg-dark-900 border border-silver-600/30 rounded-lg text-silver-100 focus:outline-none focus:border-emerald-500/50 transition"
                        min="10"
                        step="50"
                    />
                </div>

                {/* Slippage */}
                <div>
                    <label className="block text-sm text-silver-400 mb-2">
                        Slippage Tolerance: {config.slippage}%
                    </label>
                    <input
                        type="range"
                        value={config.slippage}
                        onChange={(e) => setConfig(prev => ({ ...prev, slippage: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        min="0.1"
                        max="5"
                        step="0.1"
                    />
                </div>

                {/* Order Type */}
                <div>
                    <label className="block text-sm text-silver-400 mb-3">Order Type</label>
                    <div className="flex gap-3">
                        <Badge
                            variant={config.orderType === 'MARKET' ? 'success' : 'default'}
                            className="cursor-pointer px-4 py-2"
                            onClick={() => setConfig(prev => ({ ...prev, orderType: 'MARKET' }))}
                        >
                            Market
                        </Badge>
                        <Badge
                            variant={config.orderType === 'LIMIT' ? 'success' : 'default'}
                            className="cursor-pointer px-4 py-2"
                            onClick={() => setConfig(prev => ({ ...prev, orderType: 'LIMIT' }))}
                        >
                            Limit
                        </Badge>
                    </div>
                </div>

                {/* Test Mode */}
                <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-lg border border-silver-600/20">
                    <div>
                        <p className="text-silver-200 font-medium">Test Mode</p>
                        <p className="text-xs text-silver-500">Simulate trades without real execution</p>
                    </div>
                    <button
                        onClick={() => setConfig(prev => ({ ...prev, testMode: !prev.testMode }))}
                        className={`w-12 h-6 rounded-full transition-all ${config.testMode ? 'bg-emerald-500' : 'bg-dark-600'
                            }`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.testMode ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 space-y-3">
                    {isActive ? (
                        <Button
                            variant="danger"
                            size="lg"
                            className="w-full"
                            onClick={onStop}
                        >
                            ⏹️ Stop Copy Trading
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            size="lg"
                            className="w-full"
                            onClick={() => onStart(config)}
                            disabled={config.selectedWallets.length === 0}
                        >
                            🚀 Start Copy Trading
                        </Button>
                    )}

                    {config.selectedWallets.length === 0 && !isActive && (
                        <p className="text-xs text-center text-silver-500">
                            Select at least one wallet to start
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
