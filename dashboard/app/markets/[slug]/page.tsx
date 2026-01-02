'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Orderbook, generateMockOrderbook } from '@/components/trading/orderbook';
import { OrderForm } from '@/components/trading/order-form';
import { formatCurrency } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock price history
const mockPriceHistory = Array.from({ length: 50 }, (_, i) => {
    const basePrice = 55;
    const noise = Math.sin(i * 0.3) * 10 + (Math.random() - 0.5) * 5;
    return {
        time: new Date(Date.now() - (50 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        yes: Math.max(10, Math.min(90, basePrice + noise)),
        no: Math.max(10, Math.min(90, 100 - basePrice - noise)),
    };
});

export default function MarketDetailPage() {
    const orderbook = generateMockOrderbook();
    const currentYesPrice = mockPriceHistory[mockPriceHistory.length - 1].yes;
    const currentNoPrice = mockPriceHistory[mockPriceHistory.length - 1].no;
    const priceChange = currentYesPrice - mockPriceHistory[0].yes;

    const handleOrderSubmit = (order: {
        side: 'YES' | 'NO';
        type: 'LIMIT' | 'MARKET';
        price: number;
        amount: number;
    }) => {
        console.log('Order submitted:', order);
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Market Header */}
                <div className="animate-fade-in mb-8">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Badge variant="info">Politics</Badge>
                                <Badge variant="success">Active</Badge>
                            </div>
                            <h1 className="text-3xl font-bold text-silver-100 mb-2">
                                Will Bitcoin reach $100k in 2025?
                            </h1>
                            <p className="text-silver-400">
                                Resolution: December 31, 2025 • Volume: $1.2M • Liquidity: $450K
                            </p>
                        </div>
                        <a
                            href="/markets"
                            className="text-silver-400 hover:text-silver-200 transition"
                        >
                            ← Back to Markets
                        </a>
                    </div>

                    {/* Price Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="card-elegant">
                            <CardContent className="pt-4 pb-4 text-center">
                                <p className="text-xs text-silver-500 mb-1">YES Price</p>
                                <p className="text-3xl font-bold text-emerald-400">{currentYesPrice.toFixed(1)}¢</p>
                            </CardContent>
                        </Card>
                        <Card className="card-elegant">
                            <CardContent className="pt-4 pb-4 text-center">
                                <p className="text-xs text-silver-500 mb-1">NO Price</p>
                                <p className="text-3xl font-bold text-crimson-400">{currentNoPrice.toFixed(1)}¢</p>
                            </CardContent>
                        </Card>
                        <Card className="card-elegant">
                            <CardContent className="pt-4 pb-4 text-center">
                                <p className="text-xs text-silver-500 mb-1">24h Change</p>
                                <p className={`text-3xl font-bold ${priceChange >= 0 ? 'text-emerald-400' : 'text-crimson-400'}`}>
                                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}¢
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="card-elegant">
                            <CardContent className="pt-4 pb-4 text-center">
                                <p className="text-xs text-silver-500 mb-1">24h Volume</p>
                                <p className="text-3xl font-bold gradient-text">$125K</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chart + Orderbook */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Price Chart */}
                        <Card className="card-elegant">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-silver-100">Price History</CardTitle>
                                    <div className="flex gap-2">
                                        {['1H', '1D', '1W', '1M'].map((period) => (
                                            <Badge
                                                key={period}
                                                variant={period === '1D' ? 'success' : 'default'}
                                                className="cursor-pointer"
                                            >
                                                {period}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={mockPriceHistory}>
                                        <defs>
                                            <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="noGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
                                        <XAxis dataKey="time" stroke="#737373" style={{ fontSize: '10px' }} />
                                        <YAxis stroke="#737373" style={{ fontSize: '10px' }} domain={[0, 100]} tickFormatter={(v: number) => `${v}¢`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' }}
                                            formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(1)}¢`] : ['']}
                                        />
                                        <Area type="monotone" dataKey="yes" name="YES" stroke="#10B981" strokeWidth={2} fill="url(#yesGradient)" />
                                        <Area type="monotone" dataKey="no" name="NO" stroke="#EF4444" strokeWidth={2} fill="url(#noGradient)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Orderbook */}
                        <Orderbook {...orderbook} />
                    </div>

                    {/* Order Form */}
                    <div>
                        <OrderForm onSubmit={handleOrderSubmit} />

                        {/* Market Info */}
                        <Card className="card-elegant mt-6">
                            <CardHeader>
                                <CardTitle className="text-silver-100">Market Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <InfoRow label="Resolution Date" value="Dec 31, 2025" />
                                <InfoRow label="Total Volume" value="$1.2M" />
                                <InfoRow label="Liquidity" value="$450K" />
                                <InfoRow label="Open Interest" value="$320K" />
                                <InfoRow label="Unique Traders" value="1,245" />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-silver-600/10 last:border-0">
            <span className="text-silver-400">{label}</span>
            <span className="font-medium text-silver-200">{value}</span>
        </div>
    );
}
