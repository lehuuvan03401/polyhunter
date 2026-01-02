'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface OrderFormProps {
    onSubmit?: (order: {
        side: 'YES' | 'NO';
        type: 'LIMIT' | 'MARKET';
        price: number;
        amount: number;
    }) => void;
}

export function OrderForm({ onSubmit }: OrderFormProps) {
    const [side, setSide] = useState<'YES' | 'NO'>('YES');
    const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
    const [price, setPrice] = useState(50);
    const [amount, setAmount] = useState(100);

    const estimatedCost = orderType === 'LIMIT'
        ? (amount * price / 100)
        : amount;

    const handleSubmit = () => {
        onSubmit?.({
            side,
            type: orderType,
            price: price / 100,
            amount,
        });
    };

    return (
        <Card className="card-elegant">
            <CardHeader>
                <CardTitle className="text-silver-100">Place Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Side Selection */}
                <div>
                    <label className="block text-sm text-silver-400 mb-3">Side</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setSide('YES')}
                            className={`py-4 rounded-lg font-bold transition-all ${side === 'YES'
                                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                                    : 'bg-dark-800 border border-silver-600/30 text-silver-400 hover:border-silver-500'
                                }`}
                        >
                            YES
                        </button>
                        <button
                            onClick={() => setSide('NO')}
                            className={`py-4 rounded-lg font-bold transition-all ${side === 'NO'
                                    ? 'bg-crimson-500/20 border-2 border-crimson-500 text-crimson-400'
                                    : 'bg-dark-800 border border-silver-600/30 text-silver-400 hover:border-silver-500'
                                }`}
                        >
                            NO
                        </button>
                    </div>
                </div>

                {/* Order Type */}
                <div>
                    <label className="block text-sm text-silver-400 mb-3">Order Type</label>
                    <div className="flex gap-3">
                        <Badge
                            variant={orderType === 'LIMIT' ? 'success' : 'default'}
                            className="cursor-pointer px-4 py-2"
                            onClick={() => setOrderType('LIMIT')}
                        >
                            Limit
                        </Badge>
                        <Badge
                            variant={orderType === 'MARKET' ? 'success' : 'default'}
                            className="cursor-pointer px-4 py-2"
                            onClick={() => setOrderType('MARKET')}
                        >
                            Market
                        </Badge>
                    </div>
                </div>

                {/* Price (for Limit orders) */}
                {orderType === 'LIMIT' && (
                    <div>
                        <label className="block text-sm text-silver-400 mb-2">
                            Price: {price}¢
                        </label>
                        <input
                            type="range"
                            value={price}
                            onChange={(e) => setPrice(parseInt(e.target.value))}
                            className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            min="1"
                            max="99"
                            step="1"
                        />
                        <div className="flex justify-between text-xs text-silver-500 mt-1">
                            <span>1¢</span>
                            <span>99¢</span>
                        </div>
                    </div>
                )}

                {/* Amount */}
                <div>
                    <label className="block text-sm text-silver-400 mb-2">Amount (USD)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-3 bg-dark-900 border border-silver-600/30 rounded-lg text-silver-100 focus:outline-none focus:border-emerald-500/50 transition"
                        min="1"
                        step="10"
                    />
                </div>

                {/* Estimated */}
                <div className="p-4 bg-dark-900/50 rounded-lg border border-silver-600/20">
                    <div className="flex justify-between mb-2">
                        <span className="text-silver-400">Estimated Cost</span>
                        <span className="font-semibold text-silver-200">${estimatedCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-silver-400">Potential Payout</span>
                        <span className="font-semibold text-emerald-400">${amount.toFixed(2)}</span>
                    </div>
                </div>

                {/* Submit */}
                <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleSubmit}
                >
                    {side === 'YES' ? '🟢' : '🔴'} Place {side} Order
                </Button>
            </CardContent>
        </Card>
    );
}
