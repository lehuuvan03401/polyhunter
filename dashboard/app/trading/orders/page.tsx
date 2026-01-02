'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

type OrderStatus = 'open' | 'filled' | 'cancelled' | 'expired';
type TabType = 'open' | 'history';

interface Order {
    id: string;
    market: string;
    side: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    type: 'LIMIT' | 'MARKET';
    price: number;
    amount: number;
    filled: number;
    status: OrderStatus;
    createdAt: Date;
}

// Mock orders
const mockOrders: Order[] = [
    { id: '1', market: 'Bitcoin $100k', side: 'BUY', outcome: 'YES', type: 'LIMIT', price: 0.55, amount: 100, filled: 0, status: 'open', createdAt: new Date(Date.now() - 3600000) },
    { id: '2', market: 'US Election', side: 'SELL', outcome: 'NO', type: 'LIMIT', price: 0.42, amount: 250, filled: 150, status: 'open', createdAt: new Date(Date.now() - 7200000) },
    { id: '3', market: 'ETH Flip', side: 'BUY', outcome: 'YES', type: 'MARKET', price: 0.35, amount: 500, filled: 500, status: 'filled', createdAt: new Date(Date.now() - 86400000) },
    { id: '4', market: 'Fed Rate', side: 'SELL', outcome: 'YES', type: 'LIMIT', price: 0.68, amount: 300, filled: 0, status: 'cancelled', createdAt: new Date(Date.now() - 172800000) },
];

export default function OrdersPage() {
    const [tab, setTab] = useState<TabType>('open');

    const openOrders = mockOrders.filter(o => o.status === 'open');
    const historyOrders = mockOrders.filter(o => o.status !== 'open');
    const displayOrders = tab === 'open' ? openOrders : historyOrders;

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Order Management</h1>
                        <p className="text-silver-400">Manage your open orders and view order history</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="/trading" className="text-silver-400 hover:text-silver-200 transition">
                            ← Back to Trading
                        </a>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard title="Open Orders" value={openOrders.length.toString()} />
                    <StatCard title="Open Volume" value={formatCurrency(openOrders.reduce((s, o) => s + o.amount, 0))} />
                    <StatCard title="Filled Today" value="5" />
                    <StatCard title="Fill Rate" value="85%" />
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6">
                    <Badge
                        variant={tab === 'open' ? 'success' : 'default'}
                        className="cursor-pointer px-4 py-2"
                        onClick={() => setTab('open')}
                    >
                        Open Orders ({openOrders.length})
                    </Badge>
                    <Badge
                        variant={tab === 'history' ? 'success' : 'default'}
                        className="cursor-pointer px-4 py-2"
                        onClick={() => setTab('history')}
                    >
                        History ({historyOrders.length})
                    </Badge>
                </div>

                {/* Orders Table */}
                <Card className="card-elegant">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-silver-100">
                                {tab === 'open' ? 'Open Orders' : 'Order History'}
                            </CardTitle>
                            {tab === 'open' && openOrders.length > 0 && (
                                <Button variant="danger" size="sm">
                                    Cancel All
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {displayOrders.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-4">📋</div>
                                <p className="text-silver-400">
                                    {tab === 'open' ? 'No open orders' : 'No order history'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="grid grid-cols-7 text-xs text-silver-500 uppercase tracking-wide pb-3 border-b border-silver-600/20">
                                    <span>Market</span>
                                    <span className="text-center">Side</span>
                                    <span className="text-center">Type</span>
                                    <span className="text-right">Price</span>
                                    <span className="text-right">Size</span>
                                    <span className="text-right">Filled</span>
                                    <span className="text-right">Action</span>
                                </div>

                                {/* Rows */}
                                <div className="divide-y divide-silver-600/10">
                                    {displayOrders.map((order, index) => (
                                        <OrderRow key={order.id} order={order} index={index} />
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function OrderRow({ order, index }: { order: Order; index: number }) {
    const fillPercent = (order.filled / order.amount) * 100;

    return (
        <div
            className="grid grid-cols-7 py-4 items-center hover:bg-white/5 transition animate-fade-in"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            <div>
                <p className="text-silver-200 truncate">{order.market}</p>
                <p className="text-xs text-silver-500">
                    {order.createdAt.toLocaleTimeString()}
                </p>
            </div>

            <div className="text-center">
                <Badge variant={order.side === 'BUY' ? 'success' : 'danger'}>
                    {order.side}
                </Badge>
                <span className="block text-xs text-silver-500 mt-1">{order.outcome}</span>
            </div>

            <div className="text-center">
                <Badge variant="info">{order.type}</Badge>
            </div>

            <span className="text-right font-mono text-silver-200">
                {(order.price * 100).toFixed(1)}¢
            </span>

            <span className="text-right font-mono text-silver-200">
                {formatCurrency(order.amount)}
            </span>

            <div className="text-right">
                <span className="font-mono text-silver-200">{fillPercent.toFixed(0)}%</span>
                <div className="w-full h-1 bg-dark-700 rounded-full mt-1">
                    <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${fillPercent}%` }}
                    />
                </div>
            </div>

            <div className="text-right">
                {order.status === 'open' ? (
                    <Button variant="ghost" size="sm">Cancel</Button>
                ) : (
                    <Badge variant={order.status === 'filled' ? 'success' : 'default'}>
                        {order.status}
                    </Badge>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value }: { title: string; value: string }) {
    return (
        <Card className="card-elegant">
            <CardContent className="pt-4 pb-4">
                <p className="text-xs text-silver-400 uppercase tracking-wide mb-1">{title}</p>
                <p className="text-2xl font-bold gradient-text">{value}</p>
            </CardContent>
        </Card>
    );
}
