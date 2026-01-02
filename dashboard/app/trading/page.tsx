'use client';

import { OrderForm } from '@/components/trading/order-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TradingPage() {
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Order Form */}
                    <div className="lg:col-span-1">
                        <OrderForm onSubmit={handleOrderSubmit} />
                    </div>

                    {/* Main Area */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Open Orders */}
                        <Card className="card-elegant">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-silver-100">Open Orders</CardTitle>
                                    <Badge variant="info">0 Active</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-4">📝</div>
                                    <p className="text-silver-400">No open orders</p>
                                    <p className="text-sm text-silver-500 mt-2">Place an order to get started</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Positions */}
                        <Card className="card-elegant">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-silver-100">Positions</CardTitle>
                                    <Badge variant="success">$0.00 PnL</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-4">💼</div>
                                    <p className="text-silver-400">No active positions</p>
                                    <p className="text-sm text-silver-500 mt-2">Your positions will appear here</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order History */}
                        <Card className="card-elegant">
                            <CardHeader>
                                <CardTitle className="text-silver-100">Order History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-4">📜</div>
                                    <p className="text-silver-400">No order history</p>
                                    <p className="text-sm text-silver-500 mt-2">Your completed orders will appear here</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
