'use client';

import { useState } from 'react';
import { useProxy } from '@/lib/contracts/useProxy';
import { Loader2, ArrowDownLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface ProxyActionCenterProps {
    onSuccess?: () => void;
}

export function ProxyActionCenter({ onSuccess }: ProxyActionCenterProps) {
    const {
        stats,
        usdcBalance,
        deposit,
        withdraw,
        authorizeOperator,
        txPending,
        txStatus,
        error,
        isExecutorAuthorized
    } = useProxy();

    const [amount, setAmount] = useState('');
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'settings'>('deposit');
    const [operatorAddress, setOperatorAddress] = useState('');
    const [userWantsAdvanced, setUserWantsAdvanced] = useState(false);

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
            toast.success('Operator authorized successfully!');
            setOperatorAddress('');
        } else {
            toast.error(result.error || 'Authorization failed');
        }
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
                            <p className="text-gray-400 text-sm">
                                {isExecutorAuthorized
                                    ? "✅ Your proxy is fully authorized to use the PolyHunter Bot."
                                    : "Authorize the PolyHunter Executor to enable copy trading."}
                            </p>
                        </div>

                        {isExecutorAuthorized ? (
                            <div className="bg-green-900/20 border border-green-900/50 rounded-xl p-6 text-center animate-in fade-in">
                                <div className="mx-auto w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                    <ShieldCheck className="w-6 h-6 text-green-400" />
                                </div>
                                <h4 className="text-green-400 font-semibold mb-2">Bot Operational</h4>
                                <p className="text-green-500/60 text-sm mb-6">
                                    The Executor Contract is authorized to manage trades on your behalf.
                                </p>

                                <button
                                    onClick={() => setUserWantsAdvanced(!userWantsAdvanced)}
                                    className="text-xs text-gray-500 hover:text-gray-400 underline"
                                >
                                    {userWantsAdvanced ? 'Hide Advanced Settings' : 'Advanced Settings'}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-6 text-center">
                                <div className="mx-auto w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                    <ShieldCheck className="w-6 h-6 text-blue-400" />
                                </div>
                                <h4 className="text-blue-400 font-semibold mb-2">Enable Copy Trading</h4>
                                <p className="text-gray-400 text-sm mb-6">
                                    One-click authorization for the PolyHunter Bot.
                                </p>
                            </div>
                        )}

                        {(!isExecutorAuthorized || userWantsAdvanced) && (
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
                    </div>
                )}
            </div>
        </div>
    );
}
