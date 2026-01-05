'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';

interface ProxyData {
    id: string;
    walletAddress: string;
    proxyAddress: string;
    tier: 'STARTER' | 'PRO' | 'WHALE';
    totalDeposited: number;
    totalWithdrawn: number;
    totalVolume: number;
    totalProfit: number;
    totalFeesPaid: number;
    isActive: boolean;
    feePercent: number;
    netProfit: number;
    feeTransactions: Array<{
        id: string;
        profitAmount: number;
        feeAmount: number;
        feePercent: number;
        txHash: string | null;
        createdAt: string;
    }>;
}

const TIER_INFO = {
    STARTER: { name: 'Starter', fee: '10%', color: 'text-gray-400', bgColor: 'bg-gray-800' },
    PRO: { name: 'Pro', fee: '5%', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
    WHALE: { name: 'Whale', fee: '2%', color: 'text-purple-400', bgColor: 'bg-purple-900/30' },
};

export default function ProxyDashboardPage() {
    const { user, authenticated, ready } = usePrivy();
    const [proxyData, setProxyData] = useState<ProxyData | null>(null);
    const [hasProxy, setHasProxy] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const walletAddress = user?.wallet?.address;

    const fetchProxyStatus = useCallback(async () => {
        if (!walletAddress) return;

        try {
            setLoading(true);
            const res = await fetch(`/api/proxy/status?wallet=${walletAddress}`);
            const data = await res.json();

            if (res.ok) {
                setHasProxy(data.hasProxy);
                setProxyData(data.proxy);
            } else {
                setError(data.error || 'Failed to fetch proxy status');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        if (ready && authenticated && walletAddress) {
            fetchProxyStatus();
        } else if (ready && !authenticated) {
            setLoading(false);
        }
    }, [ready, authenticated, walletAddress, fetchProxyStatus]);

    const handleCreateProxy = async () => {
        if (!walletAddress) return;

        setCreating(true);
        setError(null);

        try {
            // In production, this would call the smart contract to create a proxy
            // For now, we'll simulate with a mock address
            const mockProxyAddress = `0x${Math.random().toString(16).slice(2, 42)}`;

            const res = await fetch('/api/proxy/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress,
                    proxyAddress: mockProxyAddress,
                    tier: 'STARTER',
                }),
            });

            const data = await res.json();

            if (res.ok) {
                await fetchProxyStatus();
            } else {
                setError(data.error || 'Failed to create proxy');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setCreating(false);
        }
    };

    if (!ready) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Connect Wallet</h2>
                    <p className="text-gray-400">Please connect your wallet to access the proxy dashboard.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Trading Proxy</h1>
                    <p className="text-gray-400">
                        Your non-custodial trading wallet with automatic fee collection on profits.
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
                    </div>
                ) : error ? (
                    <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6">
                        <p className="text-red-400">{error}</p>
                        <button
                            onClick={() => { setError(null); fetchProxyStatus(); }}
                            className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : !hasProxy ? (
                    /* No Proxy - Create Flow */
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                        <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-3">Create Your Trading Proxy</h2>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                            A trading proxy is a smart contract wallet that automatically handles fee collection
                            when you make profitable trades on Polymarket.
                        </p>

                        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 max-w-md mx-auto text-left">
                            <h3 className="text-sm font-semibold text-white mb-2">How it works:</h3>
                            <ul className="text-sm text-gray-400 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400">1.</span> Deposit USDC into your proxy wallet
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400">2.</span> Trade on Polymarket through your proxy
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400">3.</span> On withdrawal, fee is deducted from profits only
                                </li>
                            </ul>
                        </div>

                        <div className="flex items-center justify-center gap-4 mb-6">
                            {Object.entries(TIER_INFO).map(([tier, info]) => (
                                <div key={tier} className={`px-4 py-2 rounded-lg ${info.bgColor}`}>
                                    <span className={`text-sm font-medium ${info.color}`}>{info.name}: {info.fee}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleCreateProxy}
                            disabled={creating}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                        >
                            {creating ? (
                                <span className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                                    Creating...
                                </span>
                            ) : (
                                'Create Trading Proxy'
                            )}
                        </button>
                    </div>
                ) : (
                    /* Has Proxy - Dashboard */
                    <div className="space-y-6">
                        {/* Proxy Info Card */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Your Trading Proxy</h2>
                                    <p className="text-gray-400 text-sm font-mono truncate max-w-xs">
                                        {proxyData?.proxyAddress}
                                    </p>
                                </div>
                                <div className={`px-4 py-2 rounded-lg ${TIER_INFO[proxyData?.tier || 'STARTER'].bgColor}`}>
                                    <span className={`font-semibold ${TIER_INFO[proxyData?.tier || 'STARTER'].color}`}>
                                        {TIER_INFO[proxyData?.tier || 'STARTER'].name} ({TIER_INFO[proxyData?.tier || 'STARTER'].fee} fee)
                                    </span>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">Total Deposited</p>
                                    <p className="text-xl font-bold text-white">
                                        ${proxyData?.totalDeposited.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">Total Profit</p>
                                    <p className={`text-xl font-bold ${(proxyData?.totalProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ${proxyData?.totalProfit.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">Fees Paid</p>
                                    <p className="text-xl font-bold text-yellow-400">
                                        ${proxyData?.totalFeesPaid.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">Net Profit</p>
                                    <p className={`text-xl font-bold ${(proxyData?.netProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ${proxyData?.netProfit.toLocaleString() || '0'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-6 py-4 flex items-center justify-center gap-2 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Deposit USDC
                            </button>
                            <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg px-6 py-4 flex items-center justify-center gap-2 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                                Withdraw
                            </button>
                        </div>

                        {/* Fee History */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Fee History</h3>
                            {proxyData?.feeTransactions && proxyData.feeTransactions.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-400 border-b border-gray-800">
                                                <th className="text-left py-2">Date</th>
                                                <th className="text-right py-2">Profit</th>
                                                <th className="text-right py-2">Fee</th>
                                                <th className="text-right py-2">Rate</th>
                                                <th className="text-right py-2">Tx</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {proxyData.feeTransactions.map((tx) => (
                                                <tr key={tx.id} className="border-b border-gray-800/50">
                                                    <td className="py-3 text-gray-300">
                                                        {new Date(tx.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3 text-right text-green-400">
                                                        +${tx.profitAmount.toLocaleString()}
                                                    </td>
                                                    <td className="py-3 text-right text-yellow-400">
                                                        -${tx.feeAmount.toLocaleString()}
                                                    </td>
                                                    <td className="py-3 text-right text-gray-400">
                                                        {tx.feePercent}%
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        {tx.txHash ? (
                                                            <a
                                                                href={`https://polygonscan.com/tx/${tx.txHash}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-400 hover:text-blue-300"
                                                            >
                                                                View
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-500">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No fee transactions yet.</p>
                            )}
                        </div>

                        {/* Upgrade CTA */}
                        {proxyData?.tier !== 'WHALE' && (
                            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-6 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Upgrade Your Tier</h3>
                                    <p className="text-gray-400 text-sm">
                                        Reduce your fee to {proxyData?.tier === 'STARTER' ? '5% (Pro)' : '2% (Whale)'}
                                    </p>
                                </div>
                                <Link
                                    href="/pricing"
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                                >
                                    View Plans
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
