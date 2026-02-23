'use client';

import { useState, useEffect } from 'react';
import { useProxy } from '@/lib/contracts/useProxy';
import { Loader2, ArrowRight, ShieldAlert, CheckCircle2, Wallet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ProxyMigrationWizardProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProxyMigrationWizard({ isOpen, onClose }: ProxyMigrationWizardProps) {
    const {
        isLegacyProxy,
        legacyStats,
        withdrawAllFromLegacy,
        createProxy,
        txPending,
        txStatus,
        error
    } = useProxy();

    const [step, setStep] = useState<1 | 2>(1);

    // Auto-advance step 1 if balance is 0
    useEffect(() => {
        if (isOpen && legacyStats && legacyStats.balance === 0) {
            setStep(2);
        }
    }, [isOpen, legacyStats]);

    if (!isOpen || !isLegacyProxy) return null;

    const needsWithdrawal = (legacyStats?.balance || 0) > 0;

    const handleWithdraw = async () => {
        const success = await withdrawAllFromLegacy();
        if (success) {
            toast.success('Successfully withdrew legacy funds.');
            setStep(2);
        } else {
            toast.error(error || 'Failed to withdraw from legacy proxy.');
        }
    };

    const handleCreateV2 = async () => {
        const address = await createProxy('STARTER');
        if (address) {
            toast.success('V2 Proxy deployed successfully!');
            onClose();
        } else {
            toast.error(error || 'Failed to deploy V2 proxy.');
        }
    };

    const getStatusText = (status: typeof txStatus) => {
        if (!status) return 'Processing...';
        switch (status) {
            case 'WITHDRAWING': return 'Withdrawing...';
            case 'CREATING': return 'Deploying Proxy...';
            case 'CONFIRMING': return 'Confirming Transaction...';
            default: return 'Processing...';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg dark:bg-zinc-950 dark:border-zinc-800">
                <div className="flex flex-col space-y-4">
                    <div className="flex items-center gap-3 text-amber-500">
                        <ShieldAlert className="h-8 w-8" />
                        <div>
                            <h2 className="text-lg font-bold">Important Upgrade Required</h2>
                            <p className="text-sm text-muted-foreground">Migrate to V2 for 0-latency trading.</p>
                        </div>
                    </div>

                    <div className="space-y-4 py-4">
                        {/* Step 1 */}
                        <div className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${step === 1 ? 'border-amber-500/50 bg-amber-500/10' : 'border-zinc-800 opacity-60'}`}>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                {step > 1 || !needsWithdrawal ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Wallet className="h-4 w-4" />}
                            </div>
                            <div className="space-y-1 w-full">
                                <h4 className="font-semibold">Step 1: Withdraw Legacy Funds</h4>
                                <p className="text-sm text-muted-foreground">
                                    Your V1 proxy holds <strong className="text-foreground">${legacyStats?.balance.toFixed(2) || '0.00'}</strong> USDC. You must withdraw this before upgrading.
                                </p>
                                {step === 1 && needsWithdrawal && (
                                    <button
                                        onClick={handleWithdraw}
                                        disabled={txPending}
                                        className="mt-3 inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                                    >
                                        {txPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {getStatusText(txStatus)}
                                            </>
                                        ) : (
                                            'Withdraw All USDC'
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${step === 2 ? 'border-blue-500/50 bg-blue-500/10' : 'border-zinc-800 opacity-60'}`}>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                <RefreshCw className="h-4 w-4" />
                            </div>
                            <div className="space-y-1 w-full">
                                <h4 className="font-semibold">Step 2: Deploy V2 Proxy</h4>
                                <p className="text-sm text-muted-foreground">
                                    Create your new EIP-1271 optimized proxy for 0-latency execution.
                                </p>
                                {step === 2 && (
                                    <button
                                        onClick={handleCreateV2}
                                        disabled={txPending}
                                        className="mt-3 inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                                    >
                                        {txPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {getStatusText(txStatus)}
                                            </>
                                        ) : (
                                            'Deploy V2 Proxy'
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 text-xs text-muted-foreground">
                        Your funds are safe. This is an on-chain upgrade process.
                    </div>
                </div>
            </div>
        </div>
    );
}
