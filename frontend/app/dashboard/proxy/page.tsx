'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { useProxy } from '@/lib/contracts/useProxy';
import { ProxyActionCenter } from '@/components/proxy/proxy-action-center';

const TIER_INFO = {
    STARTER: { name: 'Starter', fee: '10%', color: 'text-gray-400', bgColor: 'bg-gray-800' },
    PRO: { name: 'Pro', fee: '5%', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
    WHALE: { name: 'Whale', fee: '2%', color: 'text-purple-400', bgColor: 'bg-purple-900/30' },
};

export default function ProxyDashboardPage() {
    const { authenticated, ready, user } = usePrivy();
    const {
        proxyAddress,
        hasProxy,
        stats,
        usdcBalance,
        isLoading,
        error,
        createProxy,
        refreshStats,
        txPending,
        txHash,
    } = useProxy();

    const [actionError, setActionError] = useState<string | null>(null);

    // Determine tier from fee percent
    const getTierFromFee = (feePercent: number): 'STARTER' | 'PRO' | 'WHALE' => {
        if (feePercent <= 2) return 'WHALE';
        if (feePercent <= 5) return 'PRO';
        return 'STARTER';
    };

    const currentTier = stats ? getTierFromFee(stats.feePercent) : 'STARTER';

    const handleCreateProxy = async () => {
        setActionError(null);
        const result = await createProxy('STARTER');
        if (result) {
            await refreshStats();
        } else if (error) {
            setActionError(error);
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

                {/* Transaction Pending Banner */}
                {txPending && (
                    <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-6 flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500" />
                        <div>
                            <p className="text-blue-400 font-medium">
                                {txHash ? 'Transaction Pending...' : 'Please confirm in your wallet...'}
                            </p>
                            {!txHash && (
                                <p className="text-blue-300/70 text-sm">
                                    Check your MetaMask popup to sign the transaction.
                                </p>
                            )}
                            {txHash && (
                                <a
                                    href={`https://polygonscan.com/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-300 text-sm hover:underline"
                                >
                                    View on PolygonScan (or Localhost logs)
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {(actionError || error) && (
                    <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6">
                        <p className="text-red-400">{actionError || error}</p>
                        <button
                            onClick={() => setActionError(null)}
                            className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
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
                            disabled={txPending}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                        >
                            {txPending ? (
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
                                        {proxyAddress}
                                    </p>
                                </div>
                                <div className={`px-4 py-2 rounded-lg ${TIER_INFO[currentTier].bgColor}`}>
                                    <span className={`font-semibold ${TIER_INFO[currentTier].color}`}>
                                        {TIER_INFO[currentTier].name} ({TIER_INFO[currentTier].fee} fee)
                                    </span>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">Proxy Balance</p>
                                    <p className="text-xl font-bold text-white">
                                        ${stats?.balance.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">Total Profit</p>
                                    <p className={`text-xl font-bold ${(stats?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ${stats?.profit.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">Fees Paid</p>
                                    <p className="text-xl font-bold text-yellow-400">
                                        ${stats?.feesPaid.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">Wallet USDC</p>
                                    <p className="text-xl font-bold text-white">
                                        ${usdcBalance.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Unified Action Center (Replaces Buttons & Modals) */}
                        <ProxyActionCenter />

                        {/* Upgrade CTA */}
                        {currentTier !== 'WHALE' && (
                            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-6 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Upgrade Your Tier</h3>
                                    <p className="text-gray-400 text-sm">
                                        Reduce your fee to {currentTier === 'STARTER' ? '5% (Pro)' : '2% (Whale)'}
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
