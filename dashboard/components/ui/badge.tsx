import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        const variants = {
            default: "bg-dark-700 text-silver-300 border border-silver-600/30",
            success: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
            danger: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
            warning: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
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
