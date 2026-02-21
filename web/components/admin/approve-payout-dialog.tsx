'use client';

import { useState } from 'react';
import { Loader2, X, CheckCircle2, AlertCircle, DollarSign, Wallet } from 'lucide-react';

interface ApprovePayoutDialogProps {
    isOpen: boolean;
    onClose: () => void;
    payout: {
        id: string;
        walletAddress: string;
        amount: number;
        referralCode?: string;
    } | null;
    onConfirm: () => Promise<void>;
}

type DialogStep = 'confirm' | 'submitting' | 'success' | 'error';

export function ApprovePayoutDialog({ isOpen, onClose, payout, onConfirm }: ApprovePayoutDialogProps) {
    const [step, setStep] = useState<DialogStep>('confirm');
    const [errorMessage, setErrorMessage] = useState<string>('');

    if (!isOpen || !payout) return null;

    const handleConfirm = async () => {
        setStep('submitting');
        try {
            await onConfirm();
            setStep('success');
        } catch (error: any) {
            setErrorMessage(error.message || 'Approval failed');
            setStep('error');
        }
    };

    const handleClose = () => {
        setStep('confirm');
        setErrorMessage('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={step === 'confirm' || step === 'success' || step === 'error' ? handleClose : undefined}
            />

            {/* Dialog */}
            <div className="relative w-full max-w-md mx-4 bg-[#1a1b1e] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Close button */}
                {(step === 'confirm' || step === 'success' || step === 'error') && (
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}

                <div className="p-6">
                    {step === 'confirm' && (
                        <>
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Approve Payout</h2>
                                    <p className="text-sm text-muted-foreground">Verify details before approving</p>
                                </div>
                            </div>

                            {/* Payout Details Card */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                    <span className="text-sm text-muted-foreground">Amount</span>
                                    <span className="text-xl font-bold text-green-500 flex items-center">
                                        <DollarSign className="h-4 w-4" />
                                        {payout.amount.toFixed(2)}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground flex items-center gap-2">
                                            <Wallet className="h-3 w-3" /> Wallet
                                        </span>
                                        <span className="text-white font-mono text-xs">
                                            {payout.walletAddress}
                                        </span>
                                    </div>
                                    {payout.referralCode && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">User</span>
                                            <span className="text-white bg-white/5 px-2 py-0.5 rounded text-xs">
                                                @{payout.referralCode}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Warning/Info */}
                            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-6">
                                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-yellow-500/90 leading-relaxed">
                                    Approving this request will mark it as <strong>PROCESSING</strong>. You will still need to manually send funds and mark as Completed later.
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-colors font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors text-sm"
                                >
                                    Confirm Approval
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'submitting' && (
                        <div className="py-8 text-center">
                            <Loader2 className="h-10 w-10 animate-spin text-green-500 mx-auto mb-4" />
                            <h2 className="text-lg font-bold text-white mb-2">Processing Approval</h2>
                            <p className="text-sm text-muted-foreground">
                                Updating payout status...
                            </p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-8 text-center">
                            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Approved Successfully!</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                The payout request is now in <strong>Processing</strong> state.
                            </p>
                            <button
                                onClick={handleClose}
                                className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors text-sm"
                            >
                                Done
                            </button>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="py-8 text-center">
                            <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                                <X className="h-8 w-8 text-red-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Action Failed</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                {errorMessage}
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors text-sm"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => setStep('confirm')}
                                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors text-sm"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
