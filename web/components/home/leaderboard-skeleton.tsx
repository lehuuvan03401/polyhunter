import { cn } from "@/lib/utils"

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-muted", className)}
            {...props}
        />
    )
}

export function LeaderboardSkeleton() {
    return (
        <div className="bg-card border rounded-xl overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-4 p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/50">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-4">Trader</div>
                <div className="col-span-3 text-right">Profit</div>
                <div className="col-span-2 text-right">Score</div>
                <div className="col-span-2 text-right">Action</div>
            </div>

            {/* Rows */}
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 items-center">
                    <div className="col-span-1 flex justify-center">
                        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="col-span-4 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                        <div className="flex flex-col gap-1.5">
                            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                            <div className="h-2 w-16 bg-muted/50 animate-pulse rounded" />
                        </div>
                    </div>
                    <div className="col-span-3 flex justify-end">
                        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="col-span-2 flex justify-end">
                        <div className="h-3 w-8 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="col-span-2 flex justify-end">
                        <div className="h-6 w-12 bg-muted animate-pulse rounded" />
                    </div>
                </div>
            ))}
        </div>
    )
}
