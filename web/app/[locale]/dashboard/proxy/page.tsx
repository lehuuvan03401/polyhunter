'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { useProxy } from '@/lib/contracts/useProxy';
import { ProxyActionCenter } from '@/components/proxy/proxy-action-center';
import { TransactionHistoryTable } from '@/components/proxy/transaction-history-table';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

// Helper to abbreviate address: 0x1234...5678
const formatAddress = (address: string) => address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

export default function ProxyDashboardPage() {
    const t = useTranslations('ProxyDashboard');
    const { authenticated, ready } = usePrivy();
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
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleActionSuccess = async () => {
        await refreshStats();
        setRefreshTrigger(prev => prev + 1);
    };

    const TIER_INFO = {
        STARTER: { name: t('tiers.STARTER'), fee: '10%', color: 'text-gray-400', bgColor: 'bg-gray-800' },
        PRO: { name: t('tiers.PRO'), fee: '5%', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
        WHALE: { name: t('tiers.WHALE'), fee: '2%', color: 'text-purple-400', bgColor: 'bg-purple-900/30' },
    };

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
                    <h2 className="text-2xl font-bold text-white mb-4">{t('connect.title')}</h2>
                    <p className="text-gray-400">{t('connect.desc')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">{t('title')}</h1>
                    <p className="text-gray-400">
                        {t('subtitle')}
                    </p>
                </div>

                {/* Transaction Pending Banner */}
                {txPending && (
                    <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-6 flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500" />
                        <div>
                            <p className="text-blue-400 font-medium">
                                {txHash ? t('status.pending') : t('status.confirm')}
                            </p>
                            {!txHash && (
                                <p className="text-blue-300/70 text-sm">
                                    {t('status.checkWallet')}
                                </p>
                            )}
                            {txHash && (
                                <a
                                    href={`https://polygonscan.com/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-300 text-sm hover:underline"
                                >
                                    {t('status.viewExplorer')}
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
                            {t('error.dismiss')}
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
                        <h2 className="text-xl font-bold text-white mb-3">{t('create.title')}</h2>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                            {t('create.desc')}
                        </p>

                        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 max-w-md mx-auto text-left">
                            <h3 className="text-sm font-semibold text-white mb-2">{t('create.howItWorks')}</h3>
                            <ul className="text-sm text-gray-400 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400">1.</span> {t('create.steps.1')}
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400">2.</span> {t('create.steps.2')}
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-400">3.</span> {t('create.steps.3')}
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
                                    {t('create.creating')}
                                </span>
                            ) : (
                                t('create.button')
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
                                    <h2 className="text-xl font-bold text-white">{t('dashboard.yourProxy')}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-gray-400 text-sm font-mono bg-gray-950/50 px-2 py-1 rounded select-all" title={proxyAddress || ''}>
                                            {proxyAddress ? formatAddress(proxyAddress) : ''}
                                        </p>
                                        <button
                                            onClick={() => {
                                                if (proxyAddress) {
                                                    navigator.clipboard.writeText(proxyAddress);
                                                    toast.success(t('dashboard.copy'));
                                                }
                                            }}
                                            className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
                                            title="Copy Address"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <a
                                            href={`https://${process.env.NEXT_PUBLIC_NETWORK === 'amoy' ? 'amoy.' : ''}polygonscan.com/address/${proxyAddress}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
                                            title={t('dashboard.viewExplorer')}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
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
                                    <p className="text-gray-400 text-sm mb-1">{t('stats.balance')}</p>
                                    <p className="text-xl font-bold text-white">
                                        ${stats?.balance.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">{t('stats.profit')}</p>
                                    <p className={`text-xl font-bold ${(stats?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ${stats?.profit.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">{t('stats.fees')}</p>
                                    <p className="text-xl font-bold text-yellow-400">
                                        ${stats?.feesPaid.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-gray-400 text-sm mb-1">{t('stats.wallet')}</p>
                                    <p className="text-xl font-bold text-white">
                                        ${usdcBalance.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <ProxyActionCenter onSuccess={handleActionSuccess} />

                        {/* Upgrade CTA */}
                        {currentTier !== 'WHALE' && (
                            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-6 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{t('upgrade.title')}</h3>
                                    <p className="text-gray-400 text-sm">
                                        {t('upgrade.desc', {
                                            fee: currentTier === 'STARTER' ? '5%' : '2%',
                                            tier: currentTier === 'STARTER' ? 'Pro' : 'Whale'
                                        })}
                                    </p>
                                </div>
                                <Link
                                    href="/pricing"
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                                >
                                    {t('upgrade.button')}
                                </Link>
                            </div>
                        )}


                        {/* Transaction History */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">{t('history.title')}</h3>
                            <TransactionHistoryTable refreshTrigger={refreshTrigger} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
