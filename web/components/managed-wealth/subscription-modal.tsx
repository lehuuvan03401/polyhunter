'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, X, ShieldCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useManagedWalletAuth } from '@/lib/managed-wealth/wallet-auth-client';
import { MANAGED_STRATEGY_THEMES } from '@/lib/managed-wealth/strategy-theme';

type ManagedBand = 'A' | 'B' | 'C';

const MANAGED_BAND_LIMITS: Record<ManagedBand, { min: number; max: number }> = {
    A: { min: 500, max: 5000 },
    B: { min: 5001, max: 50000 },
    C: { min: 50001, max: 300000 },
};

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
    presetPrincipalBand?: ManagedBand;
    onClose: () => void;
    onRequireLogin: () => void;
    onSuccess?: (subscriptionId: string) => void;
}

type SubscriptionCreateResponse = {
    error?: string;
    subscription: {
        id: string;
    };
    marketing?: {
        trialApplied?: boolean;
        trialEndsAt?: string | null;
        referralBonusApplied?: boolean;
    };
};

type ManagedReturnEstimateRow = {
    principalBand: 'A' | 'B' | 'C';
    minPrincipalUsd: number;
    maxPrincipalUsd: number;
    termDays: number;
    strategyProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    returnMin: number;
    returnMax: number;
    returnUnit: 'PERCENT' | 'MULTIPLIER';
    displayRange: string;
};

type ManagedReturnEstimate = {
    input: {
        principalUsd: number;
        cycleDays: number;
        strategyProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    };
    principalBand: 'A' | 'B' | 'C' | null;
    matched: boolean;
    row: ManagedReturnEstimateRow | null;
};

function formatTermRangeFallback(term: ManagedTerm): string {
    return `${term.targetReturnMin}% - ${term.targetReturnMax}%`;
}

