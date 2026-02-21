import { Loader2 } from 'lucide-react';

interface LoadingProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    fullScreen?: boolean;
}

/**
 * 统一的加载状态组件
 */
export function Loading({ size = 'md', text, fullScreen = false }: LoadingProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    };

    const content = (
        <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className={`${sizeClasses[size]} animate-spin text-muted-foreground`} />
            {text && <p className="text-sm text-muted-foreground">{text}</p>}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                {content}
            </div>
        );
    }

    return content;
}

interface LoadingSkeletonProps {
    className?: string;
}

/**
 * 骨架屏加载组件
 */
export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
    return (
        <div className={`animate-pulse bg-muted rounded ${className}`} />
    );
}