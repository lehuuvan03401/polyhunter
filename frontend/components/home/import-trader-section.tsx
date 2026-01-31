"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Shield, Zap, Users } from 'lucide-react';

import { useTranslations } from 'next-intl';

export function ImportTraderSection() {
    const t = useTranslations('ImportTrader');
    const router = useRouter();
    const [address, setAddress] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
        } catch (err) {
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
            </div>
        </section>
    );
}
