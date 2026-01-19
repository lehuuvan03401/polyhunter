'use client';

import { useState } from 'react';
import { Loader2, X, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WithdrawDialogProps {
    isOpen: boolean;
    onClose: () => void;
    pendingAmount: number;
    onConfirm: () => Promise<void>;
}

type DialogStep = 'confirm' | 'signing' | 'submitting' | 'success' | 'error';

export function WithdrawDialog({ isOpen, onClose, pendingAmount, onConfirm }: WithdrawDialogProps) {
    const [step, setStep] = useState<DialogStep>('confirm');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [withdrawingAmount, setWithdrawingAmount] = useState<number>(0);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setWithdrawingAmount(pendingAmount);
        setStep('signing');
        try {
            await onConfirm();
            setStep('success');
        } catch (error: any) {
            setErrorMessage(error.message || 'Withdrawal failed');
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
            <div className="relative w-full max-w-md mx-4 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
                                    <Wallet className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Request Withdrawal</h2>
                                    <p className="text-sm text-muted-foreground">Withdraw your affiliate earnings</p>
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 text-center">
                                <div className="text-sm text-muted-foreground mb-2">Available to Withdraw</div>
                                <div className="text-4xl font-bold text-green-500 font-mono">
                                    ${pendingAmount.toFixed(2)}
                                </div>
                            </div>

                            {/* Info */}
                            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-6">
                                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-yellow-500/90">
                                    You will be asked to sign a message with your wallet to authorize this withdrawal. This is for security purposes.
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors"
                                >
                                    Confirm Withdrawal
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'signing' && (
                        <div className="py-8 text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">Sign in Wallet</h2>
                            <p className="text-muted-foreground">
                                Please sign the message in your wallet to authorize the withdrawal...
                            </p>
                        </div>
                    )}

                    {step === 'submitting' && (
                        <div className="py-8 text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-green-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">Processing</h2>
                            <p className="text-muted-foreground">
                                Submitting your withdrawal request...
                            </p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-8 text-center">
                            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="h-10 w-10 text-green-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Withdrawal Submitted!</h2>
                            <p className="text-muted-foreground mb-6">
                                Your withdrawal request of <span className="text-green-500 font-bold">${withdrawingAmount.toFixed(2)}</span> has been submitted successfully.
                            </p>
                            <button
                                onClick={handleClose}
                                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="py-8 text-center">
                            <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                                <X className="h-10 w-10 text-red-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Withdrawal Failed</h2>
                            <p className="text-muted-foreground mb-6">
                                {errorMessage}
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={handleClose}
                                    className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => setStep('confirm')}
                                    className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors"
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
