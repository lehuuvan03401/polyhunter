'use client';

import { AnalyticsDashboard, generateMockAnalytics } from '@/components/analytics/analytics-dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AnalyticsPage() {
    const analytics = generateMockAnalytics();

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Analytics</h1>
                        <p className="text-silver-400">Track your trading performance and statistics</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select className="px-4 py-2 bg-dark-800 border border-silver-600/30 rounded-lg text-silver-200 focus:outline-none focus:border-emerald-500/50">
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="90d">Last 90 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                </div>

                {/* Analytics Dashboard */}
                <AnalyticsDashboard data={analytics} />

                {/* Recent Activity */}
                <Card className="card-elegant mt-6">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-silver-100">Recent Activity</CardTitle>
                            <Badge variant="info">Last 24h</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { action: 'Opened position', market: 'Bitcoin $100k', amount: '$250', time: '2h ago', type: 'buy' },
                                { action: 'Closed position', market: 'US Election', amount: '+$85', time: '5h ago', type: 'profit' },
                                { action: 'Placed order', market: 'ETH Flip', amount: '$100', time: '8h ago', type: 'pending' },
                            ].map((activity, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-dark-900/50 rounded-lg border border-silver-600/10">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">
                                            {activity.type === 'buy' ? '🟢' : activity.type === 'profit' ? '✅' : '⏳'}
                                        </span>
                                        <div>
                                            <p className="text-silver-200">{activity.action}</p>
                                            <p className="text-sm text-silver-500">{activity.market}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-medium ${activity.type === 'profit' ? 'text-emerald-400' : 'text-silver-200'
                                            }`}>
                                            {activity.amount}
                                        </p>
                                        <p className="text-xs text-silver-500">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
