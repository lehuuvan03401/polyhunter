
import { Shield, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming utils exists, or simple className
import {
    PARTICIPATION_STRATEGIES,
    PARTICIPATION_STRATEGY_LABEL_KEYS,
    type ParticipationStrategyValue,
} from '@/lib/participation-program/rules';
import { MANAGED_STRATEGY_THEMES } from '@/lib/managed-wealth/strategy-theme';

interface StrategySelectorProps {
    value: ParticipationStrategyValue;
    onChange: (value: ParticipationStrategyValue) => void;
    disabled?: boolean;
}

export function StrategySelector({ value, onChange, disabled }: StrategySelectorProps) {
    const strategyIcons: Record<ParticipationStrategyValue, typeof Shield> = {
        CONSERVATIVE: Shield,
        MODERATE: Sparkles,
        AGGRESSIVE: Zap,
    };
    const strategyDescriptions: Record<ParticipationStrategyValue, string> = {
        CONSERVATIVE: 'Low slippage (0.5%) & strict safety.',
        MODERATE: 'Balanced slippage (1%) & speed.',
        AGGRESSIVE: 'High slippage (5%) & max speed.',
    };

    const options = PARTICIPATION_STRATEGIES.map((strategy) => {
        const theme = MANAGED_STRATEGY_THEMES[strategy];
        return {
            id: strategy,
            label: PARTICIPATION_STRATEGY_LABEL_KEYS[strategy],
            icon: strategyIcons[strategy],
            color: theme.color,
            bg: theme.bg,
            border: theme.border.replace('/20', '/30'),
            hover: theme.border.replace('border-', 'hover:border-').replace('/20', '/60'),
            description: strategyDescriptions[strategy],
        };
    });

    return (
        <div className="grid grid-cols-3 gap-3">
            {options.map((option) => {
                const isSelected = value === option.id;
                const Icon = option.icon;

                return (
                    <button
                        key={option.id}
                        onClick={() => onChange(option.id)}
                        disabled={disabled}
                        className={cn(
                            "relative flex flex-col items-center p-3 rounded-lg border transition-all text-center group",
                            option.bg,
                            isSelected
                                ? option.border + " ring-1 ring-offset-0 " + option.border.replace('border', 'ring')
                                : "border-transparent " + option.hover,
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <div className={cn("p-2 rounded-full mb-2 bg-gray-900/40", option.color)}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className={cn("text-xs font-bold mb-1", option.color)}>
                            {option.label}
                        </div>
                        <div className="text-[10px] text-gray-400 leading-tight">
                            {option.description}
                        </div>

                        {isSelected && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current text-white animate-pulse" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
