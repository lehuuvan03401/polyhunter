import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    showHomeButton?: boolean;
}

/**
 * 统一的错误状态组件
 */
export function ErrorState({
    title = 'Something went wrong',
    message,
    onRetry,
    showHomeButton = true,
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
                <h3 className="font-semibold text-lg mb-1">{title}</h3>
                {message && <p className="text-muted-foreground text-sm max-w-md">{message}</p>}
            </div>
            <div className="flex items-center gap-3">
                {onRetry && (
                    <Button
                        onClick={onRetry}
                        variant="default"
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </Button>
                )}
                {showHomeButton && (
                    <Button
                        onClick={() => (window.location.href = '/')}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <Home className="h-4 w-4" />
                        Back to Home
                    </Button>
                )}
            </div>
        </div>
    );
}

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    message?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

/**
 * 统一的空状态组件
 */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
            {icon && (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    {icon}
                </div>
            )}
            <div>
                <h3 className="font-semibold text-lg mb-1">{title}</h3>
                {message && <p className="text-muted-foreground text-sm max-w-md">{message}</p>}
            </div>
            {action && (
                <Button onClick={action.onClick} variant="default">
                    {action.label}
                </Button>
            )}
        </div>
    );
}