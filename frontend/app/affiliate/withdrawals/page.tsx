'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Wallet,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    ExternalLink,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { affiliateApi } from '@/lib/affiliate-api';

interface Payout {
    id: string;
    amount: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
    txHash: string | null;
    createdAt: string;
    processedAt: string | null;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    PENDING: {
        color: 'text-yellow-400',
        bg: 'bg-yellow-400/10',
        icon: <Clock className="h-3 w-3" />
    },
    PROCESSING: {
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        icon: <Loader2 className="h-3 w-3 animate-spin" />
    },
    COMPLETED: {
        color: 'text-green-400',
        bg: 'bg-green-400/10',
        icon: <CheckCircle className="h-3 w-3" />
    },
    REJECTED: {
        color: 'text-red-400',
        bg: 'bg-red-400/10',
        icon: <XCircle className="h-3 w-3" />
    },
};

export default function WithdrawalsPage() {
    const { authenticated, user, ready } = usePrivy();
    const { wallets } = useWallets();

    const [balance, setBalance] = useState(0);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const walletAddress = user?.wallet?.address;

    const fetchData = useCallback(async () => {
        if (!walletAddress) return;

        setIsLoading(true);
        try {
            // Fetch stats for balance
            const stats = await affiliateApi.getStats(walletAddress);
            setBalance(stats.pendingPayout || 0);

            // Fetch payout history
            const history = await affiliateApi.getPayoutHistory(walletAddress);
            setPayouts(history);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        if (ready && authenticated && walletAddress) {
            fetchData();
        }
    }, [ready, authenticated, walletAddress, fetchData]);

    const handleWithdraw = async () => {
        if (!walletAddress || balance < 10) {
            toast.error('Minimum withdrawal is $10');
            return;
        }

        const wallet = wallets[0];
        if (!wallet) {
            toast.error('Please connect your wallet');
            return;
        }

        setIsWithdrawing(true);
        try {
            // Step 1: Get the signature message
            const timestamp = Date.now();
            const messageData = await affiliateApi.getPayoutMessage(walletAddress, timestamp);

            toast.info('Please sign the withdrawal request in your wallet');

            // Step 2: Request signature from wallet
            const ethereumProvider = await wallet.getEthereumProvider();
            const { ethers } = await import('ethers');
            const web3Provider = new ethers.providers.Web3Provider(ethereumProvider);
            const signer = web3Provider.getSigner();
            const signature = await signer.signMessage(messageData.message);

            // Step 3: Submit withdrawal
            const result = await affiliateApi.requestPayout(walletAddress, signature, timestamp);

            toast.success(`Withdrawal of $${result.amount?.toFixed(2)} submitted!`);

            // Refresh data
            await fetchData();
        } catch (error: any) {
            console.error('Withdrawal error:', error);
            if (error.message?.includes('User rejected')) {
                toast.error('Signature cancelled');
            } else {
                toast.error(error.message || 'Withdrawal failed');
            }
        } finally {
            setIsWithdrawing(false);
        }
    };

    if (!ready) {
        return (
            <div className="min-h-screen bg-[#0d0e10] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#0d0e10] flex items-center justify-center">
                <p className="text-muted-foreground">Please connect your wallet</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d0e10] text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#1a1b1e]/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link
                        href="/affiliate"
                        className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Dashboard</span>
                    </Link>
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-green-400" />
                        Withdraw Earnings
                    </h1>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

                {/* Balance Card */}
                <section className="bg-gradient-to-br from-green-500/10 to-green-500/0 border border-green-500/20 rounded-2xl p-8">
                    <div className="text-center">
                        <p className="text-sm text-green-400 font-medium mb-2">Available Balance</p>
                        {isLoading ? (
                            <Loader2 className="h-8 w-8 animate-spin text-green-400 mx-auto" />
                        ) : (
                            <h2 className="text-5xl font-bold text-white mb-6">
                                ${balance.toFixed(2)}
                                <span className="text-lg text-muted-foreground ml-2">USDC</span>
                            </h2>
                        )}

                        {balance < 10 ? (
                            <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <span>Minimum withdrawal is $10.00</span>
                            </div>
                        ) : null}

                        <button
                            onClick={handleWithdraw}
                            disabled={isWithdrawing || balance < 10 || isLoading}
                            className={cn(
                                "px-8 py-3 rounded-xl font-semibold text-white transition-all flex items-center gap-2 mx-auto",
                                balance >= 10
                                    ? "bg-green-600 hover:bg-green-500"
                                    : "bg-gray-600 cursor-not-allowed"
                            )}
                        >
                            {isWithdrawing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Wallet className="h-4 w-4" />
                                    Withdraw All
                                </>
                            )}
                        </button>

                        <p className="text-xs text-muted-foreground mt-4">
                            Requires wallet signature for security • Processed within 24 hours
                        </p>
                    </div>
                </section>

                {/* Withdrawal History */}
                <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-400" />
                            Withdrawal History
                        </h3>
                        <button
                            onClick={fetchData}
                            className="text-muted-foreground hover:text-white transition-colors"
                            disabled={isLoading}
                        >
                            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : payouts.length === 0 ? (
                        <div className="text-center py-12">
                            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <p className="text-muted-foreground">No withdrawal history yet</p>
                            <p className="text-sm text-muted-foreground/60">Your withdrawals will appear here</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-muted-foreground">
                                        <th className="text-left py-3 px-2 font-medium">Amount</th>
                                        <th className="text-left py-3 px-2 font-medium">Status</th>
                                        <th className="text-left py-3 px-2 font-medium">Date</th>
                                        <th className="text-left py-3 px-2 font-medium">Transaction</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payouts.map((payout) => {
                                        const style = STATUS_STYLES[payout.status] || STATUS_STYLES.PENDING;
                                        return (
                                            <tr key={payout.id} className="border-b border-white/5">
                                                <td className="py-3 px-2 font-mono font-semibold text-white">
                                                    ${payout.amount.toFixed(2)}
                                                </td>
                                                <td className="py-3 px-2">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
                                                        style.color, style.bg
                                                    )}>
                                                        {style.icon}
                                                        {payout.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-muted-foreground">
                                                    {new Date(payout.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="py-3 px-2">
                                                    {payout.txHash ? (
                                                        <a
                                                            href={`https://polygonscan.com/tx/${payout.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                                        >
                                                            {payout.txHash.slice(0, 8)}...
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Back Button */}
                <div className="text-center pb-8">
                    <Link
                        href="/affiliate"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
