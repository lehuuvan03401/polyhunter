
import { Shield, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming utils exists, or simple className

interface StrategySelectorProps {
    value: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    onChange: (value: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE') => void;
    disabled?: boolean;
}

export function StrategySelector({ value, onChange, disabled }: StrategySelectorProps) {

    const options = [
        {
            id: 'CONSERVATIVE',
            label: 'Conservative',
            icon: Shield,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/30',
            hover: 'hover:border-green-500/60',
            description: 'Low slippage (0.5%) & strict safety.'
        },
        {
            id: 'MODERATE',
            label: 'Moderate',
            icon: Sparkles,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/30',
            hover: 'hover:border-blue-500/60',
            description: 'Balanced slippage (1%) & speed.'
        },
        {
            id: 'AGGRESSIVE',
            label: 'Aggressive',
            icon: Zap,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/30',
            hover: 'hover:border-purple-500/60',
            description: 'High slippage (5%) & max speed.'
        }
    ] as const;

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
