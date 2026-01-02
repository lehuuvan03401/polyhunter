'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSDK, useSDKServices } from '@/lib/hooks/use-sdk';
import { RealtimeArbitrageComponent } from '@/components/markets/realtime-arbitrage-component';
import type { ArbitrageOpportunity } from '@catalyst-team/poly-sdk';

export default function ArbitragePage() {
  const { sdk } = useSDK();
  const { detectArbitrage, getMarkets } = useSDKServices(sdk);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [marketDetails, setMarketDetails] = useState<any>(null);

  // Initial scan for arbitrage opportunities
  useEffect(() => {
    const scanForArbitrage = async () => {
      if (!sdk) return;

      try {
        setLoading(true);

        // Get trending markets to scan for arbitrage
        const markets = await getMarkets();
        if (!markets) return;

        const opportunities: ArbitrageOpportunity[] = [];

        // Scan the top 5 trending markets for arbitrage (reduced from 20 to save resources)
        // Use a sequential loop with small delay to avoid rate limits
        for (const market of markets.slice(0, 5)) {
          try {
            const arb = await detectArbitrage(market.conditionId, 0.005);
            if (arb) {
              opportunities.push(arb);
            }
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (err) {
            console.warn(`Failed to scan market ${market.conditionId}:`, err);
          }
        }

        setOpportunities(opportunities);
      } catch (error) {
        console.error('Error scanning for arbitrage:', error);
      } finally {
        setLoading(false);
      }
    };

    scanForArbitrage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk]);

  const handleMarketSelect = async (conditionId: string) => {
    setSelectedMarket(conditionId);
    // In a real implementation, you would fetch detailed market data here
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">套利机会</h1>
        <p className="text-slate-400">
          实时扫描市场价格差异，发现套利机会
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-500">
              {opportunities.length}
            </div>
            <div className="text-sm text-slate-400">当前机会</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">
              {opportunities.reduce((sum, opp) => sum + opp.profit, 0).toFixed(4)}
            </div>
            <div className="text-sm text-slate-400">累计潜在利润</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">24.7%</div>
            <div className="text-sm text-slate-400">成功率</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">12.4s</div>
            <div className="text-sm text-slate-400">平均执行时间</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Real-time Arbitrage Scanner */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>实时套利扫描</span>
                <Badge variant="success">活跃</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RealtimeArbitrageComponent />
            </CardContent>
          </Card>

          {/* Manual Scan Controls */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>手动扫描</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  扫描热门市场
                </Button>
                <Button variant="secondary" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  扫描所有市场
                </Button>
                <Button variant="secondary" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  自定义扫描
                </Button>
              </div>
            </CardContent>          </Card>

          {/* Opportunities List */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>套利机会列表</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-500">扫描中...</div>
              ) : opportunities.length > 0 ? (
                <div className="space-y-3">
                  {opportunities.map((opportunity, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-900/50 rounded-lg border border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{opportunity.type.toUpperCase()}</span>
                            <Badge variant={opportunity.type === 'long' ? 'info' : 'default'}>
                              {opportunity.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-400 mt-1 line-clamp-1">{opportunity.action}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-500 font-bold text-lg">
                            +{(opportunity.profit * 100).toFixed(3)}%
                          </div>
                          <div className="text-xs text-slate-400">
                            预期利润: {(opportunity.expectedProfit * 100).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <div>
                          <span className="text-slate-500">行动:</span>{' '}
                          <span className="text-slate-300">{opportunity.action}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  当前没有发现套利机会
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Market Details */}
        <div className="space-y-6">
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>市场详情</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMarket ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-slate-300 mb-2">条件ID</h3>
                    <p className="text-sm break-all bg-slate-900 p-2 rounded">{selectedMarket}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-300 mb-2">价格差异</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>YES 价格</span>
                        <span className="text-emerald-500">0.6543</span>
                      </div>
                      <div className="flex justify-between">
                        <span>NO 价格</span>
                        <span className="text-rose-500">0.3876</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-800">
                        <span>总和</span>
                        <span className="text-emerald-500 font-bold">1.0419</span>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                    执行套利
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  选择一个机会查看市场详情
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strategy Information */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>套利策略</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300">镜像套利</h4>
                  <p className="text-sm text-slate-500 mt-1">利用YES和NO代币之间的价格差异</p>
                </div>
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300">跨平台套利</h4>
                  <p className="text-sm text-slate-500 mt-1">在不同平台间寻找价格差异</p>
                </div>
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300">时间套利</h4>
                  <p className="text-sm text-slate-500 mt-1">利用短期价格波动</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}