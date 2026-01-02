'use client';

import Link from 'next/link';
import { OrderForm } from '@/components/trading/order-form';
import { Orderbook, generateMockOrderbook } from '@/components/trading/orderbook';
import { Portfolio, generateMockPortfolio } from '@/components/trading/portfolio';
import { AlertsManager } from '@/components/ui/alerts-manager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
        // TODO: Implement order submission via SDK TradingService
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Trading</h1>
                        <p className="text-silver-400">Professional trading interface</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/trading/orders">
                            <Button variant="secondary">📋 Manage Orders</Button>
                        </Link>
                        <Link href="/trading/positions">
                            <Button variant="secondary">💼 View Positions</Button>
                        </Link>
                        <div className="glass px-4 py-2 rounded-lg border border-silver-600/20">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
                                <span className="text-sm font-medium text-silver-200">Ready</span>
                            </div>
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

                        {/* Open Orders Preview */}
                        <Card className="card-elegant">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-silver-100">Open Orders</CardTitle>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="info">0 Active</Badge>
                                        <Link href="/trading/orders" className="text-sm text-silver-400 hover:text-silver-200 transition">
                                            View All →
                                        </Link>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8">
                                    <div className="text-3xl mb-3">📝</div>
                                    <p className="text-silver-400">No open orders</p>
                                    <p className="text-sm text-silver-500 mt-2">Place an order using the form above</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Quick Stats & History */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Quick Stats */}
                        <Card className="card-elegant">
                            <CardHeader>
                                <CardTitle className="text-silver-100">Today's Activity</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between py-2 border-b border-silver-600/10">
                                    <span className="text-silver-400">Orders Placed</span>
                                    <span className="font-bold text-silver-200">0</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-silver-600/10">
                                    <span className="text-silver-400">Orders Filled</span>
                                    <span className="font-bold text-emerald-400">0</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-silver-600/10">
                                    <span className="text-silver-400">Volume</span>
                                    <span className="font-bold gradient-text">$0.00</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-silver-400">Realized PnL</span>
                                    <span className="font-bold text-silver-200">$0.00</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Orders */}
                        <Card className="card-elegant">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-silver-100">Recent Orders</CardTitle>
                                    <Link href="/trading/orders" className="text-sm text-silver-400 hover:text-silver-200 transition">
                                        View All →
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8">
                                    <div className="text-3xl mb-3">📜</div>
                                    <p className="text-silver-400 text-sm">No recent orders</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
