
function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-md bg-muted/50 ${className}`} />;
}

export function TableSkeleton() {
    return (
        <div className="w-full">
            <div className="p-6 pb-2">
                <div className="space-y-4">
                    {/* Header Skeleton */}
                    <div className="flex items-center justify-between border-b pb-4">
                        <Skeleton className="h-4 w-[100px]" />
                        <Skeleton className="h-4 w-[150px]" />
                        <Skeleton className="h-4 w-[80px]" />
                        <Skeleton className="h-4 w-[80px]" />
                        <Skeleton className="h-4 w-[50px]" />
                        <Skeleton className="h-4 w-[80px]" />
                    </div>
                    {/* Rows */}
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between py-4 border-b">
                            <Skeleton className="h-4 w-[80px]" />
                            <Skeleton className="h-4 w-[200px]" />
                            <Skeleton className="h-4 w-[80px]" />
                            <Skeleton className="h-4 w-[80px]" />
                            <Skeleton className="h-4 w-[40px]" />
                            <Skeleton className="h-8 w-[100px]" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

