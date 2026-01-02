'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Alert {
    id: string;
    type: 'price' | 'volume' | 'smart_money' | 'arbitrage';
    market: string;
    condition: string;
    value: number;
    active: boolean;
}

export function AlertsManager() {
    const [alerts, setAlerts] = useState<Alert[]>([
        {
            id: '1',
            type: 'price',
            market: 'Bitcoin $100k',
            condition: 'above',
            value: 0.6,
            active: true,
        },
        {
            id: '2',
            type: 'smart_money',
            market: 'Any market',
            condition: 'trade_detected',
            value: 1000,
            active: true,
        },
    ]);

    const [showCreate, setShowCreate] = useState(false);

    const toggleAlert = (id: string) => {
        setAlerts(prev => prev.map(a =>
            a.id === id ? { ...a, active: !a.active } : a
        ));
    };

    const deleteAlert = (id: string) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    const getTypeIcon = (type: Alert['type']) => {
        switch (type) {
            case 'price': return '📊';
            case 'volume': return '📈';
            case 'smart_money': return '💎';
            case 'arbitrage': return '💰';
        }
    };

    const getTypeLabel = (type: Alert['type']) => {
        switch (type) {
            case 'price': return 'Price Alert';
            case 'volume': return 'Volume Alert';
            case 'smart_money': return 'Smart Money';
            case 'arbitrage': return 'Arbitrage';
        }
    };

    return (
        <Card className="card-elegant">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-silver-100">Price Alerts</CardTitle>
                    <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
                        + Create Alert
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Create Alert Form */}
                {showCreate && (
                    <div className="mb-6 p-4 bg-dark-900/50 rounded-lg border border-silver-600/20">
                        <h4 className="font-medium text-silver-200 mb-4">New Alert</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm text-silver-400 mb-2">Type</label>
                                <select className="w-full px-3 py-2 bg-dark-800 border border-silver-600/30 rounded-lg text-silver-200 focus:outline-none focus:border-emerald-500/50">
                                    <option value="price">Price Alert</option>
                                    <option value="volume">Volume Alert</option>
                                    <option value="smart_money">Smart Money</option>
                                    <option value="arbitrage">Arbitrage</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-silver-400 mb-2">Condition</label>
                                <select className="w-full px-3 py-2 bg-dark-800 border border-silver-600/30 rounded-lg text-silver-200 focus:outline-none focus:border-emerald-500/50">
                                    <option value="above">Price Above</option>
                                    <option value="below">Price Below</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="primary" size="sm">Save Alert</Button>
                            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                        </div>
                    </div>
                )}

                {/* Alerts List */}
                {alerts.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">🔔</div>
                        <p className="text-silver-400">No alerts set</p>
                        <p className="text-sm text-silver-500 mt-1">Create an alert to get notified</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((alert) => (
                            <div
                                key={alert.id}
                                className={`p-4 rounded-lg border transition ${alert.active
                                        ? 'bg-dark-900/50 border-silver-600/20'
                                        : 'bg-dark-900/30 border-silver-600/10 opacity-60'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{getTypeIcon(alert.type)}</span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={alert.active ? 'success' : 'default'}>
                                                    {getTypeLabel(alert.type)}
                                                </Badge>
                                                <span className="text-silver-200">{alert.market}</span>
                                            </div>
                                            <p className="text-sm text-silver-500 mt-0.5">
                                                {alert.condition === 'above' ? 'Above' : 'Below'} {(alert.value * 100).toFixed(0)}¢
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => toggleAlert(alert.id)}
                                            className={`w-10 h-5 rounded-full transition ${alert.active ? 'bg-emerald-500' : 'bg-dark-600'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${alert.active ? 'translate-x-5' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                        <button
                                            onClick={() => deleteAlert(alert.id)}
                                            className="p-1 text-silver-500 hover:text-crimson-400 transition"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
