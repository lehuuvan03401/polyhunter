'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { BarChart3, Loader2, Lock, ShieldCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { ManagedProduct } from '@/components/managed-wealth/subscription-modal';
import { ManagedProductCard } from '@/components/managed-wealth/managed-product-card';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
    PARTICIPATION_STRATEGIES,
    type ManagedReturnPrincipalBandValue,
    type ManagedReturnMatrixRow,
} from '@/lib/participation-program/rules';
import { ManagedExternalRulesSection } from '@/components/participation/managed-external-rules-section';
import { lookupManagedReturnMatrixRowByBand } from '@/lib/participation-program/managed-return-matrix';

const MATRIX_CYCLE_OPTIONS = [7, 30, 90, 180, 360] as const;
type MatrixCycleOption = (typeof MATRIX_CYCLE_OPTIONS)[number];
const BAND_OPTIONS: Array<{
    id: ManagedReturnPrincipalBandValue;
    maxUsdt: number;
}> = [
        { id: 'A', maxUsdt: 5000 },
        { id: 'B', maxUsdt: 50000 },
        { id: 'C', maxUsdt: 300000 },
    ];

type MatrixProjectionByStrategy = Record<
    (typeof PARTICIPATION_STRATEGIES)[number],
    {
        principalBand: ManagedReturnPrincipalBandValue;
        matched: boolean;
        displayRange: string | null;
    }
>;

