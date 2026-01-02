'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ScannerConfigProps {
    onScan: (config: { minVolume: number; profitThreshold: number }) => void;
    isScanning?: boolean;
}

export function ScannerConfig({ onScan, isScanning }: ScannerConfigProps) {
    const [minVolume, setMinVolume] = useState(1000);
    const [profitThreshold, setProfitThreshold] = useState(1);

    const handleScan = () => {
        onScan({ minVolume, profitThreshold: profitThreshold / 100 });
    };

    return (
        <Card className="card-elegant">
            <CardHeader>
                <CardTitle className="text-silver-100">Scanner Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Min Volume */}
                <div>
                    <label className="block text-sm text-silver-400 mb-2">
                        Minimum Volume (USD)
                    </label>
                    <input
                        type="number"
                        value={minVolume}
                        onChange={(e) => setMinVolume(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-3 bg-dark-900 border border-silver-600/30 rounded-lg text-silver-100 focus:outline-none focus:border-emerald-500/50 transition"
                        min="0"
                        step="100"
                    />
                </div>

                {/* Profit Threshold */}
                <div>
                    <label className="block text-sm text-silver-400 mb-2">
                        Profit Threshold: {profitThreshold}%
                    </label>
                    <input
                        type="range"
                        value={profitThreshold}
                        onChange={(e) => setProfitThreshold(parseFloat(e.target.value))}
                        className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        min="0.1"
                        max="5"
                        step="0.1"
                    />
                    <div className="flex justify-between text-xs text-silver-500 mt-1">
                        <span>0.1%</span>
                        <span>5%</span>
                    </div>
                </div>

                {/* Scan Button */}
                <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleScan}
                    isLoading={isScanning}
                >
                    {isScanning ? 'Scanning...' : '🔍 Scan Markets'}
                </Button>
            </CardContent>
        </Card>
    );
}
