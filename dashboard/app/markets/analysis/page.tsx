'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSDK, useSDKServices } from '@/lib/hooks/use-sdk';
import { useMarkets } from '@/lib/hooks/use-markets';
import type { Market } from '@/lib/hooks/use-markets';

interface MarketAnalysis {
  marketId: string;
  volatility: number;
  liquidityScore: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  smartMoneyFlow: number;
  volumeTrend: number;
  arbitragePotential: number;
}

export default function MarketAnalysisPage() {
  const { sdk } = useSDK();
  const { getMarkets, detectArbitrage } = useSDKServices(sdk);
  const { data: markets, isLoading: marketsLoading } = useMarkets({ limit: 20 });
  const [analysisData, setAnalysisData] = useState<MarketAnalysis[]>([]);

  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d'>('24h');
  const [loading, setLoading] = useState(true);

  // Perform market analysis
  useEffect(() => {
    const performAnalysis = async () => {
      try {
        setLoading(true);
        
        if (markets && Array.isArray(markets)) {
          const analysisResults: MarketAnalysis[] = [];
          
          for (const market of markets) {
            // Simulate analysis data (in a real implementation, this would come from SDK analysis functions)
            const analysis: MarketAnalysis = {
              marketId: market.conditionId,
              volatility: Math.random() * 0.3, // Random volatility between 0-30%
              liquidityScore: Math.random() * 100, // Random liquidity score 0-100
              trend: Math.random() > 0.6 ? 'bullish' : Math.random() > 0.3 ? 'neutral' : 'bearish',
              smartMoneyFlow: (Math.random() - 0.5) * 2, // Random flow between -1 and 1
              volumeTrend: (Math.random() - 0.5) * 0.5, // Random trend between -0.5 and 0.5
              arbitragePotential: Math.random() * 0.1, // Random potential between 0-10%
            };
            
            analysisResults.push(analysis);
          }
          
          setAnalysisData(analysisResults);
        }
      } catch (error) {
        console.error('Error performing market analysis:', error);
      } finally {
        setLoading(false);
      }
    };

    performAnalysis();
  }, [markets]);

  const handleMarketSelect = (market: Market) => {
    setSelectedMarket(market);
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'bullish': return 'text-emerald-500';
      case 'bearish': return 'text-rose-500';
      default: return 'text-slate-400';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'bullish': return '📈';
      case 'bearish': return '📉';
      default: return '➡️';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">市场分析</h1>
        <p className="text-slate-400">
          深入分析市场数据，识别交易机会
        </p>
      </div>

      {/* Timeframe Selector */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={timeframe === '1h' ? 'primary' : 'secondary'}
          onClick={() => setTimeframe('1h')}
          className={timeframe === '1h' ? 'bg-slate-800 border-slate-700' : 'border-slate-800 text-slate-400 hover:bg-slate-900'}
        >
          1小时
        </Button>
        <Button
          variant={timeframe === '24h' ? 'primary' : 'secondary'}
          onClick={() => setTimeframe('24h')}
          className={timeframe === '24h' ? 'bg-slate-800 border-slate-700' : 'border-slate-800 text-slate-400 hover:bg-slate-900'}
        >
          24小时
        </Button>
        <Button
          variant={timeframe === '7d' ? 'primary' : 'secondary'}
          onClick={() => setTimeframe('7d')}
          className={timeframe === '7d' ? 'bg-slate-800 border-slate-700' : 'border-slate-800 text-slate-400 hover:bg-slate-900'}
        >
          7天
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-xl font-bold text-slate-200">{(markets && Array.isArray(markets) ? markets.length : 0)}</div>
            <div className="text-sm text-slate-400">分析市场</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-xl font-bold text-emerald-500">
              {analysisData.filter(a => a.trend === 'bullish').length}
            </div>
            <div className="text-sm text-slate-400">看涨市场</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-xl font-bold text-rose-500">
              {analysisData.filter(a => a.trend === 'bearish').length}
            </div>
            <div className="text-sm text-slate-400">看跌市场</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-xl font-bold text-slate-200">
              {((analysisData.reduce((sum, a) => sum + a.liquidityScore, 0) / (analysisData.length || 1)) || 0).toFixed(0)}
            </div>
            <div className="text-sm text-slate-400">平均流动性</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-xl font-bold text-slate-200">
              {analysisData.filter(a => a.arbitragePotential > 0.01).length}
            </div>
            <div className="text-sm text-slate-400">套利机会</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Market List with Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>市场分析列表</CardTitle>
            </CardHeader>
            <CardContent>
              {loading || marketsLoading ? (
                <div className="text-center py-8 text-slate-500">分析中...</div>
              ) : analysisData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 text-slate-400 font-medium">市场</th>
                        <th className="text-center py-3 text-slate-400 font-medium">趋势</th>
                        <th className="text-right py-3 text-slate-400 font-medium">波动率</th>
                        <th className="text-right py-3 text-slate-400 font-medium">流动性</th>
                        <th className="text-right py-3 text-slate-400 font-medium">智能资金</th>
                        <th className="text-right py-3 text-slate-400 font-medium">套利潜力</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisData.map((analysis, index) => {
                        const market = (markets && Array.isArray(markets)) ? markets.find(m => m.conditionId === analysis.marketId) : undefined;
                        return (
                          <tr 
                            key={analysis.marketId} 
                            className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                            onClick={() => market && handleMarketSelect(market)}
                          >
                            <td className="py-3">
                              <div className="font-medium text-slate-200 max-w-xs truncate">
                                {market?.question.substring(0, 50) || analysis.marketId.substring(0, 10)}...
                              </div>
                              <div className="text-xs text-slate-500">
                                {market && `${(market.yesPrice * 100).toFixed(2)}% / ${(market.noPrice * 100).toFixed(2)}%`}
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <div className={`flex items-center justify-center ${getTrendColor(analysis.trend)}`}>
                                <span className="mr-1">{getTrendIcon(analysis.trend)}</span>
                                <span className="capitalize">{analysis.trend}</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <span className="text-slate-300">{(analysis.volatility * 100).toFixed(2)}%</span>
                            </td>
                            <td className="py-3 text-right">
                              <Badge variant={analysis.liquidityScore > 70 ? 'success' : analysis.liquidityScore > 40 ? 'info' : 'default'}>
                                {analysis.liquidityScore.toFixed(0)}
                              </Badge>
                            </td>
                            <td className={`py-3 text-right ${analysis.smartMoneyFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {(analysis.smartMoneyFlow * 100).toFixed(2)}%
                            </td>
                            <td className="py-3 text-right">
                              <span className={`${analysis.arbitragePotential > 0.01 ? 'text-emerald-500 font-bold' : 'text-slate-400'}`}>
                                {(analysis.arbitragePotential * 100).toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  暂无市场分析数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market Metrics */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>市场指标</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-900/50 rounded">
                  <div className="text-2xl font-bold text-slate-200">24.7%</div>
                  <div className="text-xs text-slate-500">平均波动率</div>
                </div>
                <div className="text-center p-4 bg-slate-900/50 rounded">
                  <div className="text-2xl font-bold text-slate-200">82.3</div>
                  <div className="text-xs text-slate-500">平均流动性</div>
                </div>
                <div className="text-center p-4 bg-slate-900/50 rounded">
                  <div className="text-2xl font-bold text-emerald-500">68%</div>
                  <div className="text-xs text-slate-500">看涨比例</div>
                </div>
                <div className="text-center p-4 bg-slate-900/50 rounded">
                  <div className="text-2xl font-bold text-slate-200">12.4%</div>
                  <div className="text-xs text-slate-500">套利机会率</div>
                </div>
              </div>
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
                  <h3 className="font-medium text-slate-300">{selectedMarket.question}</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-900/50 rounded">
                      <div className="text-xs text-slate-500">YES 价格</div>
                      <div className="text-lg font-bold text-emerald-500">{(selectedMarket.yesPrice * 100).toFixed(2)}¢</div>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded">
                      <div className="text-xs text-slate-500">NO 价格</div>
                      <div className="text-lg font-bold text-rose-500">{(selectedMarket.noPrice * 100).toFixed(2)}¢</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">成交量 (24h)</span>
                      <span className="text-slate-200">${selectedMarket.volume24h?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">流动性</span>
                      <span className="text-slate-200">${selectedMarket.liquidity?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">截止日期</span>
                      <span className="text-slate-200">{selectedMarket.endDate ? new Date(selectedMarket.endDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button className="w-full bg-slate-700 hover:bg-slate-600">
                      查看详细分析
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  选择一个市场查看详细分析
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Insights */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>分析洞察</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300 flex items-center">
                    <span className="mr-2">🔍</span> 热门机会
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">基于当前市场趋势的高概率机会</p>
                </div>
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300 flex items-center">
                    <span className="mr-2">💡</span> 智能建议
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">根据智能资金流的交易建议</p>
                </div>
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300 flex items-center">
                    <span className="mr-2">⚠️</span> 风险提示
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">当前市场的主要风险因素</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}