export default function ManagedWealthPage() {
    const t = useTranslations('ManagedWealth.Marketplace');
    const router = useRouter();
    const { authenticated, ready, login, isLoggingIn } = usePrivyLogin();

    const [products, setProducts] = useState<ManagedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBand, setSelectedBand] = useState<ManagedReturnPrincipalBandValue>('A');
    const [projectionCycleDays, setProjectionCycleDays] = useState<MatrixCycleOption>(30);
    const [matrixRows, setMatrixRows] = useState<ManagedReturnMatrixRow[]>([]);
    const [matrixLoading, setMatrixLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.set('active', 'true');
                const res = await fetch(`/api/managed-products?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || t('errors.fetchFailed'));
                }
                setProducts(data.products || []);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t('errors.fetchFailed'));
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [t]);

    useEffect(() => {
        let cancelled = false;

        async function fetchMatrix() {
            setMatrixLoading(true);
            try {
                const res = await fetch('/api/participation/rules', { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || 'Failed to fetch managed return matrix');
                }
                if (cancelled) return;
                setMatrixRows((data?.managedReturnMatrix ?? []) as ManagedReturnMatrixRow[]);
            } catch (error) {
                if (!cancelled) {
                    toast.error(error instanceof Error ? error.message : t('errors.fetchFailed'));
                    setMatrixRows([]);
                }
            } finally {
                if (!cancelled) {
                    setMatrixLoading(false);
                }
            }
        }

        fetchMatrix();

        return () => {
            cancelled = true;
        };
    }, [t]);

    const strategyProducts = useMemo(() => {
        const byStrategy = new Map<string, ManagedProduct>();
        for (const product of products) {
            if (!byStrategy.has(product.strategyProfile)) {
                byStrategy.set(product.strategyProfile, product);
            }
        }
        return PARTICIPATION_STRATEGIES
            .map((strategy) => byStrategy.get(strategy))
            .filter(Boolean) as ManagedProduct[];
    }, [products]);

    const matrixProjectionByStrategy = useMemo<MatrixProjectionByStrategy>(() => {
        const initial: MatrixProjectionByStrategy = {
            CONSERVATIVE: { principalBand: selectedBand, matched: false, displayRange: null },
            MODERATE: { principalBand: selectedBand, matched: false, displayRange: null },
            AGGRESSIVE: { principalBand: selectedBand, matched: false, displayRange: null },
        };

        if (matrixRows.length === 0) {
            return initial;
        }

        for (const strategy of PARTICIPATION_STRATEGIES) {
            const matched = lookupManagedReturnMatrixRowByBand(matrixRows, {
                principalBand: selectedBand,
                cycleDays: projectionCycleDays,
                strategyProfile: strategy,
            });
            initial[strategy] = {
                principalBand: selectedBand,
                matched: Boolean(matched.row),
                displayRange: matched.displayRange,
            };
        }

        return initial;
    }, [matrixRows, projectionCycleDays, selectedBand]);

    const openSubscribe = (product: ManagedProduct) => {
        router.push(`/managed-wealth/${product.slug}?band=${selectedBand}&cycleDays=${projectionCycleDays}`);
    };

    if (!ready || loading) {
        return (
            <div className="container py-20">
                <div className="flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                    <p className="text-sm text-zinc-500 animate-pulse">{t('loading')}</p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="container py-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

                <div className="relative mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#0A0B0E]/80 p-12 text-center backdrop-blur-xl shadow-2xl">
                    <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                        <Lock className="h-10 w-10 text-blue-400" />
                    </div>

                    <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                        {t('landing.title')}
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
                        {t('landing.subtitle')}
                    </p>

                    <div className="mt-12 grid gap-6 md:grid-cols-3">
                        <FeatureCard
                            icon={<ShieldCheck className="h-6 w-6 text-emerald-400" />}
                            title={t('landing.features.protection.title')}
                            desc={t('landing.features.protection.desc')}
                        />
                        <FeatureCard
                            icon={<TrendingUp className="h-6 w-6 text-blue-400" />}
                            title={t('landing.features.terms.title')}
                            desc={t('landing.features.terms.desc')}
                        />
                        <FeatureCard
                            icon={<BarChart3 className="h-6 w-6 text-purple-400" />}
                            title={t('landing.features.nav.title')}
                            desc={t('landing.features.nav.desc')}
                        />
                    </div>

                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        className="mt-12 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-60 disabled:hover:shadow-none"
                    >
                        {isLoggingIn ? (
                            <>
                                {t('landing.connecting')}
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </>
                        ) : (
                            t('landing.connectWallet')
                        )}
                    </button>

                    <div className="mt-6 text-xs text-zinc-500">
                        {t('landing.terms')}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container min-h-screen py-10 relative">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] bg-blue-500/5 blur-[100px] rounded-full" />

            <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">{t('title')}</h1>
                    <p className="mt-2 text-zinc-400">{t('subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/managed-wealth/my"
                        className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white hover:border-white/20"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {t('myDashboard')}
                    </Link>
                </div>
            </div>

            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {BAND_OPTIONS.map((band) => (
                        <button
                            key={band.id}
                            type="button"
                            onClick={() => setSelectedBand(band.id)}
                            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${selectedBand === band.id
                                ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]'
                                : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                                }`}
                        >
                            {t('matrix.bandTab', { band: band.id, maxUsdt: band.maxUsdt.toLocaleString() })}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-white">{t('matrix.title')}</p>
                        <p className="text-xs text-zinc-400">{t('matrix.subtitle')}</p>
                    </div>
                    {matrixLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                    ) : null}
                </div>
                <div>
                    <span className="mb-2 block text-xs text-zinc-500">{t('matrix.cycleLabel')}</span>
                    <div className="flex flex-wrap gap-2">
                        {MATRIX_CYCLE_OPTIONS.map((cycle) => (
                            <button
                                key={cycle}
                                type="button"
                                onClick={() => setProjectionCycleDays(cycle)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${projectionCycleDays === cycle
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                    : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                                    }`}
                            >
                                {t('matrix.cycleValue', { days: cycle })}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-3 text-xs text-zinc-400">
                    {t('matrix.context', {
                        band: selectedBand,
                        days: projectionCycleDays,
                    })}
                </div>
            </div>

            <motion.div
                layout
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
                <AnimatePresence mode="popLayout">
                    {strategyProducts.map((product) => (
                        <ManagedProductCard
                            key={product.id}
                            product={product}
                            matrixProjection={{
                                loading: matrixLoading,
                                cycleDays: projectionCycleDays,
                                principalBand: selectedBand,
                                matched: matrixProjectionByStrategy[product.strategyProfile].matched,
                                displayRange: matrixProjectionByStrategy[product.strategyProfile].displayRange,
                            }}
                            onSubscribe={openSubscribe}
                        />
                    ))}
                </AnimatePresence>
            </motion.div>

            {strategyProducts.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-20 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center"
                >
                    <div className="mb-4 rounded-full bg-white/5 p-4">
                        <BarChart3 className="h-8 w-8 text-zinc-600" />
                    </div>
                    <h3 className="text-lg font-medium text-white">{t('empty.title')}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{t('empty.desc')}</p>
                </motion.div>
            )}

            <ManagedExternalRulesSection className="mt-12" />
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/[0.07]">
            <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-[#0A0B0E] p-3 shadow-sm group-hover:scale-110 transition duration-300">{icon}</div>
            <div className="text-lg font-semibold text-white">{title}</div>
            <div className="mt-2 text-sm text-zinc-400 leading-relaxed">{desc}</div>
        </div>
    );
}
