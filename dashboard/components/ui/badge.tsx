import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        const variants = {
            default: "bg-dark-700 text-silver-300 border border-silver-600/30",
            success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
            danger: "bg-crimson-500/20 text-crimson-400 border border-crimson-500/30",
            warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
            info: "bg-silver-500/20 text-silver-300 border border-silver-500/30",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all",
                    variants[variant],
                    className
                )}
                {...props}
            />
        );
    }
);
Badge.displayName = "Badge";

export { Badge };