export function SubscriptionModal({
    open,
    product,
    walletAddress,
    presetTermId,
    presetPrincipalBand,
    onClose,
    onRequireLogin,
    onSuccess,
}: SubscriptionModalProps) {
    const t = useTranslations('ManagedWealth');
    const tProducts = useTranslations('ManagedWealth.Products');
    const { createWalletAuthHeaders } = useManagedWalletAuth();
    const [termId, setTermId] = useState('');
    const [principal, setPrincipal] = useState('500');
    const [riskConfirmed, setRiskConfirmed] = useState(false);
    const [termsConfirmed, setTermsConfirmed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [managedReturnEstimate, setManagedReturnEstimate] = useState<ManagedReturnEstimate | null>(null);
    const [isEstimatingReturn, setIsEstimatingReturn] = useState(false);

    useEffect(() => {
        if (!open || !product) return;
        setTermId(presetTermId || product.terms[0]?.id || '');
        setPrincipal(String(presetPrincipalBand ? MANAGED_BAND_LIMITS[presetPrincipalBand].min : 500));
        setRiskConfirmed(false);
        setTermsConfirmed(false);
    }, [open, product, presetPrincipalBand, presetTermId]);

    const selectedTerm = useMemo(() => {
        if (!product) return null;
        return product.terms.find((term) => term.id === termId) || null;
    }, [product, termId]);

    useEffect(() => {
        if (!open || !product || !selectedTerm) {
            setManagedReturnEstimate(null);
            setIsEstimatingReturn(false);
            return;
        }

        const parsedPrincipal = Number(principal);
        if (!Number.isFinite(parsedPrincipal) || parsedPrincipal <= 0) {
            setManagedReturnEstimate(null);
            setIsEstimatingReturn(false);
            return;
        }

        const controller = new AbortController();
        const params = new URLSearchParams();
        params.set('principalUsd', String(parsedPrincipal));
        params.set('cycleDays', String(selectedTerm.durationDays));
        params.set('strategy', product.strategyProfile);

        async function fetchEstimate() {
            setIsEstimatingReturn(true);
            try {
                const res = await fetch(`/api/participation/rules?${params.toString()}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || 'Failed to fetch managed return estimate');
                }
                setManagedReturnEstimate((data?.managedReturnEstimate as ManagedReturnEstimate | null) ?? null);
            } catch (error) {
                if ((error as { name?: string })?.name === 'AbortError') {
                    return;
                }
                setManagedReturnEstimate(null);
            } finally {
                if (!controller.signal.aborted) {
                    setIsEstimatingReturn(false);
                }
            }
        }

        fetchEstimate();
        return () => controller.abort();
    }, [open, principal, product, selectedTerm]);

    if (!open || !product) return null;

    const theme = MANAGED_STRATEGY_THEMES[product.strategyProfile];
    const strategyLabel = t(
        `ProductCard.strategies.${theme.labelKey}` as
        | 'ProductCard.strategies.Conservative'
        | 'ProductCard.strategies.Moderate'
        | 'ProductCard.strategies.Aggressive'
    );
    const productName = tProducts(
        `${product.strategyProfile}.name` as
        | 'CONSERVATIVE.name'
        | 'MODERATE.name'
        | 'AGGRESSIVE.name'
    );
    const parsedPrincipal = Number(principal);
    const principalBandLimit = presetPrincipalBand ? MANAGED_BAND_LIMITS[presetPrincipalBand] : null;
    const isOutOfBandRange = Boolean(
        principalBandLimit
        && Number.isFinite(parsedPrincipal)
        && (parsedPrincipal < principalBandLimit.min || parsedPrincipal > principalBandLimit.max)
    );
    const canSubmit = Boolean(
        walletAddress
        && selectedTerm
        && riskConfirmed
        && termsConfirmed
        && Number.isFinite(parsedPrincipal)
        && parsedPrincipal > 0
        && !isOutOfBandRange
        && !isSubmitting
    );
    const estimatedRange = selectedTerm
        ? managedReturnEstimate?.matched && managedReturnEstimate.row
            ? managedReturnEstimate.row.displayRange
            : formatTermRangeFallback(selectedTerm)
        : null;

    const submit = async () => {
        if (!walletAddress) {
            onRequireLogin();
            return;
        }

        if (!selectedTerm) {
            toast.error(t('SubscriptionModal.errors.selectTerm'));
            return;
        }

        const amount = Number(principal);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error(t('SubscriptionModal.errors.invalidAmount'));
            return;
        }
        if (principalBandLimit && (amount < principalBandLimit.min || amount > principalBandLimit.max)) {
            toast.error(
                t('SubscriptionModal.errors.outOfBandRange', {
                    band: presetPrincipalBand || '',
                    min: principalBandLimit.min.toLocaleString(),
                    max: principalBandLimit.max.toLocaleString(),
                })
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const walletHeaders = await createWalletAuthHeaders({
                walletAddress,
                method: 'POST',
                pathWithQuery: '/api/managed-subscriptions',
            });

            const res = await fetch('/api/managed-subscriptions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...walletHeaders,
                },
                body: JSON.stringify({
                    walletAddress,
                    productId: product.id,
                    termId: selectedTerm.id,
                    principal: amount,
                    principalBand: presetPrincipalBand,
                    acceptedTerms: true,
                }),
            });

            const data = await res.json() as SubscriptionCreateResponse;
            if (!res.ok) {
                throw new Error(data?.error || t('SubscriptionModal.errors.createFailed'));
            }

            toast.success(t('SubscriptionModal.errors.success'));
            if (data.marketing?.trialApplied) {
                toast.success(t('SubscriptionModal.marketing.trialApplied'));
            }
            if (data.marketing?.referralBonusApplied) {
                toast.success(t('SubscriptionModal.marketing.referralBonusApplied'));
            }
            onSuccess?.(data.subscription.id);
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('SubscriptionModal.errors.failed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-all duration-200">
            <div className={`w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0e1014] shadow-2xl shadow-black/50 ring-1 ring-white/5 flex flex-col max-h-[90vh]`}>
                {/* Header with Theme Gradient */}
                <div className="relative border-b border-white/5 bg-[#121417] p-6">
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.gradient.replace('5', '50')} to-transparent opacity-50`} />
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full ${theme.bg} px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${theme.color}`}>
                                {t('SubscriptionModal.strategyLabel', { strategy: strategyLabel })}
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">
                                {t('SubscriptionModal.title', { name: productName })}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-2 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Configuration Section */}
                    <div className="space-y-8">
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">{t('SubscriptionModal.selectTerm')}</span>
                            <div className="relative">
                                <select
                                    className={`w-full appearance-none rounded-2xl border border-white/10 bg-[#121417] px-4 py-4 text-white transition-all hover:border-white/20 focus:outline-none focus:ring-1 disabled:opacity-50 ${theme.focusBorder} ${theme.focusRing}`}
                                    value={termId}
                                    onChange={(e) => setTermId(e.target.value)}
                                >
                                    {product.terms.map((term) => (
                                        <option key={term.id} value={term.id} className="bg-[#121417]">
                                            {term.durationDays} Days
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </label>

                        <label className="block">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t('SubscriptionModal.investmentAmount')}</span>
                                <span className="text-xs text-zinc-500 font-mono">{t('SubscriptionModal.balance', { amount: '--' })}</span>
                            </div>
                            <div className="relative">
                                <input
                                    className={`w-full rounded-2xl border border-white/10 bg-[#121417] px-4 py-4 text-xl font-bold text-white transition-all hover:border-white/20 focus:outline-none focus:ring-1 placeholder:text-zinc-700 ${theme.focusBorder} ${theme.focusRing}`}
                                    value={principal}
                                    onChange={(e) => setPrincipal(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="0.00"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">
                                    USDC
                                </div>
                            </div>
                            {principalBandLimit && (
                                <p className={`mt-2 text-xs ${isOutOfBandRange ? 'text-rose-400' : 'text-zinc-500'}`}>
                                    {isOutOfBandRange
                                        ? t('SubscriptionModal.bandRangeInvalid', {
                                            band: presetPrincipalBand || '',
                                            min: principalBandLimit.min.toLocaleString(),
                                            max: principalBandLimit.max.toLocaleString(),
                                        })
                                        : t('SubscriptionModal.bandRangeHint', {
                                            band: presetPrincipalBand || '',
                                            min: principalBandLimit.min.toLocaleString(),
                                            max: principalBandLimit.max.toLocaleString(),
                                        })}
                                </p>
                            )}
                        </label>
                    </div>

                    {/* Projections Section */}
                    {selectedTerm && (
                        <div className={`relative overflow-hidden rounded-2xl border ${theme.lightBorder} ${theme.lightBg} p-5`}>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className={`text-sm font-bold ${theme.lightText} flex items-center gap-2`}>
                                    <span className={`h-2 w-2 rounded-full ${theme.dot} animate-pulse`} />
                                    {t('SubscriptionModal.projectedPerformance')}
                                </h4>
                                <div className="flex items-center gap-2">
                                    {managedReturnEstimate?.principalBand ? (
                                        <span className={`rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide ${theme.lightText}`}>
                                            {t('SubscriptionModal.matchedBand', { band: managedReturnEstimate.principalBand })}
                                        </span>
                                    ) : null}
                                    {isEstimatingReturn ? (
                                        <Loader2 className={`h-3.5 w-3.5 animate-spin ${theme.lightText}`} />
                                    ) : null}
                                    <div className={`text-[10px] uppercase tracking-wider font-medium ${theme.lightText} opacity-70`}>
                                        {t('SubscriptionModal.historicalData')}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/5">
                                <div className="bg-[#0e1014]/50 p-4">
                                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{t('SubscriptionModal.targetReturn')}</div>
                                    <div className={`text-lg font-bold ${theme.color}`}>{estimatedRange}</div>
                                    <div className="mt-1 text-[10px] text-zinc-500">
                                        {managedReturnEstimate?.matched
                                            ? t('SubscriptionModal.matrixMatched')
                                            : t('SubscriptionModal.matrixFallback')}
                                    </div>
                                </div>
                                <div className="bg-[#0e1014]/50 p-4">
                                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{t('SubscriptionModal.maxDrawdown')}</div>
                                    <div className="text-lg font-bold text-white">{selectedTerm.maxDrawdown}%</div>
                                </div>
                                {product.isGuaranteed && selectedTerm.minYieldRate !== null && selectedTerm.minYieldRate !== undefined && (
                                    <div className="col-span-2 bg-[#0e1014]/50 p-4 border-t border-white/5">
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{t('SubscriptionModal.guaranteedFloor')}</div>
                                        <div className="text-base font-bold text-white flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                            {(Number(selectedTerm.minYieldRate) * 100).toFixed(2)}% APY
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Legal Section */}
                    <div className="space-y-4 pt-2 border-t border-white/5">
                        <label className="flex items-start gap-4 cursor-pointer group">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    className={`peer h-5 w-5 rounded-md border-white/20 bg-[#121417] checked:bg-current focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 ${theme.color} transition-all`}
                                    checked={riskConfirmed}
                                    onChange={(e) => setRiskConfirmed(e.target.checked)}
                                />
                            </div>
                            <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors leading-relaxed">
                                {t.rich('SubscriptionModal.riskAck', {
                                    strategy: strategyLabel,
                                    highlight: (chunks) => <span className="text-white font-medium">{chunks}</span>
                                })}
                            </span>
                        </label>

                        <label className="flex items-start gap-4 cursor-pointer group">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    className={`peer h-5 w-5 rounded-md border-white/20 bg-[#121417] checked:bg-current focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 ${theme.color} transition-all`}
                                    checked={termsConfirmed}
                                    onChange={(e) => setTermsConfirmed(e.target.checked)}
                                />
                            </div>
                            <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors leading-relaxed">
                                {t('SubscriptionModal.termsAck')}
                            </span>
                        </label>
                    </div>

                    <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-200/80 leading-relaxed">
                            <strong className="text-amber-200 block mb-1">{t('SubscriptionModal.importantNotice')}</strong>
                            {t('SubscriptionModal.noticeContent')}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-white/5 bg-[#121417] p-6">
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-white/10 py-3.5 text-sm font-bold text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
                        >
                            {t('SubscriptionModal.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={!canSubmit}
                            className={`rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:scale-100 ${theme.button}`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('SubscriptionModal.processing')}
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    {t('SubscriptionModal.confirm')}
                                    <ArrowRight className="h-4 w-4" />
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
