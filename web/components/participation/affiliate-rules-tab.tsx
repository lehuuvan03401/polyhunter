'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    ChevronDown,
    ChevronUp,
    Crown,
    Gem,
    HelpCircle,
    Star,
    Sun,
    TrendingUp,
    Trophy,
    Users,
    Zap,
    ShieldCheck,
    Flame,
    Diamond
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AffiliateExternalRulesSection } from './affiliate-external-rules-section';
import { PARTICIPATION_LEVEL_RULES, type ParticipationLevel } from '@/lib/participation-program/levels';
import { SAME_LEVEL_BONUS_RATES } from '@/lib/participation-program/bonuses';

const LEVEL_UI_CONFIG: Record<ParticipationLevel, any> = {
    NONE: { icon: Users, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' },
    V1: { icon: Star, color: 'text-blue-300', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
    V2: { icon: Star, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    V3: { icon: ShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
    V4: { icon: Trophy, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    V5: { icon: Trophy, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30' },
    V6: { icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    V7: { icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    V8: { icon: Gem, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    V9: { icon: Diamond, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
};

function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-white/10 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
            >
                <span className="font-medium text-white">{question}</span>
                {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </button>
            {isOpen && (
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                    {answer}
                </div>
            )}
        </div>
    );
}

type AffiliateRulesTabProps = {
    currentLevel?: ParticipationLevel;
    className?: string;
};

export function AffiliateRulesTab({ currentLevel = 'NONE', className }: AffiliateRulesTabProps) {
    const t = useTranslations('AffiliateRules');
    const sortedLevels = [...PARTICIPATION_LEVEL_RULES].sort((a, b) => a.minNetDepositUsd - b.minNetDepositUsd);

    const sameLevelRows = Object.entries(SAME_LEVEL_BONUS_RATES)
        .map(([generation, rate]) => ({
            generation: Number(generation),
            rate,
        }))
        .sort((a, b) => a.generation - b.generation);

    return (
        <div className={cn('space-y-10', className)}>
            {/* Section 0: External Partner Rules */}
            <AffiliateExternalRulesSection />

            {/* Section 1: Tier System Overview */}
            <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t('tierSystem.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('tierSystem.subtitle')}</p>
                    </div>
                </div>

                {/* Tier Progress Bar */}
                <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2 scrollbar-none">
                    {sortedLevels.map((rule, idx) => {
                        const levelConfig = LEVEL_UI_CONFIG[rule.level];
                        const IconComponent = levelConfig.icon;
                        const isCurrent = rule.level === currentLevel;
                        const isPast = sortedLevels.findIndex(r => r.level === currentLevel) > idx;

                        return (
                            <div key={rule.level} className="flex flex-shrink-0 items-center">
                                <div className={cn(
                                    "flex flex-col items-center gap-2 px-3 py-2 rounded-xl transition-all",
                                    isCurrent ? `${levelConfig.bg} ${levelConfig.border} border-2` : "opacity-60",
                                    isPast && "opacity-90"
                                )}>
                                    <div className={cn(
                                        "h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center",
                                        isPast || isCurrent ? levelConfig.bg : "bg-white/5"
                                    )}>
                                        <IconComponent className={cn("h-5 w-5 md:h-6 md:w-6", levelConfig.color)} />
                                    </div>
                                    <span className={cn("text-xs font-bold whitespace-nowrap", levelConfig.color)}>
                                        {rule.level}
                                    </span>
                                    {isCurrent && (
                                        <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                                            {t('tierSystem.yourRank')}
                                        </span>
                                    )}
                                </div>
                                {idx < sortedLevels.length - 1 && (
                                    <div className={cn(
                                        "w-6 md:w-8 h-0.5 mx-1",
                                        isPast ? "bg-green-500" : "bg-white/10"
                                    )} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Tier Comparison Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10 text-muted-foreground">
                                <th className="text-left py-3 px-4 font-medium">{t('tierSystem.table.tier')}</th>
                                <th className="text-center py-3 px-4 font-medium">{t('tierSystem.table.threshold')}</th>
                                <th className="text-center py-3 px-4 font-medium text-yellow-400">{t('tierSystem.table.dividendRate')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLevels.map((rule) => {
                                const levelConfig = LEVEL_UI_CONFIG[rule.level];
                                const isCurrent = rule.level === currentLevel;
                                const IconComponent = levelConfig.icon;

                                return (
                                    <tr
                                        key={rule.level}
                                        className={cn(
                                            "border-b border-white/5 transition-colors",
                                            isCurrent && "bg-white/5"
                                        )}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <IconComponent className={cn("h-4 w-4", levelConfig.color)} />
                                                <span className={cn("font-bold text-base", levelConfig.color)}>{rule.level}</span>
                                                {isCurrent && <span className="text-[10px] text-green-400">★</span>}
                                            </div>
                                        </td>
                                        <td className="text-center py-3 px-4 font-mono font-medium">
                                            {rule.minNetDepositUsd >= 1_000_000
                                                ? `${(rule.minNetDepositUsd / 1_000_000).toFixed(rule.minNetDepositUsd % 1_000_000 === 0 ? 0 : 1)} M USD`
                                                : `${(rule.minNetDepositUsd / 1_000).toFixed(0)} K USD`
                                            }
                                        </td>
                                        <td className="text-center py-3 px-4 font-mono font-semibold text-yellow-400">
                                            {(rule.dividendRate * 100).toFixed(0)}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Section 2: Same-Level Bonus (was Zero Line) */}
            <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t('sameLevel.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('sameLevel.subtitle')}</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground mb-4">
                            {t('sameLevel.explanation')}
                        </p>
                        {sameLevelRows.map((item) => (
                            <div
                                key={item.generation}
                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 font-bold text-sm">
                                        G{item.generation}
                                    </div>
                                    <span className="text-sm">{t(`sameLevel.generations.${item.generation}`)}</span>
                                </div>
                                <span className="text-green-400 font-mono font-bold">{(item.rate * 100).toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gradient-to-br from-green-500/5 to-green-500/0 border border-green-500/20 rounded-xl p-5">
                        <h3 className="font-semibold text-green-400 mb-4 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {t('sameLevel.example.title')}
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('sameLevel.example.dividend')}</span>
                                <span className="font-mono">$1,000</span>
                            </div>
                            <div className="h-px bg-white/10 my-2" />
                            <div className="flex justify-between text-green-400">
                                <span>{t('sameLevel.example.gen1')}</span>
                                <span className="font-mono font-bold">$200</span>
                            </div>
                            <div className="flex justify-between text-green-400/70">
                                <span>{t('sameLevel.example.gen2')}</span>
                                <span className="font-mono">$100</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 3: Team Dividend Differential (was Sun Line) */}
            <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <Sun className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t('teamDividend.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('teamDividend.subtitle')}</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t.raw('teamDividend.explanation') }} />

                        <div className="bg-white/5 rounded-lg p-4 space-y-2">
                            <div className="text-sm font-medium text-yellow-400">{t('teamDividend.formulaLabel')}</div>
                            <code className="block bg-black/50 rounded px-3 py-2 text-sm font-mono leading-relaxed">
                                {t('teamDividend.formula')}
                            </code>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-500/5 to-yellow-500/0 border border-yellow-500/20 rounded-xl p-5">
                        <h3 className="font-semibold text-yellow-400 mb-4">{t('teamDividend.example.title')}</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-purple-400" />
                                <span dangerouslySetInnerHTML={{ __html: t.raw('teamDividend.example.you') }} />
                            </div>
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-blue-400" />
                                <span dangerouslySetInnerHTML={{ __html: t.raw('teamDividend.example.downline') }} />
                            </div>
                            <div className="h-px bg-white/10 my-3" />
                            <div className="flex justify-between text-muted-foreground">
                                <span>{t('teamDividend.example.profitSystemFee')}</span>
                                <span className="font-mono">$1,000</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>{t('teamDividend.example.diff')}</span>
                                <span className="font-mono">45% - 40% = 5%</span>
                            </div>
                            <div className="flex justify-between text-yellow-400 font-semibold mt-2 pt-2 border-t border-yellow-500/20">
                                <span>{t('teamDividend.example.bonus')}</span>
                                <span className="font-mono text-lg">$50.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 4: FAQ */}
            <section className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <HelpCircle className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t('faq.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('faq.subtitle')}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <FAQItem
                            key={i}
                            question={t(`faq.q${i}`)}
                            answer={t(`faq.a${i}`)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}
