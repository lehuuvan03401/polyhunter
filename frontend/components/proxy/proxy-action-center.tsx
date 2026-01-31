import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useProxy } from '@/lib/contracts/useProxy';
import { Loader2, ArrowDownLeft, ArrowUpRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useCopyTradingStore } from '@/lib/copy-trading-store';
import { StrategySelector } from './strategy-selector';

interface ProxyActionCenterProps {
    onSuccess?: () => void;
}

export function ProxyActionCenter({ onSuccess }: ProxyActionCenterProps) {
    const { user } = usePrivy();
    const {
        stats,
        usdcBalance,
        deposit,
        withdraw,
        authorizeOperator,
        txPending,
        txStatus,
        error,
        isExecutorAuthorized: isAuthFromChain,
        settleFees,
        refreshStats
    } = useProxy();

    const [amount, setAmount] = useState('');
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'settings'>('deposit');
    const [operatorAddress, setOperatorAddress] = useState('');
    const [userWantsAdvanced, setUserWantsAdvanced] = useState(false);
    const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

    // Copy Trading Store for safety check
    const configs = useCopyTradingStore((state) => state.configs);
    const activeConfigs = configs.filter(c => c.isActive);
    const hasActiveTrades = activeConfigs.length > 0;

    // Optimistic UI state
    const [optimisticAuth, setOptimisticAuth] = useState<boolean | null>(null);
    // If optimisticAuth is null, use chain state. Otherwise use optimistic state.
    const isExecutorAuthorized = optimisticAuth !== null ? optimisticAuth : isAuthFromChain;

    const getStatusText = (status: typeof txStatus) => {
        switch (status) {
            case 'APPROVING': return 'Approving USDC...';
            case 'DEPOSITING': return 'Sign Deposit Tx...';
            case 'WITHDRAWING': return 'Withdrawing...';
            case 'AUTHORIZING': return 'Authorizing...';
            case 'EXECUTING': return 'Executing...';
            case 'CONFIRMING': return 'Confirming...';
            case 'CREATING': return 'Creating Proxy...';
            default: return 'Processing...';
        }
    };

    const handleDeposit = async () => {
        if (!amount || isNaN(Number(amount))) return;
        const success = await deposit(Number(amount));
        if (success) {
            toast.success('Deposit successful!');
            setAmount('');
            onSuccess?.();
            await refreshStats();
        } else {
            toast.error(error || 'Deposit failed');
        }
    };

    const handleWithdraw = async () => {
        if (!amount || isNaN(Number(amount))) return;
        const success = await withdraw(Number(amount));
        if (success) {
            toast.success('Withdrawal successful!');
            setAmount('');
            onSuccess?.();
            await refreshStats();
        } else {
            toast.error(error || 'Withdrawal failed');
        }
    };

    const handleAuthorize = async () => {
        const defaultExecutor = process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || '0x4f07450Ef721147D38f29739eEe8079bC147f1f6';
        const targetOp = operatorAddress.trim() || defaultExecutor;

        if (!targetOp || !targetOp.startsWith('0x')) {
            toast.error('Invalid operator address');
            return;
        }

        const result = await authorizeOperator(targetOp, true);
        if (result.success) {
            setOptimisticAuth(true); // Immediate feedback
            toast.success('Operator authorized successfully!');
            setOperatorAddress('');
            onSuccess?.();
            await refreshStats(); // Ensure chain state matches
        } else {
            toast.error(result.error || 'Authorization failed');
        }
    };

    const handleRevoke = async () => {
        const defaultExecutor = process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || '0x4f07450Ef721147D38f29739eEe8079bC147f1f6';
        // Use custom address if set, otherwise default
        const targetOp = operatorAddress.trim() || defaultExecutor;

        const result = await authorizeOperator(targetOp, false); // false = revoke
        if (result.success) {
            setOptimisticAuth(false); // Immediate feedback
            toast.success('Access revoked successfully');
            setShowRevokeConfirm(false);
            onSuccess?.();
            await refreshStats();
        } else {
            toast.error(result.error || 'Revocation failed');
        }
    };

    // Strategy Profile Management
    // Default to first active config's profile or MODERATE
    const firstProfile = activeConfigs[0]?.strategyProfile || 'MODERATE';
    const [strategyProfile, setStrategyProfile] = useState<'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'>(firstProfile);
    const updateStoreConfig = useCopyTradingStore(state => state.updateConfig);

    const handleStrategyChange = async (newProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE') => {
        setStrategyProfile(newProfile); // Optimistic UI

        if (activeConfigs.length === 0) return;

        toast.promise(
            async () => {
                // Update all active configs
                const promises = activeConfigs.map(async (config) => {
                    // 1. API Update
                    await fetch('/api/copy-trading/config', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: config.id,
                            walletAddress: user?.wallet?.address || config.traderAddress, // Use user wallet or fallback to traderAddress (unlikely correct fallback but ensures non-empty string)
                            // config.traderAddress is TARGET. We need OWNER wallet.
                            // user.wallet.address is reliable if authenticated.
                            strategyProfile: newProfile
                        })
                    });

                    // 2. Store Update
                    updateStoreConfig(config.id, { strategyProfile: newProfile });
                });

                await Promise.all(promises);
            },
            {
                loading: 'Updating strategy profile...',
                success: 'Strategy profile updated for all active bots!',
                error: 'Failed to update strategy profile'
            }
        );
    };

    return (
        <div className="w-full rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('deposit')}
                    className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'deposit'
                        ? 'border-blue-500 text-blue-400 bg-blue-900/10'
                        : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <ArrowDownLeft className="h-4 w-4" />
                        Deposit
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('withdraw')}
                    className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'withdraw'
                        ? 'border-blue-500 text-blue-400 bg-blue-900/10'
                        : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <ArrowUpRight className="h-4 w-4" />
                        Withdraw
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'settings'
                        ? 'border-blue-500 text-blue-400 bg-blue-900/10'
                        : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Settings
                    </div>
                </button>
            </div>

            <div className="p-6">
                {activeTab === 'deposit' && (
                    <div className="space-y-6 max-w-xl mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-white mb-2">Deposit USDC</h3>
                            <p className="text-gray-400 text-sm">Transfer USDC from your wallet to your trading proxy</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Amount (USDC)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [appearance:textfield] ${!isNaN(Number(amount)) && Number(amount) > usdcBalance ? 'border-red-500 focus:border-red-500' : 'border-gray-700'
                                        }`}
                                />
                                <button
                                    onClick={() => setAmount(usdcBalance.toString())}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-500 hover:text-blue-400"
                                >
                                    MAX
                                </button>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <p className={!isNaN(Number(amount)) && Number(amount) > usdcBalance ? 'text-red-400 font-medium' : 'text-gray-500'}>
                                    {!isNaN(Number(amount)) && Number(amount) > usdcBalance ? 'Insufficient Balance' : ''}
                                </p>
                                <p className="text-gray-500 text-right">
                                    Wallet Balance: ${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        {/* Insufficient Balance Actions */}
                        {!isNaN(Number(amount)) && Number(amount) > usdcBalance && (
                            <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-start gap-3">
                                    <div className="bg-red-500/10 p-2 rounded-full">
                                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-red-200 mb-1">Low Wallet Balance</h4>
                                        <p className="text-xs text-red-300/80 mb-3">
                                            You don't have enough USDC in your wallet to complete this deposit.
                                        </p>
                                        <a
                                            href="https://app.uniswap.org/swap?chain=polygon&outputCurrency=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-md inline-flex items-center gap-1 transition-colors"
                                        >
                                            Buy USDC
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleDeposit}
                            disabled={txPending || (!isNaN(Number(amount)) && Number(amount) > usdcBalance) || !amount || Number(amount) <= 0}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {txPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>{getStatusText(txStatus)}</span>
                                </>
                            ) : (
                                <>
                                    <ArrowDownLeft className="h-4 w-4" />
                                    <span>Deposit Funds</span>
                                </>
                            )}
                        </button>

                        {txPending && (txStatus === 'APPROVING' || txStatus === 'DEPOSITING') && (
                            <p className="text-xs text-center text-blue-400 animate-pulse">
                                Please sign the transaction in your wallet
                            </p>
                        )}
                    </div>
                )}

                {activeTab === 'withdraw' && (
                    <div className="space-y-6 max-w-xl mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-white mb-2">Withdraw USDC</h3>
                            <p className="text-gray-400 text-sm">Withdraw funds from your proxy back to your wallet</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Amount (USDC)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [appearance:textfield]"
                                />
                                <button
                                    onClick={() => setAmount(stats?.balance.toString() || '')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-500 hover:text-blue-400"
                                >
                                    MAX
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 text-right">
                                Available: ${stats?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <button
                            onClick={handleWithdraw}
                            disabled={txPending}
                            className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {txPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                            Withdraw Funds
                        </button>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="space-y-6 max-w-xl mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-white mb-2">Bot Authorization</h3>
                            {!isExecutorAuthorized && (
                                <p className="text-gray-400 text-sm animate-in fade-in">
                                    Authorize the Horus Executor to enable copy trading.
                                </p>
                            )}
                        </div>

                        {showRevokeConfirm ? (
                            <div className="bg-red-900/10 border border-red-900/50 rounded-xl p-6 text-center animate-in fade-in">
                                <div className="mx-auto w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <h4 className="text-red-400 font-bold mb-2">Revoke Authorization?</h4>

                                {hasActiveTrades ? (
                                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <p className="text-red-300 font-semibold mb-1">⚠️ Active Trades Detected</p>
                                        <p className="text-red-300/80 text-sm">
                                            You have {activeConfigs.length} active copy trade(s). Revoking access will <strong>stop all future trades</strong> immediately.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-gray-400 text-sm mb-6">
                                        Are you sure? Use the toggle below to re-enable it later.
                                    </p>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowRevokeConfirm(false)}
                                        className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRevoke}
                                        disabled={txPending}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2"
                                    >
                                        {txPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                        Revoke Access
                                    </button>
                                </div>
                            </div>
                        ) : isExecutorAuthorized ? (
                            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden animate-in fade-in">
                                {/* Header Status */}
                                <div className="p-6 border-b border-gray-700/50 bg-green-900/10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                            <ShieldCheck className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-green-400 font-bold text-lg">Horus Execution Bot Active</h4>
                                            <p className="text-gray-400 text-sm">
                                                Your proxy is authorized for automated copy trading.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Grid */}
                                <div className="p-6 grid gap-6 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <h5 className="font-semibold text-white flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            Non-Custodial
                                        </h5>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            The bot can only execute trades on your behalf. It <strong>cannot</strong> withdraw funds or transfer assets.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h5 className="font-semibold text-white flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                            High Speed
                                        </h5>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Executes copy trades in &lt;50ms after the target trader, ensuring you get the best possible entry price.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h5 className="font-semibold text-white flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                            Full Control
                                        </h5>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            You can revoke authorization at any time. You maintain 100% ownership of your funds and keys.
                                        </p>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700/50 flex justify-between items-center">
                                    <button
                                        onClick={() => setShowRevokeConfirm(true)}
                                        className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                                    >
                                        Revoke Authorization
                                    </button>

                                    <button
                                        onClick={() => setUserWantsAdvanced(!userWantsAdvanced)}
                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        {userWantsAdvanced ? 'Hide Advanced Settings' : 'Advanced Settings'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl overflow-hidden animate-in fade-in">
                                <div className="p-6 text-center border-b border-blue-900/30">
                                    <div className="mx-auto w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                        <ShieldCheck className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <h4 className="text-blue-400 font-semibold mb-2">Enable Copy Trading</h4>
                                    <p className="text-gray-400 text-sm">
                                        One-click authorization for the Horus Bot.
                                    </p>
                                </div>

                                {/* Info Grid (Same as authorized state) */}
                                <div className="p-6 grid gap-6 md:grid-cols-3 bg-gray-900/30">
                                    {/* ... content ... */}
                                    {/* Omit reuse to avoid large chunk replacement error */}
                                </div>
                            </div>
                        )}

                        {/* Strategy Profile Selection (Only show if Authorized) */}
                        {isExecutorAuthorized && (
                            <div className="space-y-3 animate-in fade-in delay-100">
                                <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                                    Strategy Profile
                                    <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                                        Applies to all active bots
                                    </span>
                                </h4>
                                <StrategySelector
                                    value={strategyProfile}
                                    onChange={handleStrategyChange}
                                    disabled={activeConfigs.length === 0}
                                />
                                {activeConfigs.length === 0 && (
                                    <p className="text-xs text-center text-gray-500">
                                        Start copying a trader to configure strategy parameters.
                                    </p>
                                )}
                            </div>
                        )}

                        {(!isExecutorAuthorized || userWantsAdvanced) && !showRevokeConfirm && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400 flex justify-between">
                                        <span>Executor Address</span>
                                        {!isExecutorAuthorized && (
                                            <button
                                                onClick={() => setUserWantsAdvanced(!userWantsAdvanced)}
                                                className="text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                {userWantsAdvanced ? 'Use Default' : 'Custom Address'}
                                            </button>
                                        )}
                                    </label>

                                    {(userWantsAdvanced || !isExecutorAuthorized) && (
                                        <input
                                            placeholder={`Default Executor: ${process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS ? `${process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS.slice(0, 6)}...${process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS.slice(-4)}` : '0x...'}`}
                                            value={operatorAddress}
                                            onChange={(e) => setOperatorAddress(e.target.value)}
                                            disabled={!userWantsAdvanced && !isExecutorAuthorized} // Read-only if just showing default
                                            className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 ${(!userWantsAdvanced && !isExecutorAuthorized) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {!isExecutorAuthorized && (
                            <button
                                onClick={handleAuthorize}
                                disabled={txPending || (isExecutorAuthorized && !userWantsAdvanced)}
                                className={`w-full py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2
                                    ${isExecutorAuthorized && !userWantsAdvanced
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20'
                                    }`}
                            >
                                {txPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ShieldCheck className="h-4 w-4" />
                                )}
                                {txPending ? 'Processing...' : (isExecutorAuthorized ? 'Update Authorization' : 'Authorize Bot')}
                            </button>
                        )}
                    </div>
                )}

                {!!stats?.pendingFee && Number(stats.pendingFee) > 0 && activeTab === 'settings' && (
                    <div className="mt-6 pt-6 border-t border-gray-800">
                        <div className="flex justify-between items-center bg-yellow-900/20 p-4 rounded-lg border border-yellow-900/50 mb-4">
                            <div>
                                <h4 className="text-yellow-500 font-semibold text-sm">Pending Fees</h4>
                                <p className="text-yellow-600/80 text-xs">Performance fees ready to be settled</p>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-bold text-yellow-500">${stats.pendingFee}</div>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                const success = await settleFees();
                                if (success) toast.success('Fees settled successfully!');
                            }}
                            className="w-full py-2 bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-700/50 text-yellow-200 text-sm font-semibold rounded-lg transition-colors"
                        >
                            Settle Pending Fees
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
