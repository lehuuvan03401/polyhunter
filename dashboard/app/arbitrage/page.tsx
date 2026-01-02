'use client';

import { useState } from 'react';
import { ScannerConfig } from '@/components/arbitrage/scanner-config';
import { OpportunityCard } from '@/components/arbitrage/opportunity-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useArbitrageScan } from '@/lib/hooks/use-arbitrage';

export default function ArbitragePage() {
    const [scanConfig, setScanConfig] = useState({ minVolume: 1000, profitThreshold: 0.01 });
    const { data: opportunities, isLoading, error, refetch } = useArbitrageScan(
        scanConfig.minVolume,
        scanConfig.profitThreshold
    );

    const handleScan = (config: { minVolume: number; profitThreshold: number }) => {
        setScanConfig(config);
        refetch();
    };

    const handleExecute = (opportunity: { marketId: string }) => {
        console.log('Executing arbitrage for:', opportunity.marketId);
        // TODO: Implement execution logic
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Arbitrage Monitor</h1>
                        <p className="text-silver-400">Scan and execute profitable arbitrage opportunities</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="glass px-4 py-2 rounded-lg border border-silver-600/20">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                                <span className="text-sm font-medium text-silver-200">
                                    {opportunities?.length || 0} Opportunities
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Scanner Config - Left Sidebar */}
                    <div className="lg:col-span-1">
                        <ScannerConfig onScan={handleScan} isScanning={isLoading} />

                        {/* Quick Stats */}
                        <Card className="card-elegant mt-6">
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-silver-400">Total Scanned</span>
                                    <Badge variant="info">{opportunities?.length || 0}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-silver-400">High Profit</span>
                                    <Badge variant="success">
                                        {opportunities?.filter(o => o.profitRate >= 0.02).length || 0}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-silver-400">Avg Profit</span>
                                    <span className="font-semibold text-emerald-400">
                                        {opportunities?.length
                                            ? (opportunities.reduce((s, o) => s + o.profitRate, 0) / opportunities.length * 100).toFixed(2)
                                            : 0}%
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Opportunities Grid */}
                    <div className="lg:col-span-3">
                        {/* Error State */}
                        {error && (
                            <Card className="border-crimson-600 mb-6">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3 text-crimson-400">
                                        <span className="text-2xl">⚠️</span>
                                        <div>
                                            <div className="font-bold">Error Scanning Markets</div>
                                            <div className="text-sm text-silver-400">
                                                {error instanceof Error ? error.message : 'Failed to scan'}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Loading State */}
                        {isLoading && (
                            <div className="glass rounded-xl p-12 text-center card-elegant animate-pulse">
                                <div className="text-4xl mb-4">🔍</div>
                                <p className="text-silver-400">Scanning markets for opportunities...</p>
                            </div>
                        )}

                        {/* Empty State */}
                        {!isLoading && (!opportunities || opportunities.length === 0) && (
                            <div className="glass rounded-xl p-12 text-center card-elegant">
                                <div className="text-6xl mb-6">💰</div>
                                <h2 className="text-2xl font-bold gradient-text mb-4">No Opportunities Found</h2>
                                <p className="text-silver-400 mb-3">
                                    Try adjusting the profit threshold or minimum volume settings
                                </p>
                                <p className="text-sm text-silver-500">
                                    The scanner will automatically refresh every 10 seconds
                                </p>
                            </div>
                        )}

                        {/* Opportunities Grid */}
                        {opportunities && opportunities.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {opportunities.map((opp, index) => (
                                    <div key={opp.marketId} style={{ animationDelay: `${index * 100}ms` }}>
                                        <OpportunityCard
                                            opportunity={opp}
                                            onExecute={handleExecute}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
