'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { ArrowLeft, Loader2, ShieldCheck, User2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { DisclosurePolicyPill } from '@/components/managed-wealth/disclosure-policy-pill';
import { ManagedProduct, ManagedTerm, SubscriptionModal } from '@/components/managed-wealth/subscription-modal';
import { ManagedNavChart } from '@/components/managed-wealth/managed-nav-chart';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { lookupManagedReturnMatrixRowByBand } from '@/lib/participation-program/managed-return-matrix';
import type { ManagedReturnMatrixRow, ManagedReturnPrincipalBandValue } from '@/lib/participation-program/rules';

type AgentSummary = {
    id: string;
    isPrimary: boolean;
    weight: number;
    agent: {
        id: string;
        name: string;
        description?: string | null;
        tags: string[];
        traderAddress: string;
        traderName?: string | null;
        avatarUrl?: string | null;
        strategyProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    };
};

type ProductDetailResponse = {
    product: ManagedProduct & {
        terms: ManagedTerm[];
        agents: AgentSummary[];
    };
    stats: {
        subscriptionCount: number;
        runningSubscriptionCount: number;
    };
    chartData: { date: string; value: number }[];
};

export default function ManagedWealthDetailPage() {
    const t = useTranslations('ManagedWealth.ProductDetails');
    const tProducts = useTranslations('ManagedWealth.Products');
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const { authenticated, login, user } = usePrivyLogin();

    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<ProductDetailResponse | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [presetTermId, setPresetTermId] = useState<string | undefined>();
    const [selectedBand, setSelectedBand] = useState<ManagedReturnPrincipalBandValue>('A');
    const [matrixRows, setMatrixRows] = useState<ManagedReturnMatrixRow[]>([]);
    const [matrixLoading, setMatrixLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            if (!params?.id) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/managed-products/${params.id}`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || t('errors.fetchFailed'));
                }
                setDetail(data);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t('errors.fetchGeneral'));
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [params?.id, t]);

    useEffect(() => {
        let cancelled = false;

        async function fetchMatrixRows() {
            setMatrixLoading(true);
            try {
                const res = await fetch('/api/participation/rules', { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || t('errors.fetchFailed'));
                }
                if (cancelled) return;
                setMatrixRows((data?.managedReturnMatrix ?? []) as ManagedReturnMatrixRow[]);
            } catch {
                if (!cancelled) {
                    setMatrixRows([]);
                }
            } finally {
                if (!cancelled) {
                    setMatrixLoading(false);
                }
            }
        }

        fetchMatrixRows();

        return () => {
            cancelled = true;
        };
    }, [t]);

    const product = detail?.product;

    const selectedTerm = useMemo(() => {
        if (!product?.terms?.length) return null;
        return product.terms.find((term) => term.id === presetTermId) ?? product.terms[0] ?? null;
    }, [product, presetTermId]);

    const termProjectionMap = useMemo(() => {
        const map = new Map<string, { displayRange: string | null; principalBand: 'A' | 'B' | 'C' | null; matched: boolean }>();
        if (!product?.terms?.length || matrixRows.length === 0) {
            return map;
        }

        for (const term of product.terms) {
            const matched = lookupManagedReturnMatrixRowByBand(matrixRows, {
                principalBand: selectedBand,
                cycleDays: term.durationDays,
                strategyProfile: product.strategyProfile,
            });
            map.set(term.id, {
                displayRange: matched.displayRange,
                principalBand: matched.principalBand,
                matched: Boolean(matched.row),
            });
        }

        return map;
    }, [matrixRows, product, selectedBand]);

    const selectedTermProjection = selectedTerm ? termProjectionMap.get(selectedTerm.id) : undefined;
    const selectedTermDisplayRange = selectedTermProjection?.displayRange
        ?? (selectedTerm ? `${selectedTerm.targetReturnMin}% - ${selectedTerm.targetReturnMax}%` : null);
    useEffect(() => {
        const bandFromQuery = (searchParams.get('band') || '').toUpperCase();
        if (bandFromQuery === 'A' || bandFromQuery === 'B' || bandFromQuery === 'C') {
            setSelectedBand(bandFromQuery);
        }

        const cycleDaysFromQuery = Number(searchParams.get('cycleDays'));
        if (product?.terms) {
            const preferredByCycle =
                Number.isFinite(cycleDaysFromQuery) && cycleDaysFromQuery > 0
                    ? product.terms.find((t) => t.durationDays === cycleDaysFromQuery)
                    : null;
            if (preferredByCycle) {
                setPresetTermId(preferredByCycle.id);
                return;
            }
            const defaultTerm = product.terms.find((t) => t.durationDays === 30);
            if (defaultTerm) {
                setPresetTermId(defaultTerm.id);
                return;
            }
            setPresetTermId(product.terms[0]?.id);
        }
    }, [product, searchParams]);


    if (loading) {
        return (
            <div className="container py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="container py-20">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
                    <h2 className="text-xl font-semibold text-white">{t('notFound.title')}</h2>
                    <p className="mt-2 text-zinc-400">{t('notFound.desc')}</p>
                    <Link href="/managed-wealth" className="mt-6 inline-block text-blue-400 hover:text-blue-300">
                        &larr; {t('notFound.return')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-10 min-h-screen relative">
            <div className="absolute top-0 left-0 -z-10 h-[400px] w-[400px] bg-purple-500/5 blur-[100px] rounded-full" />
            <div className="absolute bottom-0 right-0 -z-10 h-[400px] w-[400px] bg-blue-500/5 blur-[100px] rounded-full" />

            <div className="mb-8">
                <Link href="/managed-wealth" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    {t('backToMarketplace')}
                </Link>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Left Column: Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Header Card */}
                    <div className="rounded-3xl border border-white/10 bg-[#0A0B0E]/80 backdrop-blur-md p-6 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                <div>
                                    <h1 className="text-3xl font-bold text-white mb-2">
                                        {tProducts(`${product.strategyProfile}.name`)}
                                    </h1>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${product.strategyProfile === 'CONSERVATIVE'
                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                            : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                                            }`}>
                                            {product.strategyProfile}
                                        </div>
                                        <DisclosurePolicyPill policy={product.disclosurePolicy} delayHours={product.disclosureDelayHours} />
                                    </div>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{t('targetApy')}</div>
                                    <div className="text-2xl font-bold text-white">{selectedTermDisplayRange}</div>
                                    <div className="mt-1 text-xs text-zinc-500">
                                        {selectedTermProjection?.matched && selectedTermProjection.principalBand && selectedTerm
                                            ? t('subscribe.targetMeta', {
                                                days: selectedTerm.durationDays,
                                                band: selectedTermProjection.principalBand,
                                            })
                                            : t('subscribe.rangeFallback')}
                                    </div>
                                </div>
                            </div>

                            <p className="text-zinc-400 leading-relaxed max-w-2xl">
                                {tProducts(`${product.strategyProfile}.description`)}
                            </p>

                            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <Stat label={t('stats.subscriptions')} value={`${detail?.stats.subscriptionCount ?? 0}`} />
                                <Stat label={t('stats.active')} value={`${detail?.stats.runningSubscriptionCount ?? 0}`} />
                                <Stat label={t('stats.perfFee')} value={`${(product.performanceFeeRate * 100).toFixed(1)}%`} />
                                <Stat label={t('stats.guarantee')} value={product.isGuaranteed ? t('stats.yes') : t('stats.no')} highlight={product.isGuaranteed} />
                            </div>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="rounded-3xl border border-white/10 bg-[#0A0B0E]/50 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">{t('performance.title')}</h2>
                            <div className="text-xs text-zinc-500">{t('performance.disclaimer')}</div>
                        </div>
                        <div className="h-[240px] w-full">
                            <ManagedNavChart data={detail?.chartData || []} />
                        </div>
                    </div>

                    {/* Agents Section */}
                    <div>
                        <h2 className="text-lg font-semibold text-white mb-4">{t('composition.title')}</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {product.agents.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:border-white/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <User2 className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{item.agent.name}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-[120px]">
                                                {item.agent.traderName || item.agent.traderAddress.slice(0, 8)}...
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-zinc-500">{t('composition.weight')}</div>
                                        <div className="font-mono text-white">{(item.weight * 100).toFixed(0)}%</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Terms & Action */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-[#121417] p-5 shadow-xl">
                            <h2 className="text-lg font-semibold text-white mb-2">{t('subscribe.title')}</h2>
                            <p className="text-sm text-zinc-500 mb-6">{t('subscribe.desc')}</p>
                            <div className="mb-4">
                                <span className="mb-2 block text-xs text-zinc-500">{t('subscribe.bandLabel')}</span>
                                <div className="flex flex-wrap gap-2">
                                    {(['A', 'B', 'C'] as const).map((band) => (
                                        <button
                                            key={band}
                                            type="button"
                                            onClick={() => setSelectedBand(band)}
                                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedBand === band
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                                : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                                                }`}
                                        >
                                            {t(`subscribe.band${band}`)}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2 text-xs text-zinc-500">
                                    {selectedTermProjection?.principalBand
                                        ? t('subscribe.bandMatched', { band: selectedTermProjection.principalBand })
                                        : t('subscribe.rangeFallback')}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {product.terms.map((term) => (
                                    <motion.div
                                        key={term.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`group relative overflow-hidden rounded-xl border p-3 transition-colors cursor-pointer ${presetTermId === term.id
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                                            }`}
                                        onClick={() => {
                                            setPresetTermId(term.id);
                                        }}
                                    >
                                        {(() => {
                                            const projection = termProjectionMap.get(term.id);
                                            const range = projection?.displayRange ?? `${term.targetReturnMin}% - ${term.targetReturnMax}%`;
                                            return (
                                                <>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-bold text-white">{term.label} ({term.durationDays}d)</span>
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                                                            {range}
                                                        </span>
                                                    </div>

                                                    <div className="mb-2 text-[11px] text-zinc-500">
                                                        {matrixLoading
                                                            ? t('subscribe.matrixLoading')
                                                            : projection?.matched
                                                                ? t('subscribe.rangeMatched')
                                                                : t('subscribe.rangeFallback')}
                                                    </div>

                                                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                                                        <span>{t('subscribe.maxDrawdown', { value: term.maxDrawdown })}</span>
                                                        {product.isGuaranteed && (
                                                            <span className="flex items-center gap-1 text-emerald-400">
                                                                <ShieldCheck className="h-3 w-3" />
                                                                {t('subscribe.guaranteed')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}

                                        <div className={`absolute inset-0 border-2 transition-all rounded-xl ${presetTermId === term.id ? 'border-blue-500' : 'border-blue-500/0 group-hover:border-blue-500/50'}`} />
                                    </motion.div>
                                ))}
                            </div>

                            <div className="mt-4 pt-6 border-t border-white/10">
                                <button
                                    onClick={() => {
                                        if (!authenticated) {
                                            login();
                                            return;
                                        }
                                        if (presetTermId) {
                                            setModalOpen(true);
                                        }
                                    }}
                                    disabled={!presetTermId}
                                    className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    {t('subscribe.action')}
                                </button>
                                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
                                    <Info className="h-3.5 w-3.5" />
                                    <span>{t('subscribe.disclaimer')}</span>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>
            </div>

            <SubscriptionModal
                open={modalOpen}
                product={product}
                walletAddress={user?.wallet?.address}
                presetTermId={presetTermId}
                onClose={() => setModalOpen(false)}
                onRequireLogin={login}
            />
        </div>
    );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
            <div className={`mt-1 font-semibold ${highlight ? 'text-emerald-400' : 'text-zinc-200'}`}>
                {value}
            </div>
        </div>
    );
}
