'use client';

import * as React from 'react';
import { Copy, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export interface AgentTemplate {
    id: string;
    name: string;
    description: string | null;
    tags: string[];
    traderAddress: string;
    traderName: string | null;
    avatarUrl: string | null;
    strategyProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    isActive: boolean;
    // Settings
    mode: 'PERCENTAGE' | 'FIXED_AMOUNT';
    sizeScale?: number | null;
    fixedAmount?: number | null;
    maxSizePerTrade: number;
    minSizePerTrade?: number | null;
    stopLoss?: number | null;
    takeProfit?: number | null;
    maxOdds?: number | null;
    minLiquidity?: number | null;
    minVolume?: number | null;
}

interface AgentCardProps {
    agent: AgentTemplate;
    onCopy: (agent: AgentTemplate) => void;
}

export function AgentCard({ agent, onCopy }: AgentCardProps) {
    const t = useTranslations('Agents');

    // Determine color scheme based on strategy
    const getColorScheme = (profile: string) => {
        switch (profile) {
            case 'CONSERVATIVE':
                return {
                    bg: 'bg-green-500/10',
                    border: 'border-green-500/20',
                    text: 'text-green-500',
                    icon: ShieldCheck,
                    gradient: 'from-green-500/20 to-transparent'
                };
            case 'AGGRESSIVE':
                return {
                    bg: 'bg-orange-500/10',
                    border: 'border-orange-500/20',
                    text: 'text-orange-500',
                    icon: Zap,
                    gradient: 'from-orange-500/20 to-transparent'
                };
            default:
                return {
                    bg: 'bg-blue-500/10',
                    border: 'border-blue-500/20',
                    text: 'text-blue-500',
                    icon: TrendingUp,
                    gradient: 'from-blue-500/20 to-transparent'
                };
        }
    };

    const scheme = getColorScheme(agent.strategyProfile);
    const Icon = scheme.icon;

    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl border bg-[#1a1b1e] p-5 transition-all hover:scale-[1.02] hover:shadow-xl group cursor-pointer",
            scheme.border
        )}
            onClick={() => onCopy(agent)}
        >
            {/* Background Gradient */}
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
                scheme.gradient
            )} />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center p-2 shadow-inner",
                            scheme.bg
                        )}>
                            <img
                                src={agent.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.name}`}
                                alt={agent.name}
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg leading-tight">{agent.name}</h3>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <Icon className={cn("h-3 w-3", scheme.text)} />
                                <span className={scheme.text}>{agent.strategyProfile}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
                    {agent.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                    {agent.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 rounded-md bg-[#2c2d33] text-[10px] font-medium text-white border border-white/5">
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Action Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onCopy(agent);
                    }}
                    className={cn(
                        "w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg",
                        agent.strategyProfile === 'AGGRESSIVE' ? "bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/20" :
                            agent.strategyProfile === 'CONSERVATIVE' ? "bg-green-600 hover:bg-green-500 text-white shadow-green-500/20" :
                                "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
                    )}
                >
                    <Copy className="h-4 w-4" />
                    Copy Agent
                </button>
            </div>
        </div>
    );
}
