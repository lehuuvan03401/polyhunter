'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ArbitrageOpportunity {
    marketId: string;
    marketName: string;
    type: 'LONG' | 'SHORT';
    profitRate: number;
    yesBid: number;
    yesAsk: number;
    noBid: number;
    noAsk: number;
    depth: number;
    suggestedAmount: number;
}

interface OpportunityCardProps {
    opportunity: ArbitrageOpportunity;
    onExecute?: (opportunity: ArbitrageOpportunity) => void;
}

export function OpportunityCard({ opportunity, onExecute }: OpportunityCardProps) {
    const profitPercent = (opportunity.profitRate * 100).toFixed(2);
    const isHighProfit = opportunity.profitRate >= 0.02;

    return (
        <Card className={`card-elegant animate-fade-in ${isHighProfit ? 'border-emerald-500/30' : ''}`}>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <Badge variant={opportunity.type === 'LONG' ? 'success' : 'warning'}>
                                {opportunity.type}
                            </Badge>
                            <h3 className="text-lg font-semibold text-silver-100 truncate max-w-[200px]">
                                {opportunity.marketName}
                            </h3>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-3xl font-bold ${isHighProfit ? 'text-emerald-400' : 'gradient-text-emerald'}`}>
                            +{profitPercent}%
                        </div>
                        <p className="text-xs text-silver-500 uppercase tracking-wide">Profit Rate</p>
                    </div>
                </div>

                {/* Price Details */}
                <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-dark-900/50 rounded-lg">
                    <div>
                        <p className="text-xs text-silver-500 mb-1">YES</p>
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-400">{(opportunity.yesBid * 100).toFixed(1)}¢</span>
                            <span className="text-silver-500">/</span>
                            <span className="text-crimson-400">{(opportunity.yesAsk * 100).toFixed(1)}¢</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-silver-500 mb-1">NO</p>
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-400">{(opportunity.noBid * 100).toFixed(1)}¢</span>
                            <span className="text-silver-500">/</span>
                            <span className="text-crimson-400">{(opportunity.noAsk * 100).toFixed(1)}¢</span>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs text-silver-500">Suggested</p>
                        <p className="font-semibold text-silver-200">${opportunity.suggestedAmount.toFixed(0)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-silver-500">Depth</p>
                        <p className="font-semibold text-silver-200">${opportunity.depth.toFixed(0)}</p>
                    </div>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onExecute?.(opportunity)}
                    >
                        Execute
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
