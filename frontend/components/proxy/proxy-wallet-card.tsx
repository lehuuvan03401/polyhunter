'use client';

import { useState } from 'react';
import { useProxy } from '@/lib/contracts/useProxy';
import { Loader2, Plus, Wallet, ArrowDownLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function ProxyWalletCard() {
    const {
        hasProxy,
        proxyAddress,
        stats,
        usdcBalance,
        isLoading,
        createProxy,
        deposit,
        withdraw,
        authorizeOperator,
        txPending,
        txStatus,
        error
    } = useProxy();

    const [amount, setAmount] = useState('');
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'settings'>('deposit');
    const [operatorAddress, setOperatorAddress] = useState('');

    const getStatusText = (status: typeof txStatus) => {
        switch (status) {
            case 'APPROVING': return 'Approving USDC...';
            case 'DEPOSITING': return 'Sign Deposit Tx...';
            case 'WITHDRAWING': return 'Withdrawing...';
            case 'AUTHORIZING': return 'Authorizing...';
            case 'EXECUTING': return 'Executing...';
            case 'CONFIRMING': return 'Confirming...';
            case 'CREATING': return 'Creating Wallet...';
            default: return 'Processing...';
        }
    };

    const handleCreateProxy = async () => {
        const address = await createProxy('STARTER');
        if (address) {
            toast.success('Proxy wallet created successfully!');
        } else if (error) {
            toast.error(error);
        }
    };

    const handleDeposit = async () => {
        if (!amount || isNaN(Number(amount))) return;
        const success = await deposit(Number(amount));
        if (success) {
            toast.success('Deposit successful!');
            setAmount('');
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
        } else {
            toast.error(error || 'Withdrawal failed');
        }
    };

    const handleAuthorize = async () => {
        // Use configured bot address from env or fallback to user input
        const defaultBot = process.env.NEXT_PUBLIC_BOT_ADDRESS || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
        const targetOp = operatorAddress.trim() || defaultBot;

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

    if (isLoading) {
        return (
            <div className="w-full rounded-xl border bg-card p-6 shadow-sm animate-pulse">
                <div className="flex justify-between items-start pb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-5 w-5 rounded bg-muted-foreground/20" />
                            <div className="h-5 w-24 rounded bg-muted-foreground/20" />
                        </div>
                        <div className="h-3 w-32 rounded bg-muted-foreground/20" />
                    </div>
                    <div className="text-right">
                        <div className="h-8 w-24 rounded bg-muted-foreground/20 mb-2" />
                        <div className="h-3 w-16 rounded bg-muted-foreground/20 ml-auto" />
                    </div>
                </div>
                <div className="h-9 w-full rounded-lg bg-muted-foreground/10 mb-4" />
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="h-4 w-24 rounded bg-muted-foreground/20" />
                        <div className="h-9 w-full rounded bg-muted-foreground/10" />
                        <div className="h-3 w-32 rounded bg-muted-foreground/20 ml-auto" />
                    </div>
                    <div className="h-9 w-full rounded bg-muted-foreground/20" />
                </div>
            </div>
        );
    }

    if (!hasProxy) {
        return (
            <div className="w-full rounded-xl border border-dashed p-6 bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 pb-4">
                    <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Smart Wallet
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Create a dedicated smart wallet to enable Copy Trading.
                    </p>
                </div>
                <div>
                    <button
                        onClick={handleCreateProxy}
                        disabled={txPending}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 w-full text-white bg-blue-600 hover:bg-blue-700"
                    >
                        {txPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span>{getStatusText(txStatus)}</span>
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                <span>Create Smart Wallet</span>
                            </>
                        )}
                    </button>
                    {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6 pb-3">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-blue-500" />
                            Smart Wallet
                        </h3>
                        <p className="text-xs font-mono mt-1 text-muted-foreground">
                            {proxyAddress?.slice(0, 6)}...{proxyAddress?.slice(-4)}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold tracking-tight">
                            ${stats?.balance.toLocaleString() || '0.00'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Profit: <span className={(stats?.profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                                ${(stats?.profit || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-6 pt-0">
                {/* Tabs */}
                <div className="w-full">
                    <div className="grid w-full grid-cols-3 mb-4 h-9 items-center justify-center rounded-lg bg-gray-100 p-1 text-muted-foreground dark:bg-gray-800">
                        {['deposit', 'withdraw', 'settings'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${activeTab === tab ? 'bg-white text-black shadow dark:bg-gray-950 dark:text-white' : ''}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'deposit' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Amount (USDC)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                                        className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [appearance:textfield] ${!isNaN(Number(amount)) && Number(amount) > usdcBalance ? 'border-red-500 focus-visible:ring-red-500' : 'border-gray-200 border-input'
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
                                    <p className={!isNaN(Number(amount)) && Number(amount) > usdcBalance ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
                                        {!isNaN(Number(amount)) && Number(amount) > usdcBalance ? 'Insufficient Balance' : ''}
                                    </p>
                                    <p className="text-muted-foreground text-right">
                                        Wallet Balance: ${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            {/* Insufficient Balance Link */}
                            {!isNaN(Number(amount)) && Number(amount) > usdcBalance && (
                                <div className="text-center pb-2">
                                    <a
                                        href="https://app.uniswap.org/swap?chain=polygon&outputCurrency=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-500 hover:text-blue-600 underline"
                                    >
                                        Buy USDC on Uniswap ↗
                                    </a>
                                </div>
                            )}

                            <button
                                onClick={handleDeposit}
                                disabled={txPending || (!isNaN(Number(amount)) && Number(amount) > usdcBalance) || !amount || Number(amount) <= 0}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 disabled:bg-gray-300 dark:disabled:bg-gray-800"
                            >
                                {txPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>{getStatusText(txStatus)}</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowDownLeft className="mr-2 h-4 w-4" />
                                        <span>Deposit Funds</span>
                                    </>
                                )}
                            </button>

                            {txPending && (txStatus === 'APPROVING' || txStatus === 'DEPOSITING') && (
                                <p className="text-xs text-center text-blue-500 animate-pulse pt-2">
                                    Please sign the transaction in your wallet
                                </p>
                            )}
                        </div>
                    )}

                    {activeTab === 'withdraw' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Amount (USDC)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 border-gray-200 dark:border-gray-800 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [appearance:textfield]"
                                    />
                                    <button
                                        onClick={() => setAmount(stats?.balance.toString() || '')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-500 hover:text-blue-400"
                                    >
                                        MAX
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground text-right">
                                    Max: ${stats?.balance.toLocaleString() || '0.00'}
                                </p>
                            </div>
                            <button
                                onClick={handleWithdraw}
                                disabled={txPending}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full border-gray-200 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800"
                            >
                                {txPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>{getStatusText(txStatus)}</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpRight className="mr-2 h-4 w-4" />
                                        <span>Withdraw Funds</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-4">
                            <div className="rounded-md bg-muted p-3 text-sm bg-gray-100 dark:bg-gray-800">
                                <div className="flex items-center gap-2 mb-2 font-medium">
                                    <ShieldCheck className="h-4 w-4" />
                                    Bot Authorization
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Authorize the platform bot to execute trades on your behalf.
                                </p>
                                <div className="space-y-2">
                                    <input
                                        placeholder={`Default Bot: ${process.env.NEXT_PUBLIC_BOT_ADDRESS ? `${process.env.NEXT_PUBLIC_BOT_ADDRESS.slice(0, 6)}...${process.env.NEXT_PUBLIC_BOT_ADDRESS.slice(-4)}` : '0x...'}`}
                                        value={operatorAddress}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOperatorAddress(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 border-gray-200 dark:border-gray-700"
                                    />
                                    <button
                                        onClick={handleAuthorize}
                                        disabled={txPending}
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 text-xs w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                                    >
                                        {txPending ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span className="ml-2">{getStatusText(txStatus)}</span>
                                            </>
                                        ) : 'Authorize Bot'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
