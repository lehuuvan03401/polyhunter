'use client';

import { OrderForm } from '@/components/trading/order-form';
import { Orderbook, generateMockOrderbook } from '@/components/trading/orderbook';
import { Portfolio, generateMockPortfolio } from '@/components/trading/portfolio';
import { AlertsManager } from '@/components/ui/alerts-manager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TradingPage() {
    const orderbook = generateMockOrderbook();
    const portfolio = generateMockPortfolio();

    const handleOrderSubmit = (order: {
        side: 'YES' | 'NO';
        type: 'LIMIT' | 'MARKET';
        price: number;
        amount: number;
    }) => {
        console.log('Order submitted:', order);
        // TODO: Implement order submission via API
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Trading</h1>
                        <p className="text-silver-400">Professional trading interface</p>
                    </div>
                    <div className="glass px-4 py-2 rounded-lg border border-silver-600/20">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                            <span className="text-sm font-medium text-silver-200">Ready</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Column - Portfolio & Alerts */}
                    <div className="lg:col-span-1 space-y-6">
                        <Portfolio {...portfolio} />
                        <AlertsManager />
                    </div>

                    {/* Middle - Order Form & Orderbook */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <OrderForm onSubmit={handleOrderSubmit} />
                            <Orderbook {...orderbook} />
                        </div>

                        {/* Open Orders */}
                        <Card className="card-elegant">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-silver-100">Open Orders</CardTitle>
                                    <Badge variant="info">0 Active</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8">
                                    <div className="text-3xl mb-3">📝</div>
                                    <p className="text-silver-400">No open orders</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Order History */}
                    <div className="lg:col-span-1">
                        <Card className="card-elegant">
                            <CardHeader>
                                <CardTitle className="text-silver-100">Order History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8">
                                    <div className="text-3xl mb-3">📜</div>
                                    <p className="text-silver-400 text-sm">No order history</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
