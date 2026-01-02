'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeMarketData } from '@/lib/hooks/use-realtime-market-data';
import { type PriceUpdate } from '@catalyst-team/poly-sdk';

interface RealtimePriceComponentProps {
  tokenIds: string[];
}

export function RealtimePriceComponent({ tokenIds }: RealtimePriceComponentProps) {
  const { data, loading, error } = useRealtimeMarketData(tokenIds);

  if (loading) {
    return (
      <Card className="bg-[#1a1d24] border-slate-800">
        <CardHeader>
          <CardTitle>实时价格</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#1a1d24] border-slate-800">
        <CardHeader>
          <CardTitle>实时价格</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-rose-500">错误: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1d24] border-slate-800">
      <CardHeader>
        <CardTitle>实时价格</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tokenIds.map(tokenId => {
            const priceUpdate = data.prices[tokenId];
            return (
              <div key={tokenId} className="flex justify-between items-center p-2 bg-slate-900/50 rounded">
                <span className="text-sm font-mono">{tokenId.slice(0, 8)}...{tokenId.slice(-4)}</span>
                {priceUpdate ? (
                  <span className={`font-mono ${priceUpdate.price >= 0.5 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {priceUpdate.price.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-slate-500 text-sm">-</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}