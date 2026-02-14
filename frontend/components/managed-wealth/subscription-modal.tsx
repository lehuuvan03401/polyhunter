'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export interface ManagedTerm {
    id: string;
    label: string;
    durationDays: number;
    targetReturnMin: number;
    targetReturnMax: number;
    maxDrawdown: number;
    minYieldRate?: number | null;
    performanceFeeRate?: number | null;
    maxSubscriptionAmount?: number | null;
}

export interface ManagedProduct {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    strategyProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    isGuaranteed: boolean;
    disclosurePolicy: 'TRANSPARENT' | 'DELAYED';
    disclosureDelayHours: number;
    performanceFeeRate: number;
    reserveCoverageMin: number;
    terms: ManagedTerm[];
}

interface SubscriptionModalProps {
    open: boolean;
    product: ManagedProduct | null;
    walletAddress?: string;
    presetTermId?: string;
    onClose: () => void;
    onRequireLogin: () => void;
    onSuccess?: (subscriptionId: string) => void;
}

export function SubscriptionModal({
    open,
    product,
    walletAddress,
    presetTermId,
    onClose,
    onRequireLogin,
    onSuccess,
}: SubscriptionModalProps) {
    const [termId, setTermId] = useState('');
    const [principal, setPrincipal] = useState('100');
    const [riskConfirmed, setRiskConfirmed] = useState(false);
    const [termsConfirmed, setTermsConfirmed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!open || !product) return;
        setTermId(presetTermId || product.terms[0]?.id || '');
        setPrincipal('100');
        setRiskConfirmed(false);
        setTermsConfirmed(false);
    }, [open, product, presetTermId]);

    const selectedTerm = useMemo(() => {
        if (!product) return null;
        return product.terms.find((term) => term.id === termId) || null;
    }, [product, termId]);

    if (!open || !product) return null;

    const canSubmit = Boolean(walletAddress && selectedTerm && riskConfirmed && termsConfirmed && Number(principal) > 0 && !isSubmitting);

    const submit = async () => {
        if (!walletAddress) {
            onRequireLogin();
            return;
        }

        if (!selectedTerm) {
            toast.error('Please select a term.');
            return;
        }

        const amount = Number(principal);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Please enter a valid principal amount.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/managed-subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress,
                    productId: product.id,
                    termId: selectedTerm.id,
                    principal: amount,
                    acceptedTerms: true,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to create subscription');
            }

            toast.success('Subscription created successfully.');
            onSuccess?.(data.subscription.id);
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Subscription failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121417] shadow-2xl">
                <div className="flex items-start justify-between border-b border-white/10 p-5">
                    <div>
                        <h3 className="text-lg font-bold text-white">Subscribe to {product.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Select term and principal to start managed execution.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">Term</span>
                        <select
                            className="w-full rounded-lg border border-white/10 bg-[#181c22] px-3 py-2 text-white"
                            value={termId}
                            onChange={(e) => setTermId(e.target.value)}
                        >
                            {product.terms.map((term) => (
                                <option key={term.id} value={term.id}>
                                    {term.label} ({term.durationDays}d) | target {term.targetReturnMin}% - {term.targetReturnMax}%
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">Principal (USDC)</span>
                        <input
                            className="w-full rounded-lg border border-white/10 bg-[#181c22] px-3 py-2 text-white"
                            value={principal}
                            onChange={(e) => setPrincipal(e.target.value)}
                            inputMode="decimal"
                            placeholder="100"
                        />
                    </label>

                    {selectedTerm && (
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-100">
                            <div>Target return: {selectedTerm.targetReturnMin}% - {selectedTerm.targetReturnMax}%</div>
                            <div>Max drawdown: {selectedTerm.maxDrawdown}%</div>
                            {product.isGuaranteed && selectedTerm.minYieldRate !== null && selectedTerm.minYieldRate !== undefined && (
                                <div>Guaranteed floor: {Number(selectedTerm.minYieldRate) * 100}% (conservative only)</div>
                            )}
                        </div>
                    )}

                    <label className="flex items-start gap-2 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={riskConfirmed}
                            onChange={(e) => setRiskConfirmed(e.target.checked)}
                        />
                        <span>
                            I understand this is strategy investing with potential drawdown and execution risk.
                        </span>
                    </label>

                    <label className="flex items-start gap-2 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={termsConfirmed}
                            onChange={(e) => setTermsConfirmed(e.target.checked)}
                        />
                        <span>
                            I accept product terms, disclosure policy, and settlement mechanism.
                        </span>
                    </label>

                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                        <div className="flex items-center gap-1 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Important
                        </div>
                        <div className="mt-1">
                            Profit sharing applies on positive returns. Early redemption policy may affect guarantee eligibility.
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 p-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Confirm Subscription
                    </button>
                </div>
            </div>
        </div>
    );
}
