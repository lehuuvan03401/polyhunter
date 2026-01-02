'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeMarketData } from '@/lib/hooks/use-realtime-market-data';
import { type ArbitrageOpportunity } from '@catalyst-team/poly-sdk';

interface RealtimeArbitrageComponentProps {
  refreshInterval?: number;
}

export function RealtimeArbitrageComponent({ refreshInterval = 10000 }: RealtimeArbitrageComponentProps) {
  const { data, loading, error, refreshArbitrage } = useRealtimeMarketData();

  const handleRefresh = () => {
    refreshArbitrage();
  };

  if (loading) {
    return (
      <Card className="bg-[#1a1d24] border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>实时套利机会</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400">扫描中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#1a1d24] border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>实时套利机会</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-rose-500">错误: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1d24] border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>实时套利机会</CardTitle>
        <button 
          onClick={handleRefresh}
          className="text-sm bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
        >
          刷新
        </button>
      </CardHeader>
      <CardContent>
        {data.arbitrageOpportunities.length > 0 ? (
          <div className="space-y-3">
            {data.arbitrageOpportunities.map((opportunity, index) => (
              <div 
                key={index} 
                className="p-3 bg-slate-900/50 rounded border border-slate-800 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{opportunity.type.toUpperCase()} ARB</div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mt-1">{opportunity.action}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-500 font-bold">+{(opportunity.profit * 100).toFixed(2)}%</div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{(opportunity.expectedProfit * 100).toFixed(2)}% expected</div>
                  </div>
                </div>
                <div className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  类型: {opportunity.type.toUpperCase()}
                </div>              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-slate-500">
            暂无套利机会
          </div>
        )}
      </CardContent>
    </Card>
  );
}