'use client';

import { Link } from '@/i18n/routing';
import { motion } from 'framer-motion';
import { ShieldCheck, TrendingUp, Zap, Clock, Percent, ShieldAlert, ArrowRight } from 'lucide-react';
import { DisclosurePolicyPill } from '@/components/managed-wealth/disclosure-policy-pill';
import { ManagedProduct } from '@/components/managed-wealth/subscription-modal';
import { useTranslations } from 'next-intl';

interface ManagedProductCardProps {
    product: ManagedProduct;
    onSubscribe: (product: ManagedProduct) => void;
}

const THEMES = {
    CONSERVATIVE: {
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        gradient: 'from-green-500/5',
        icon: ShieldCheck,
        labelKey: 'Conservative',
        button: 'bg-green-600 hover:bg-green-500 shadow-green-900/20',
    },
    MODERATE: {
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        gradient: 'from-blue-500/5',
        icon: TrendingUp,
        labelKey: 'Moderate',
        button: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20',
    },
    AGGRESSIVE: {
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        gradient: 'from-purple-500/5',
        icon: Zap,
        labelKey: 'Aggressive',
        button: 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20',
    },
};

export function ManagedProductCard({ product, onSubscribe }: ManagedProductCardProps) {
    const t = useTranslations('ManagedWealth.ProductCard');
    const tProducts = useTranslations('ManagedWealth.Products');
    // @ts-ignore
    const theme = THEMES[product.strategyProfile];
    const Icon = theme.icon;

    // Calculate return range
    const minReturn = Math.min(...product.terms.map(t => t.targetReturnMin));
    const maxReturn = Math.max(...product.terms.map(t => t.targetReturnMax));

    // Calculate duration range
    const minDuration = Math.min(...product.terms.map(t => t.durationDays));
    const maxDuration = Math.max(...product.terms.map(t => t.durationDays));
    const durationLabel = minDuration === maxDuration ? `${minDuration}d` : `${minDuration}-${maxDuration}d`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-[#121417] backdrop-blur-sm transition-all hover:border-white/10 hover:shadow-2xl hover:shadow-black/50`}
        >
            {/* Top Border Accent */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.gradient.replace('5', '50')} to-transparent opacity-50`} />

            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-b ${theme.gradient} via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none`} />

            <div className="relative z-10 flex flex-col h-full p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <div className={`inline-flex items-center gap-1.5 rounded-full ${theme.bg} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${theme.color} mb-3`}>
                            <Icon className="h-3 w-3" />
                            {/* @ts-ignore */}
                            {t(`strategies.${theme.labelKey}`)}
                        </div>
                        <h3 className="text-xl font-bold text-white leading-tight group-hover:text-white/90 transition-colors">
                            {/* @ts-ignore */}
                            {tProducts(`${product.strategyProfile}.name`)}
                        </h3>
                    </div>
                </div>

                {/* Hero Metric */}
                <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-bold tracking-tight ${theme.color}`}>
                            {minReturn}% - {maxReturn}%
                        </span>
                        <span className="text-sm font-medium text-zinc-500">{t('targetReturn')}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400 line-clamp-2">
                        {/* @ts-ignore */}
                        {tProducts(`${product.strategyProfile}.description`)}
                    </p>
                </div>

                {/* Key Specs Grid */}
                <div className="grid grid-cols-3 gap-2 mb-8 mt-auto">
                    <div className="rounded-2xl bg-white/[0.03] p-3 text-center transition-colors group-hover:bg-white/[0.05]">
                        <Clock className="mx-auto mb-2 h-4 w-4 text-zinc-500" />
                        <div className="text-xs font-medium text-zinc-300">{durationLabel}</div>
                        <div className="text-[10px] text-zinc-600">{t('lockup')}</div>
                    </div>

                    <div className="rounded-2xl bg-white/[0.03] p-3 text-center transition-colors group-hover:bg-white/[0.05]">
                        {product.isGuaranteed ? (
                            <ShieldCheck className="mx-auto mb-2 h-4 w-4 text-emerald-500" />
                        ) : (
                            <ShieldAlert className="mx-auto mb-2 h-4 w-4 text-zinc-500" />
                        )}
                        <div className={`text-xs font-medium ${product.isGuaranteed ? 'text-emerald-400' : 'text-zinc-300'}`}>
                            {product.isGuaranteed ? t('guaranteed') : t('standard')}
                        </div>
                        <div className="text-[10px] text-zinc-600">{t('protection')}</div>
                    </div>

                    <div className="rounded-2xl bg-white/[0.03] p-3 text-center transition-colors group-hover:bg-white/[0.05]">
                        <Percent className="mx-auto mb-2 h-4 w-4 text-zinc-500" />
                        <div className="text-xs font-medium text-zinc-300">{(product.performanceFeeRate * 100).toFixed(0)}%</div>
                        <div className="text-[10px] text-zinc-600">{t('perfFee')}</div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => onSubscribe(product)}
                        className={`w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] ${theme.button} shadow-lg`}
                    >
                        {t('subscribe')}
                    </button>

                    <Link
                        href={`/managed-wealth/${product.slug}`}
                        className="group/link flex w-full items-center justify-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-white"
                    >
                        {t('viewDetails')}
                        <ArrowRight className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5" />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
