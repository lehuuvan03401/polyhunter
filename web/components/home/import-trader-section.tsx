"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Zap, Users } from 'lucide-react';
import Link from 'next/link';

import { useTranslations } from 'next-intl';

type RecommendedTrader = {
    address: string;
    name: string | null;
    pnl: number;
    score: number;
    rank: number;
    reasonCodes?: Array<
        'high_score' |
        'low_drawdown' |
        'high_profit_factor' |
        'copy_friendly' |
        'high_activity' |
        'strong_recent_pnl'
    >;
    reasonSummary?: string;
};

export function ImportTraderSection() {
    const t = useTranslations('ImportTrader');
    const router = useRouter();
    const [address, setAddress] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [recommended, setRecommended] = useState<RecommendedTrader[]>([]);
    const [isRecommendedLoading, setIsRecommendedLoading] = useState(true);

    useEffect(() => {
        const loadRecommended = async () => {
            try {
                const response = await fetch('/api/traders/top?limit=5');
                if (!response.ok) throw new Error('Failed to fetch top traders');
                const data = await response.json();
                setRecommended(data.traders || []);
            } catch (fetchError) {
                console.error('[ImportTraderSection] Failed to load recommended traders', fetchError);
                setRecommended([]);
            } finally {
                setIsRecommendedLoading(false);
            }
        };

        loadRecommended();
    }, []);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const trimmedAddress = address.trim();

        // Basic validation
        if (!trimmedAddress) {
            setError(t('errorEmpty'));
            return;
        }

        if (!trimmedAddress.startsWith('0x') || trimmedAddress.length !== 42) {
            setError(t('errorInvalid'));
            return;
        }

        setIsLoading(true);

        // Simulate a small delay for better UX (optional, but feels nicer)
        // Then navigate
        try {
            router.push(`/traders/${trimmedAddress}`);
        } catch {
            setError(t('errorNavigate'));
            setIsLoading(false);
        }
    };

    return (
        <section className="py-16 px-4">
            <div className="container max-w-4xl mx-auto text-center">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                    {t('title')}
                </h2>
                <p className="text-xl text-muted-foreground mb-8">
                    {t('subtitle')}
                </p>

                <div className="max-w-xl mx-auto mb-8">
                    <form onSubmit={handleImport} className="relative flex items-center">
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder={t('placeholder')}
                            className="w-full h-14 pl-5 pr-36 bg-white/5 border border-white/10 rounded-lg text-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-muted-foreground/50"
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="absolute right-1 top-1 bottom-1 px-6 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? t('loading') : t('button')}
                        </button>
                    </form>
                    {error && (
                        <div className="text-red-500 text-sm mt-2 text-left pl-1">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap justify-center gap-8 text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-green-500" />
                        <span>{t('features.nonCustodial')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        <span>{t('features.gasSponsored')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        <span>{t('features.tradersTracked')}</span>
                    </div>
                </div>

                <div className="mt-10 text-left">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-foreground">{t('recommended.title')}</h3>
                        <Link href="/smart-money" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            {t('recommended.viewAll')}
                        </Link>
                    </div>

                    {isRecommendedLoading ? (
                        <div className="text-sm text-muted-foreground">{t('recommended.loading')}</div>
                    ) : recommended.length === 0 ? (
                        <div className="text-sm text-muted-foreground">{t('recommended.empty')}</div>
                    ) : (
                        <div className="grid gap-2">
                            {recommended.map((trader) => (
                                <Link
                                    key={trader.address}
                                    href={`/traders/${trader.address}`}
                                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <div className="text-xs text-muted-foreground mb-0.5">#{trader.rank}</div>
                                        <div className="text-sm font-medium text-foreground truncate">
                                            {trader.name || `${trader.address.slice(0, 6)}...${trader.address.slice(-4)}`}
                                        </div>
                                        {trader.reasonCodes && trader.reasonCodes.length > 0 ? (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                {trader.reasonCodes.slice(0, 2).map((reason) => (
                                                    <span
                                                        key={`${trader.address}-${reason}`}
                                                        className="text-[10px] leading-4 px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20"
                                                    >
                                                        {t(`recommended.reasons.${reason}`)}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="text-right ml-3">
                                        <div className="text-xs text-muted-foreground">{t('recommended.score')}</div>
                                        <div className="text-sm font-semibold text-green-400">{trader.score}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
