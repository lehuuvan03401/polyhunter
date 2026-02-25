import type { ParticipationStrategyValue } from '@/lib/participation-program/rules';
import { PARTICIPATION_STRATEGY_LABEL_KEYS } from '@/lib/participation-program/rules';

export type ManagedStrategyTheme = {
    color: string;
    bg: string;
    border: string;
    gradient: string;
    button: string;
    focusRing: string;
    focusBorder: string;
    lightText: string;
    lightBg: string;
    lightBorder: string;
    dot: string;
    labelKey: 'Conservative' | 'Moderate' | 'Aggressive';
};

// Keep strategy semantics consistent across managed-wealth cards and modal.
export const MANAGED_STRATEGY_THEMES: Record<ParticipationStrategyValue, ManagedStrategyTheme> = {
    CONSERVATIVE: {
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        gradient: 'from-green-500/5',
        button: 'bg-green-600 hover:bg-green-500 shadow-green-900/20',
        focusRing: 'focus:ring-green-500/50',
        focusBorder: 'focus:border-green-500/50',
        lightText: 'text-green-200',
        lightBg: 'bg-green-500/5',
        lightBorder: 'border-green-500/20',
        dot: 'bg-green-400',
        labelKey: PARTICIPATION_STRATEGY_LABEL_KEYS.CONSERVATIVE,
    },
    MODERATE: {
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        gradient: 'from-blue-500/5',
        button: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20',
        focusRing: 'focus:ring-blue-500/50',
        focusBorder: 'focus:border-blue-500/50',
        lightText: 'text-blue-200',
        lightBg: 'bg-blue-500/5',
        lightBorder: 'border-blue-500/20',
        dot: 'bg-blue-400',
        labelKey: PARTICIPATION_STRATEGY_LABEL_KEYS.MODERATE,
    },
    AGGRESSIVE: {
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        gradient: 'from-purple-500/5',
        button: 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20',
        focusRing: 'focus:ring-purple-500/50',
        focusBorder: 'focus:border-purple-500/50',
        lightText: 'text-purple-200',
        lightBg: 'bg-purple-500/5',
        lightBorder: 'border-purple-500/20',
        dot: 'bg-purple-400',
        labelKey: PARTICIPATION_STRATEGY_LABEL_KEYS.AGGRESSIVE,
    },
};
