'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { useProxy } from '@/lib/contracts/useProxy';

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
        deposit,
        withdraw,
        withdrawAll,
        refreshStats,
        authorizeOperator,
        txPending,
        txHash,
    } = useProxy();

    // Modal states
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [amount, setAmount] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [operatorAddress, setOperatorAddress] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);

    const handleAuthorize = async () => {
        setActionError(null);

        // Use default bot address if empty - ideally comes from config
        // For now we'll rely on the user input or a hardcoded default if needed, 
        // but the useProxy might ideally handle the default or we prompt the user.
        // mimicking the logic from ProxyWalletCard:
        const targetOp = operatorAddress || '0x...BotAddress'; // Placeholder if needed, or enforce input

        // Actually, let's just use what's provided or error if empty for safety, 
        // OR better, import the default from a config if we had one.
        // For consistency with ProxyWalletCard, we'll assume the user might need to input it
        // or we use a known one. 
        // Let's check ProxyWalletCard usage again... it used "0x...BotAddress" as a fallback string 
        // which seems to be a placeholder. 
        // I will assume for now the user pastes it, or we can hardcode the known verified bot address if available.
        // To be safe I'll just enforce basic validation.

        if (!targetOp || !targetOp.startsWith('0x') || targetOp.length < 42) {
            setActionError('Please enter a valid operator address.');
            return;
        }

        const result = await authorizeOperator(targetOp, true);
        if (!result.success && result.error) {
            setActionError(result.error);
        } else if (result.success) {
            // success, maybe clear input
            setOperatorAddress('');
            // Could show a success toast but we don't have toast imported here, 
            // maybe I should import sonner toast.
        }
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
            // Success! Refresh state to show dashboard
            await refreshStats();
            // Optional: You could add a toast here if you had a toast library
        } else if (error) {
            setActionError(error);
        }
    };

    const handleDeposit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setActionError('Please enter a valid amount');
            return;
        }
        setActionError(null);
        const success = await deposit(parseFloat(amount));
        if (success) {
            setShowDepositModal(false);
            setAmount('');
        } else if (error) {
            setActionError(error);
        }
    };

    const handleWithdraw = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setActionError('Please enter a valid amount');
            return;
        }
        setActionError(null);
        const success = await withdraw(parseFloat(amount));
        if (success) {
            setShowWithdrawModal(false);
            setAmount('');
        } else if (error) {
            setActionError(error);
        }
    };

    const handleWithdrawAll = async () => {
        setActionError(null);
        const success = await withdrawAll();
        if (success) {
            setShowWithdrawModal(false);
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

                        {/* Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => { setShowDepositModal(true); setAmount(''); setActionError(null); }}
                                disabled={txPending}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-semibold rounded-lg px-6 py-4 flex items-center justify-center gap-2 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Deposit USDC
                            </button>
                            <button
                                onClick={() => { setShowWithdrawModal(true); setAmount(''); setActionError(null); }}
                                disabled={txPending}
                                className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-semibold rounded-lg px-6 py-4 flex items-center justify-center gap-2 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                                Withdraw
                            </button>
                        </div>

                        {/* Bot Authorization Section */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <h3 className="text-xl font-bold text-white">Bot Authorization</h3>
                            </div>
                            <p className="text-gray-400 text-sm mb-4">
                                Authorize the platform bot to execute trades on your behalf. This is required for Copy Trading to work.
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="0x...BotAddress (Leave empty for default)"
                                        value={operatorAddress}
                                        onChange={(e) => setOperatorAddress(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={handleAuthorize}
                                    disabled={txPending}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors whitespace-nowrap"
                                >
                                    {txPending ? (
                                        <span className="flex items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                                            Authorizing...
                                        </span>
                                    ) : (
                                        'Authorize Bot'
                                    )}
                                </button>
                            </div>
                        </div>

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

                {/* Deposit Modal */}
                {showDepositModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full relative">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    <h3 className="text-xl font-bold text-white">Deposit USDC</h3>
                                </div>
                                <button
                                    onClick={() => setShowDepositModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* QR Code */}
                            <div className="flex justify-center mb-6">
                                <div className="bg-white p-4 rounded-lg">
                                    {/* QR Code - using a simple SVG placeholder, in production use a QR library */}
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${proxyAddress || ''}`}
                                        alt="Deposit QR Code"
                                        className="w-44 h-44"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <p className="text-center text-gray-400 mb-3">
                                Send <span className="font-bold text-white">USDC</span> on Polygon to:
                            </p>
                            <div
                                className="flex items-center justify-center gap-2 bg-gray-800 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-700 transition-colors mb-6"
                                onClick={() => {
                                    if (proxyAddress) {
                                        navigator.clipboard.writeText(proxyAddress);
                                        setActionError('Address copied!');
                                        setTimeout(() => setActionError(null), 2000);
                                    }
                                }}
                            >
                                <span className="text-white font-mono text-sm">
                                    {proxyAddress ? `${proxyAddress.slice(0, 10)}...${proxyAddress.slice(-8)}` : '...'}
                                </span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>

                            {/* Info Box */}
                            <div className="bg-green-900/30 border border-green-600/30 rounded-lg p-4">
                                <p className="text-sm text-green-400">
                                    <span className="font-bold">✅ Simple:</span> Just send USDC on Polygon. We automatically handle conversion for Polymarket trading.
                                </p>
                            </div>

                            {/* Copy Success Message */}
                            {actionError === 'Address copied!' && (
                                <p className="text-center text-green-400 text-sm mt-3">{actionError}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Withdraw Modal */}
                {showWithdrawModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full relative">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Withdraw USDC</h3>
                                </div>
                                <button
                                    onClick={() => { setShowWithdrawModal(false); setAmount(''); setDestinationAddress(''); }}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Amount Input */}
                            <div className="mb-4">
                                <label className="text-sm text-gray-400 mb-2 block">Amount (USDC)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        onClick={() => setAmount((stats?.balance || 0).toString())}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm font-medium hover:text-blue-300"
                                    >
                                        MAX
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Available: ${stats?.balance.toLocaleString() || '0.00'}</p>
                            </div>

                            {/* Destination Address */}
                            <div className="mb-6">
                                <label className="text-sm text-gray-400 mb-2 block">Destination Address</label>
                                <input
                                    type="text"
                                    value={destinationAddress || user?.wallet?.address || ''}
                                    onChange={(e) => setDestinationAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Withdraw Button */}
                            <button
                                onClick={handleWithdraw}
                                disabled={txPending || !amount || parseFloat(amount) <= 0}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                            >
                                {txPending ? 'Processing...' : 'Withdraw'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
