'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { BarChart3, Loader2, Lock, ShieldCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { ManagedProduct, SubscriptionModal } from '@/components/managed-wealth/subscription-modal';
import { ManagedProductCard } from '@/components/managed-wealth/managed-product-card';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { PARTICIPATION_STRATEGIES } from '@/lib/participation-program/rules';

const STRATEGY_FILTERS = ['ALL', ...PARTICIPATION_STRATEGIES] as const;
type StrategyFilter = (typeof STRATEGY_FILTERS)[number];

export default function ManagedWealthPage() {
    const t = useTranslations('ManagedWealth.Marketplace');
    const { authenticated, ready, login, user, isLoggingIn } = usePrivyLogin();

    const [products, setProducts] = useState<ManagedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>('ALL');
    const [guaranteedOnly, setGuaranteedOnly] = useState(false);

    const [modalProduct, setModalProduct] = useState<ManagedProduct | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.set('active', 'true');
                if (strategyFilter !== 'ALL') params.set('strategy', strategyFilter);
                if (guaranteedOnly) params.set('guaranteed', 'true');

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
    }, [strategyFilter, guaranteedOnly]);

    const stats = useMemo(() => {
        const guaranteed = products.filter((p) => p.isGuaranteed).length;
        return {
            total: products.length,
            guaranteed,
        };
    }, [products]);

    const openSubscribe = (product: ManagedProduct) => {
        if (!authenticated) {
            login();
            return;
        }
        setModalProduct(product);
        setModalOpen(true);
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
                    {STRATEGY_FILTERS.map((strategy) => (
                        <button
                            key={strategy}
                            type="button"
                            onClick={() => setStrategyFilter(strategy)}
                            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${strategyFilter === strategy
                                ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]'
                                : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                                }`}
                        >
                            {/* @ts-ignore */}
                            {t(`filters.strategies.${strategy}`)}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => setGuaranteedOnly((prev) => !prev)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${guaranteedOnly
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                        }`}
                >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t('filters.guaranteedOnly')}
                </button>
            </div>

            <motion.div
                layout
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
                <AnimatePresence mode="popLayout">
                    {products.map((product) => (
                        <ManagedProductCard
                            key={product.id}
                            product={product}
                            onSubscribe={openSubscribe}
                        />
                    ))}
                </AnimatePresence>
            </motion.div>

            {products.length === 0 && (
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
                    <button
                        onClick={() => {
                            setStrategyFilter('ALL');
                            setGuaranteedOnly(false);
                        }}
                        className="mt-6 text-xs text-blue-400 hover:text-blue-300"
                    >
                        {t('filters.clear')}
                    </button>
                </motion.div>
            )}

            <SubscriptionModal
                open={modalOpen}
                product={modalProduct}
                walletAddress={user?.wallet?.address}
                onClose={() => setModalOpen(false)}
                onRequireLogin={login}
                onSuccess={() => {
                    setModalOpen(false);
                }}
            />
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
