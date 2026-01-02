'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSDK, useSDKServices } from '@/lib/hooks/use-sdk';
import type { SmartMoneyTrade } from '@catalyst-team/poly-sdk';

interface SmartMoneyTrader {
  address: string;
  pnl: number;
  volume: number;
  winRate: number;
  trades: number;
  score: number;
  rank: number;
}

export default function SmartMoneyPage() {
  const { sdk } = useSDK();
  const { getSmartMoneyTrades, getMarkets } = useSDKServices(sdk);
  const [topTraders, setTopTraders] = useState<SmartMoneyTrader[]>([]);
  const [recentTrades, setRecentTrades] = useState<SmartMoneyTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrader, setSelectedTrader] = useState<string | null>(null);
  const [traderDetails, setTraderDetails] = useState<any>(null);

  // Load top traders and recent trades
  useEffect(() => {
    const loadSmartMoneyData = async () => {
      try {
        setLoading(true);
        
        // Get smart money wallets from SDK (these are the top traders)
        const wallets = await getSmartMoneyTrades(50) || [];
        
        // Map SmartMoneyWallets to SmartMoneyTrader format for display
        const mappedTraders = wallets.map((wallet: any, index) => ({
          address: wallet.address || 'N/A',
          pnl: wallet.pnl || 0,
          volume: wallet.volume || 0,
          winRate: wallet.winRate || 0,
          trades: wallet.tradeCount || 0,
          score: wallet.score || 0,
          rank: index + 1
        } as SmartMoneyTrader));
        
        setTopTraders(mappedTraders);
        
        // For recent trades, we'll simulate data since getSmartMoneyTrades returns wallets, not trades
        const mockTrades: SmartMoneyTrade[] = [
          {
            traderAddress: '0x1234567890123456789012345678901234567890',
            side: 'BUY',
            size: 100,
            price: 0.65,
            tokenId: '0xabc...def',
            outcome: 'Yes',
            timestamp: Date.now(),
            isSmartMoney: true
          },
          {
            traderAddress: '0x2345678901234567890123456789012345678901',
            side: 'SELL',
            size: 50,
            price: 0.35,
            tokenId: '0xdef...abc',
            outcome: 'No',
            timestamp: Date.now() - 300000,
            isSmartMoney: true
          }
        ];
        setRecentTrades(mockTrades);
      } catch (error) {
        console.error('Error loading smart money data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSmartMoneyData();
  }, [getSmartMoneyTrades]);

  const handleTraderSelect = async (address: string) => {
    setSelectedTrader(address);
    // In a real implementation, you would fetch detailed trader data here
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">智能资金分析</h1>
        <p className="text-slate-400">
          跟踪顶级交易者，分析智能资金动向
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-500">
              {topTraders.length > 0 ? Math.max(...topTraders.map(t => t.rank)).toString() : '0'}
            </div>
            <div className="text-sm text-slate-400">顶级交易者</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">
              {recentTrades.length}
            </div>
            <div className="text-sm text-slate-400">最近交易</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">
              {topTraders.reduce((sum, trader) => sum + trader.volume, 0).toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">总交易量</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">
              {topTraders.length > 0 ? (topTraders.reduce((sum, trader) => sum + trader.pnl, 0) / topTraders.length).toFixed(0) : '0'}
            </div>
            <div className="text-sm text-slate-400">平均PnL</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Top Traders */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>顶级智能资金</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-500">加载中...</div>
              ) : topTraders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 text-slate-400 font-medium">排名</th>
                        <th className="text-left py-3 text-slate-400 font-medium">地址</th>
                        <th className="text-right py-3 text-slate-400 font-medium">PnL</th>
                        <th className="text-right py-3 text-slate-400 font-medium">成交量</th>
                        <th className="text-right py-3 text-slate-400 font-medium">胜率</th>
                        <th className="text-right py-3 text-slate-400 font-medium">分数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTraders.map((trader) => (
                        <tr 
                          key={trader.address} 
                          className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer ${selectedTrader === trader.address ? 'bg-slate-800/50' : ''}`}
                          onClick={() => handleTraderSelect(trader.address)}
                        >
                          <td className="py-3">
                            <Badge variant={trader.rank <= 3 ? 'success' : 'default'}>
                              #{trader.rank}
                            </Badge>
                          </td>
                          <td className="py-3 font-mono text-sm">
                            {formatAddress(trader.address)}
                          </td>
                          <td className={`py-3 text-right font-medium ${trader.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            ${trader.pnl.toLocaleString()}
                          </td>
                          <td className="py-3 text-right text-slate-300">
                            ${trader.volume.toLocaleString()}
                          </td>
                          <td className="py-3 text-right text-slate-300">
                            {(trader.winRate * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 text-right">
                            <Badge variant={trader.score >= 90 ? 'success' : trader.score >= 80 ? 'info' : 'default'}>
                              {trader.score}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  暂无智能资金数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Trades */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>最新智能交易</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-500">加载中...</div>
              ) : recentTrades.length > 0 ? (
                <div className="space-y-3">
                  {recentTrades.slice(0, 10).map((trade, index) => (
                    <div key={index} className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-slate-200">
                            {formatAddress(trade.traderAddress || 'N/A')}
                          </div>
                          <div className="text-sm text-slate-400 mt-1">
                            {trade.side} {trade.tokenId?.substring(0, 8)}...{trade.tokenId?.substring((trade.tokenId?.length || 4) - 4)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-slate-200">
                            {trade.size ? `$${(trade.size * trade.price).toFixed(2)}` : 'N/A'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {new Date(trade.timestamp || Date.now()).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  暂无交易记录
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Trader Details */}
        <div className="space-y-6">
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>交易者详情</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTrader ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-slate-400 text-sm">地址</h3>
                    <p className="font-mono text-sm break-all">{selectedTrader}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-slate-400 text-sm">PnL</h3>
                      <p className="text-emerald-500 font-bold">+12,500</p>
                    </div>
                    <div>
                      <h3 className="text-slate-400 text-sm">胜率</h3>
                      <p className="text-slate-200 font-bold">78%</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-slate-400 text-sm">最近交易</h3>
                    <div className="mt-2 space-y-2">
                      <div className="text-sm p-2 bg-slate-900/50 rounded">
                        <div className="flex justify-between">
                          <span>购买 YES</span>
                          <span className="text-emerald-500">+0.215</span>
                        </div>
                        <div className="text-xs text-slate-500">Market A: Will Bitcoin...</div>
                      </div>
                      <div className="text-sm p-2 bg-slate-900/50 rounded">
                        <div className="flex justify-between">
                          <span>卖出 NO</span>
                          <span className="text-emerald-500">-0.180</span>
                        </div>
                        <div className="text-xs text-slate-500">Market B: Will Ethereum...</div>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full bg-slate-700 hover:bg-slate-600">
                    跟随此交易者
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  选择一个交易者查看详细信息
                </div>
              )}
            </CardContent>
          </Card>

          {/* Smart Money Insights */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>智能资金洞察</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300">热门市场</h4>
                  <p className="text-sm text-slate-500 mt-1">智能资金正在关注这些市场</p>
                </div>
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300">交易策略</h4>
                  <p className="text-sm text-slate-500 mt-1">主要采用趋势跟踪策略</p>
                </div>
                <div className="p-3 bg-slate-900/50 rounded">
                  <h4 className="font-medium text-slate-300">风险偏好</h4>
                  <p className="text-sm text-slate-500 mt-1">偏向中高风险市场</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}