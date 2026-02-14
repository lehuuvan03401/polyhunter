'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { BarChart3, Loader2, Lock, ShieldCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { DisclosurePolicyPill } from '@/components/managed-wealth/disclosure-policy-pill';
import { ManagedProduct, SubscriptionModal } from '@/components/managed-wealth/subscription-modal';

export default function ManagedWealthPage() {
    const { authenticated, ready, login, user, isLoggingIn } = usePrivyLogin();

    const [products, setProducts] = useState<ManagedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [strategyFilter, setStrategyFilter] = useState<'ALL' | 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'>('ALL');
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
                    throw new Error(data?.error || 'Failed to fetch products');
                }
                setProducts(data.products || []);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to fetch managed products');
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
            <div className="container py-10">
                <div className="flex items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="container py-10">
                <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-card/50 p-10 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10">
                        <Lock className="h-10 w-10 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold">Managed Wealth</h1>
                    <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                        Choose a strategy product, lock your term, and let the platform execute with transparent NAV and risk reporting.
                    </p>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        <FeatureCard icon={<ShieldCheck className="h-5 w-5 text-emerald-300" />} title="Conservative Guarantee" desc="Principal/minimum-yield support on conservative products." />
                        <FeatureCard icon={<TrendingUp className="h-5 w-5 text-blue-300" />} title="Term Flexibility" desc="1/3/7/15/30/60/90/180/365 day products." />
                        <FeatureCard icon={<BarChart3 className="h-5 w-5 text-purple-300" />} title="Transparent Tracking" desc="Default real-time visibility for NAV, drawdown, and fills." />
                    </div>

                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                        {isLoggingIn ? (
                            <>
                                Connecting...
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </>
                        ) : (
                            'Connect wallet to continue'
                        )}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-10">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Managed Wealth</h1>
                    <p className="mt-2 text-muted-foreground">Productized strategy investing for non-professional users.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/managed-wealth/my" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-white">
                        My Managed Positions
                    </Link>
                    <span className="rounded-lg bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                        {stats.total} products · {stats.guaranteed} guaranteed
                    </span>
                </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-2">
                {(['ALL', 'CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] as const).map((strategy) => (
                    <button
                        key={strategy}
                        type="button"
                        onClick={() => setStrategyFilter(strategy)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${strategyFilter === strategy
                                ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                                : 'border-white/10 bg-white/5 text-muted-foreground hover:text-white'
                            }`}
                    >
                        {strategy === 'ALL' ? 'All' : strategy}
                    </button>
                ))}

                <button
                    type="button"
                    onClick={() => setGuaranteedOnly((prev) => !prev)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${guaranteedOnly
                            ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-muted-foreground hover:text-white'
                        }`}
                >
                    Guaranteed only
                </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                    <div key={product.id} className="rounded-2xl border border-white/10 bg-[#121417] p-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-white">{product.name}</h2>
                                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{product.strategyProfile}</p>
                            </div>
                            <DisclosurePolicyPill policy={product.disclosurePolicy} delayHours={product.disclosureDelayHours} />
                        </div>

                        <p className="mb-4 line-clamp-2 min-h-[40px] text-sm text-muted-foreground">{product.description || 'Managed strategy product'}</p>

                        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                                <div className="text-muted-foreground">Performance Fee</div>
                                <div className="font-semibold text-white">{(product.performanceFeeRate * 100).toFixed(1)}%</div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                                <div className="text-muted-foreground">Guarantee</div>
                                <div className="font-semibold text-white">{product.isGuaranteed ? 'Enabled' : 'No guarantee'}</div>
                            </div>
                        </div>

                        <div className="mb-5 flex flex-wrap gap-1.5">
                            {product.terms.slice(0, 5).map((term) => (
                                <span key={term.id} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted-foreground">
                                    {term.durationDays}d {term.targetReturnMin}% - {term.targetReturnMax}%
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Link href={`/managed-wealth/${product.slug}`} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-sm text-muted-foreground hover:bg-white/5 hover:text-white">
                                Details
                            </Link>
                            <button
                                type="button"
                                onClick={() => openSubscribe(product)}
                                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                            >
                                Subscribe
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {products.length === 0 && (
                <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
                    No products matched current filters.
                </div>
            )}

            <SubscriptionModal
                open={modalOpen}
                product={modalProduct}
                walletAddress={user?.wallet?.address}
                onClose={() => setModalOpen(false)}
                onRequireLogin={login}
                onSuccess={() => {
                    setModalOpen(false);
                    toast.success('You can track this position in My Managed Positions.');
                }}
            />
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left">
            <div className="mb-2 inline-flex rounded-lg border border-white/10 bg-black/20 p-2">{icon}</div>
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
        </div>
    );
}
