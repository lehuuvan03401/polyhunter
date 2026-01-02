import { Card, CardContent } from '@/components/ui/card';

export default function MarketDetailPage() {
    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="animate-fade-in mb-8">
                    <h1 className="text-4xl font-bold gradient-text mb-2">Market Details</h1>
                    <p className="text-silver-400">Advanced market analysis and trading</p>
                </div>

                {/* Coming Soon */}
                <Card className="card-elegant">
                    <CardContent className="pt-6">
                        <div className="text-center py-16">
                            <div className="text-6xl mb-6">📈</div>
                            <h2 className="text-3xl font-bold gradient-text mb-4">Market Analysis</h2>
                            <p className="text-silver-400 mb-3 text-lg">Coming Soon</p>
                            <p className="text-sm text-silver-500 max-w-2xl mx-auto leading-relaxed">
                                Advanced charting, orderbook visualization, and trading interface.
                                Track price movements and execute trades directly.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
