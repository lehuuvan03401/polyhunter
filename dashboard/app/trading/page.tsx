'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSDK } from '@/lib/hooks/use-sdk';
import { useMarkets } from '@/lib/hooks/use-markets';
import type { Market } from '@catalyst-team/poly-sdk';

interface OrderForm {
  marketId: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  price: string;
  size: string;
  leverage?: string;
}

export default function TradingPage() {
  const { sdk, loading: sdkLoading } = useSDK();
  const { data: markets, isLoading: marketsLoading } = useMarkets({ limit: 50 });
  const [orderForm, setOrderForm] = useState<OrderForm>({
    marketId: '',
    tokenId: '',
    side: 'BUY',
    orderType: 'MARKET',
    price: '',
    size: '',
  });
  const [availableTokens, setAvailableTokens] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'order' | 'positions' | 'orders'>('order');

  // Set available tokens when market is selected
  useEffect(() => {
    if (orderForm.marketId && markets) {
      const selectedMarket = (markets && Array.isArray(markets)) ? markets.find(m => m.conditionId === orderForm.marketId) : undefined;
      if (selectedMarket) {
        // Create token options from market data
        const tokens = [
          { id: `${selectedMarket.conditionId}-yes`, name: 'YES Token', outcome: 'Yes', price: selectedMarket.yesPrice },
          { id: `${selectedMarket.conditionId}-no`, name: 'NO Token', outcome: 'No', price: selectedMarket.noPrice }
        ];
        setAvailableTokens(tokens);
        
        // Set default token if none selected
        if (!orderForm.tokenId) {
          setOrderForm(prev => ({
            ...prev,
            tokenId: tokens[0].id,
            price: tokens[0].price.toString()
          }));
        }
      }
    }
  }, [orderForm.marketId, markets, orderForm.tokenId]);

  const handleInputChange = (field: keyof OrderForm, value: string) => {
    setOrderForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePlaceOrder = async () => {
    if (!sdk) {
      setOrderStatus('SDK not initialized');
      return;
    }

    try {
      setOrderStatus('Submitting order...');
      
      // In a real implementation, we would use the SDK's trading service
      // For now, we'll simulate the order placement
      console.log('Placing order:', orderForm);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setOrderStatus('Order placed successfully!');
      
      // Reset form
      setOrderForm({
        marketId: orderForm.marketId,
        tokenId: orderForm.tokenId,
        side: 'BUY',
        orderType: 'MARKET',
        price: '',
        size: '',
      });
    } catch (error) {
      console.error('Error placing order:', error);
      setOrderStatus('Failed to place order: ' + (error as Error).message);
    }
  };

  const getMarketName = (conditionId: string) => {
    const market = (markets && Array.isArray(markets)) ? markets.find(m => m.conditionId === conditionId) : undefined;
    return market ? market.question.substring(0, 50) + (market.question.length > 50 ? '...' : '') : conditionId;
  };

  const getTokenName = (tokenId: string) => {
    const token = availableTokens.find(t => t.id === tokenId);
    return token ? `${token.outcome} Token` : tokenId;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">交易面板</h1>
        <p className="text-slate-400">
          在 Polymarket 上进行交易，管理您的订单和持仓
        </p>
      </div>

      {/* Account Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">${balance.toFixed(2)}</div>
            <div className="text-sm text-slate-400">可用余额</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">0</div>
            <div className="text-sm text-slate-400">持仓数量</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-500">+0.00</div>
            <div className="text-sm text-slate-400">未实现盈亏</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-200">0</div>
            <div className="text-sm text-slate-400">订单数量</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Trading Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Navigation */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader className="p-4 border-b border-slate-800">
              <div className="flex space-x-4">
                <button 
                  className={`px-3 py-1 rounded ${activeTab === 'order' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                  onClick={() => setActiveTab('order')}
                >
                  下单
                </button>
                <button 
                  className={`px-3 py-1 rounded ${activeTab === 'positions' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                  onClick={() => setActiveTab('positions')}
                >
                  持仓
                </button>
                <button 
                  className={`px-3 py-1 rounded ${activeTab === 'orders' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                  onClick={() => setActiveTab('orders')}
                >
                  订单
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {activeTab === 'order' && (
                <div className="space-y-6">
                  <div>
                    <Label>选择市场</Label>
                    <Select value={orderForm.marketId} onValueChange={(value) => handleInputChange('marketId', value)}>
                      <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectValue placeholder="选择一个市场" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800">
                                                                          {(markets && Array.isArray(markets)) ? markets.map((market) => (
                                                                            <SelectItem key={market.conditionId} value={market.conditionId} className="text-slate-200 hover:bg-slate-800">
                                                                              {getMarketName(market.conditionId)}
                                                                            </SelectItem>
                                                                          )) : null}
                      </SelectContent>
                    </Select>
                  </div>

                  {orderForm.marketId && (
                    <div>
                      <Label>选择代币</Label>
                      <Select value={orderForm.tokenId} onValueChange={(value) => handleInputChange('tokenId', value)}>
                        <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectValue placeholder="选择一个代币" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                          {availableTokens.map((token) => (
                            <SelectItem key={token.id} value={token.id} className="text-slate-200 hover:bg-slate-800">
                              {token.name} - ${token.price.toFixed(4)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>方向</Label>
                      <Select value={orderForm.side} onValueChange={(value) => handleInputChange('side', value as 'BUY' | 'SELL')}>
                        <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectValue placeholder="选择方向" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                          <SelectItem value="BUY" className="text-slate-200 hover:bg-slate-800">买入</SelectItem>
                          <SelectItem value="SELL" className="text-slate-200 hover:bg-slate-800">卖出</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>订单类型</Label>
                      <Select value={orderForm.orderType} onValueChange={(value) => handleInputChange('orderType', value as any)}>
                        <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectValue placeholder="选择类型" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                          <SelectItem value="MARKET" className="text-slate-200 hover:bg-slate-800">市价单</SelectItem>
                          <SelectItem value="LIMIT" className="text-slate-200 hover:bg-slate-800">限价单</SelectItem>
                          <SelectItem value="STOP" className="text-slate-200 hover:bg-slate-800">止损单</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(orderForm.orderType === 'LIMIT' || orderForm.orderType === 'STOP') && (
                    <div>
                      <Label>价格 (USDC)</Label>
                      <Input
                        type="number"
                        value={orderForm.price}
                        onChange={(e) => handleInputChange('price', e.target.value)}
                        placeholder="输入价格"
                        className="bg-slate-900 border-slate-800 text-slate-200"
                      />
                    </div>
                  )}

                  <div>
                    <Label>数量</Label>
                    <Input
                      type="number"
                      value={orderForm.size}
                      onChange={(e) => handleInputChange('size', e.target.value)}
                      placeholder="输入数量"
                      className="bg-slate-900 border-slate-800 text-slate-200"
                    />
                  </div>

                  <div className="pt-4">
                    <Button 
                      onClick={handlePlaceOrder} 
                      disabled={sdkLoading || !orderForm.marketId || !orderForm.tokenId || !orderForm.size}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-lg"
                    >
                      {orderForm.side === 'BUY' ? '买入' : '卖出'} {getTokenName(orderForm.tokenId)}
                    </Button>
                  </div>

                  {orderStatus && (
                    <div className={`p-3 rounded ${orderStatus.includes('成功') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                      {orderStatus}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'positions' && (
                <div className="text-center py-8 text-slate-500">
                  您当前没有持仓
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="text-center py-8 text-slate-500">
                  您当前没有活动订单
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market Depth */}
          {orderForm.marketId && (
            <Card className="bg-[#1a1d24] border-slate-800">
              <CardHeader>
                <CardTitle>市场深度 - {getMarketName(orderForm.marketId)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-slate-500">
                  市场深度图表
                  <br />
                  (在此处显示订单簿和市场深度)
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Market List */}
        <div className="space-y-6">
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>市场列表</CardTitle>
            </CardHeader>
            <CardContent>
              {marketsLoading ? (
                <div className="text-center py-8 text-slate-500">加载中...</div>
                             ) : markets && Array.isArray(markets) && markets.length > 0 ? (                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {markets.map((market) => (
                    <div 
                      key={market.conditionId} 
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        orderForm.marketId === market.conditionId 
                          ? 'border-emerald-500 bg-emerald-900/20' 
                          : 'border-slate-800 hover:bg-slate-800/50'
                      }`}
                      onClick={() => handleInputChange('marketId', market.conditionId)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-200 truncate">{market.question}</h3>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="success" className="text-xs">
                              YES {(market.yesPrice * 100).toFixed(2)}¢
                            </Badge>
                            <Badge variant="danger" className="text-xs">
                              NO {(market.noPrice * 100).toFixed(2)}¢
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="text-xs text-slate-400">
                            ${market.volume24h?.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  暂无市场数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trading Info */}
          <Card className="bg-[#1a1d24] border-slate-800">
            <CardHeader>
              <CardTitle>交易信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">交易费用</span>
                  <span className="text-slate-200">0.05%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">最小订单</span>
                  <span className="text-slate-200">$1.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">最大杠杆</span>
                  <span className="text-slate-200">1x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">状态</span>
                  <span className="text-emerald-500">正常</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}