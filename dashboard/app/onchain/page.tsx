'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface Balance {
    token: string;
    symbol: string;
    balance: number;
    usdValue: number;
    icon: string;
}

const mockBalances: Balance[] = [
    { token: 'USDC', symbol: 'USDC', balance: 5432.50, usdValue: 5432.50, icon: '💵' },
    { token: 'USDC.e', symbol: 'USDC.e', balance: 1250.00, usdValue: 1250.00, icon: '💶' },
    { token: 'MATIC', symbol: 'MATIC', balance: 125.5, usdValue: 87.85, icon: '🔷' },
    { token: 'WETH', symbol: 'WETH', balance: 0.5, usdValue: 1650.00, icon: '⟠' },
];

export default function OnchainPage() {
    const totalValue = mockBalances.reduce((sum, b) => sum + b.usdValue, 0);

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto spacious">
                {/* Page Header */}
                <div className="flex items-center justify-between animate-fade-in mb-8">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">On-Chain Tools</h1>
                        <p className="text-silver-400">Manage your balances and execute CTF operations</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-silver-500">Total Value</p>
                        <p className="text-3xl font-bold gradient-text">{formatCurrency(totalValue)}</p>
                    </div>
                </div>

                {/* Balance Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {mockBalances.map((balance) => (
                        <Card key={balance.token} className="card-elegant hover:shadow-glow-silver transition-all">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-3xl">{balance.icon}</span>
                                    <Badge variant="info">{balance.symbol}</Badge>
                                </div>
                                <p className="text-2xl font-bold text-silver-100 mb-1">
                                    {balance.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                </p>
                                <p className="text-sm text-silver-400">
                                    ≈ {formatCurrency(balance.usdValue)}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* CTF Operations */}
                    <Card className="card-elegant">
                        <CardHeader>
                            <CardTitle className="text-silver-100">CTF Operations</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <OperationCard
                                title="Split"
                                description="Split collateral into YES and NO shares"
                                icon="✂️"
                                action="Split Tokens"
                            />
                            <OperationCard
                                title="Merge"
                                description="Merge YES and NO shares back to collateral"
                                icon="🔗"
                                action="Merge Tokens"
                            />
                            <OperationCard
                                title="Redeem"
                                description="Redeem winning shares for USDC"
                                icon="💰"
                                action="Redeem Shares"
                            />
                        </CardContent>
                    </Card>

                    {/* DEX Swap */}
                    <Card className="card-elegant">
                        <CardHeader>
                            <CardTitle className="text-silver-100">Token Swap</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* From */}
                                <div>
                                    <label className="block text-sm text-silver-400 mb-2">From</label>
                                    <div className="flex gap-3">
                                        <select className="flex-1 px-4 py-3 bg-dark-900 border border-silver-600/30 rounded-lg text-silver-200 focus:outline-none focus:border-emerald-500/50">
                                            <option>USDC</option>
                                            <option>USDC.e</option>
                                            <option>MATIC</option>
                                        </select>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="w-32 px-4 py-3 bg-dark-900 border border-silver-600/30 rounded-lg text-silver-200 text-right focus:outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                </div>

                                {/* Arrow */}
                                <div className="text-center">
                                    <span className="text-2xl text-silver-500">↓</span>
                                </div>

                                {/* To */}
                                <div>
                                    <label className="block text-sm text-silver-400 mb-2">To</label>
                                    <div className="flex gap-3">
                                        <select className="flex-1 px-4 py-3 bg-dark-900 border border-silver-600/30 rounded-lg text-silver-200 focus:outline-none focus:border-emerald-500/50">
                                            <option>USDC.e</option>
                                            <option>USDC</option>
                                            <option>MATIC</option>
                                        </select>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            disabled
                                            className="w-32 px-4 py-3 bg-dark-900/50 border border-silver-600/20 rounded-lg text-silver-400 text-right"
                                        />
                                    </div>
                                </div>

                                {/* Rate */}
                                <div className="p-3 bg-dark-900/50 rounded-lg border border-silver-600/20">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-silver-400">Rate</span>
                                        <span className="text-silver-200">1 USDC = 1 USDC.e</span>
                                    </div>
                                    <div className="flex justify-between text-sm mt-1">
                                        <span className="text-silver-400">Est. Gas</span>
                                        <span className="text-silver-200">~0.001 MATIC</span>
                                    </div>
                                </div>

                                <Button variant="primary" size="lg" className="w-full">
                                    Swap Tokens
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Approvals */}
                    <Card className="card-elegant lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-silver-100">Token Approvals</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <ApprovalCard token="USDC" spender="Polymarket Exchange" approved />
                                <ApprovalCard token="USDC.e" spender="CTF Exchange" approved />
                                <ApprovalCard token="Conditional Tokens" spender="Neg Risk Adapter" approved={false} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function OperationCard({
    title,
    description,
    icon,
    action
}: {
    title: string;
    description: string;
    icon: string;
    action: string;
}) {
    return (
        <div className="p-4 bg-dark-900/50 rounded-lg border border-silver-600/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <span className="text-3xl">{icon}</span>
                <div>
                    <p className="font-medium text-silver-200">{title}</p>
                    <p className="text-sm text-silver-500">{description}</p>
                </div>
            </div>
            <Button variant="secondary" size="sm">
                {action}
            </Button>
        </div>
    );
}

function ApprovalCard({ token, spender, approved }: { token: string; spender: string; approved: boolean }) {
    return (
        <div className="p-4 bg-dark-900/50 rounded-lg border border-silver-600/20">
            <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-silver-200">{token}</span>
                <Badge variant={approved ? 'success' : 'warning'}>
                    {approved ? 'Approved' : 'Not Approved'}
                </Badge>
            </div>
            <p className="text-sm text-silver-500 mb-3">{spender}</p>
            <Button
                variant={approved ? 'ghost' : 'primary'}
                size="sm"
                className="w-full"
            >
                {approved ? 'Revoke' : 'Approve'}
            </Button>
        </div>
    );
}
