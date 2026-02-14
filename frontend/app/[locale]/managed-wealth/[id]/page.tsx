'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { usePrivyLogin } from '@/lib/privy-login';
import { Loader2, ShieldAlert, ShieldCheck, User2 } from 'lucide-react';
import { toast } from 'sonner';
import { DisclosurePolicyPill } from '@/components/managed-wealth/disclosure-policy-pill';
import { ManagedProduct, ManagedTerm, SubscriptionModal } from '@/components/managed-wealth/subscription-modal';

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
};

export default function ManagedWealthDetailPage() {
    const params = useParams<{ id: string }>();
    const { authenticated, login, user } = usePrivyLogin();

    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<ProductDetailResponse | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [presetTermId, setPresetTermId] = useState<string | undefined>();

    useEffect(() => {
        const fetchDetail = async () => {
            if (!params?.id) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/managed-products/${params.id}`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || 'Failed to fetch product detail');
                }
                setDetail(data);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to fetch product');
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [params?.id]);

    const product = detail?.product;

    const avgTarget = useMemo(() => {
        if (!product?.terms?.length) return null;
        const avgMin = product.terms.reduce((acc, term) => acc + term.targetReturnMin, 0) / product.terms.length;
        const avgMax = product.terms.reduce((acc, term) => acc + term.targetReturnMax, 0) / product.terms.length;
        return `${avgMin.toFixed(2)}% - ${avgMax.toFixed(2)}%`;
    }, [product]);

    if (loading) {
        return (
            <div className="container py-10">
                <div className="flex items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="container py-10">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
                    Product not found.
                    <div className="mt-4">
                        <Link href="/managed-wealth" className="text-blue-400 hover:text-blue-300">Back to Managed Wealth</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-10">
            <div className="mb-6">
                <Link href="/managed-wealth" className="text-sm text-muted-foreground hover:text-white">← Back to Marketplace</Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#121417] p-6 lg:col-span-2">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-3xl font-bold text-white">{product.name}</h1>
                            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{product.strategyProfile}</div>
                        </div>
                        <DisclosurePolicyPill policy={product.disclosurePolicy} delayHours={product.disclosureDelayHours} />
                    </div>

                    <p className="mb-6 text-sm text-muted-foreground">{product.description || 'Managed strategy product.'}</p>

                    <div className="mb-6 grid gap-3 sm:grid-cols-3">
                        <Stat label="Avg target range" value={avgTarget || '--'} />
                        <Stat label="Subscriptions" value={`${detail?.stats.subscriptionCount ?? 0}`} />
                        <Stat label="Running" value={`${detail?.stats.runningSubscriptionCount ?? 0}`} />
                    </div>

                    <h2 className="mb-3 text-lg font-semibold text-white">Term Matrix</h2>
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full min-w-[680px] text-sm">
                            <thead className="bg-white/5 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 text-left">Term</th>
                                    <th className="px-3 py-2 text-left">Target Return</th>
                                    <th className="px-3 py-2 text-left">Max Drawdown</th>
                                    <th className="px-3 py-2 text-left">Fee</th>
                                    <th className="px-3 py-2 text-left">Guarantee</th>
                                    <th className="px-3 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {product.terms.map((term) => (
                                    <tr key={term.id} className="border-t border-white/10">
                                        <td className="px-3 py-3">{term.label} ({term.durationDays}d)</td>
                                        <td className="px-3 py-3">{term.targetReturnMin}% - {term.targetReturnMax}%</td>
                                        <td className="px-3 py-3">{term.maxDrawdown}%</td>
                                        <td className="px-3 py-3">{((term.performanceFeeRate ?? product.performanceFeeRate) * 100).toFixed(1)}%</td>
                                        <td className="px-3 py-3">
                                            {product.isGuaranteed ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-300">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                    {(Number(term.minYieldRate ?? 0) * 100).toFixed(2)}% floor
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-orange-300">
                                                    <ShieldAlert className="h-3.5 w-3.5" />
                                                    No guarantee
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!authenticated) {
                                                        login();
                                                        return;
                                                    }
                                                    setPresetTermId(term.id);
                                                    setModalOpen(true);
                                                }}
                                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                                            >
                                                Subscribe
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h2 className="mb-3 mt-7 text-lg font-semibold text-white">Strategy Agents</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {product.agents.map((item) => (
                            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-md bg-white/10 p-2">
                                            <User2 className="h-4 w-4 text-blue-300" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-white">{item.agent.name}</div>
                                            <div className="text-xs text-muted-foreground">{item.agent.traderName || item.agent.traderAddress}</div>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted-foreground">
                                        weight {(item.weight * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#121417] p-6">
                    <h2 className="text-lg font-semibold text-white">Subscribe</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Choose your term and principal with explicit risk confirmation.</p>

                    <button
                        type="button"
                        onClick={() => {
                            if (!authenticated) {
                                login();
                                return;
                            }
                            setPresetTermId(undefined);
                            setModalOpen(true);
                        }}
                        className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
                    >
                        Open Subscription Modal
                    </button>

                    <Link
                        href="/managed-wealth/my"
                        className="mt-3 block w-full rounded-lg border border-white/10 px-4 py-2.5 text-center text-sm text-muted-foreground hover:bg-white/5 hover:text-white"
                    >
                        View My Managed Positions
                    </Link>
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

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-semibold text-white">{value}</div>
        </div>
    );
}
