/**
 * ActiveStrategiesPanel Component
 * 
 * Displays active copy trading strategies separately from order execution history
 */

'use client';

import { useState, useEffect } from 'react';
import { Target, StopCircle, RefreshCw, AlertCircle, ExternalLink, Settings2, DollarSign, Zap, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface Strategy {
    id: string;
    traderName: string | null;
    traderAddress: string;
    mode: 'FIXED_AMOUNT' | 'SIZE_SCALE' | 'PERCENTAGE';
    fixedAmount: number | null;
    sizeScale: number | null;
    createdAt: string;
    // New fields
    executionMode: 'PROXY' | 'EOA';
    autoExecute: boolean;
    slippageType: 'FIXED' | 'AUTO';
    maxSlippage: number;
    infiniteMode: boolean;
    direction: 'COPY' | 'COUNTER';
    maxSizePerTrade: number;
    updatedAt: string;
}

interface ActiveStrategiesPanelProps {
    walletAddress: string;
    className?: string;
}

export function ActiveStrategiesPanel({ walletAddress, className }: ActiveStrategiesPanelProps) {
    const t = useTranslations('Portfolio.activeStrategies');
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [strategyToStop, setStrategyToStop] = useState<string | null>(null);
    const [filter, setFilter] = useState<'active' | 'stopped'>('active');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchStrategies = async () => {
        try {
            setError(null);
            const response = await fetch(`/api/copy-trading/strategies?wallet=${walletAddress}&status=${filter}`);
            if (!response.ok) throw new Error('Failed to fetch strategies');

            const data = await response.json();
            setStrategies(data.strategies || []);
        } catch (err) {
            console.error('[Strategies] Error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (walletAddress) {
            fetchStrategies();
        }
    }, [walletAddress, filter]);

    // Reset to page 1 when filter changes
    const handleFilterChange = (newFilter: 'active' | 'stopped') => {
        setFilter(newFilter);
        setCurrentPage(1);
    };

    // Pagination
    const totalPages = Math.ceil(strategies.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedStrategies = strategies.slice(startIndex, endIndex);

    const handleStopStrategy = async (strategyId: string) => {
        const toastId = toast.loading(t('stopModal.loading'));

        try {
            const response = await fetch(`/api/copy-trading/config?id=${strategyId}&wallet=${walletAddress}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to stop strategy');

            toast.success(t('stopModal.success'), { id: toastId });
            fetchStrategies(); // Refresh list
        } catch (error) {
            console.error('Stop error:', error);
            toast.error(t('stopModal.error'), { id: toastId });
        } finally {
            setStrategyToStop(null);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Duration Helper
    const formatDuration = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffMs = endDate.getTime() - startDate.getTime();

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    return (
        <div className={cn('bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl flex flex-col overflow-hidden', className)}>
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold">{t('title')}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('subtitle', { count: strategies.length })}
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchStrategies}
                    disabled={isLoading}
                    className="p-2 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-border/50 flex-shrink-0">
                <FilterTab active={filter === 'active'} onClick={() => handleFilterChange('active')}>{t('badges.active')}</FilterTab>
                <FilterTab active={filter === 'stopped'} onClick={() => handleFilterChange('stopped')}>{t('badges.stopped')}</FilterTab>
            </div>

            {/* Strategies List */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
                {error && (
                    <div className="p-4 text-center">
                        <AlertCircle className="h-5 w-5 text-red-400 mx-auto mb-2" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {!error && strategies.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('empty.title')}</p>
                        <p className="text-xs mt-1">{t('empty.desc')}</p>
                    </div>
                )}

                {paginatedStrategies.map((strategy) => (
                    <StrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        onStop={() => setStrategyToStop(strategy.id)}
                        formatTime={formatTime}
                        formatDuration={formatDuration}
                        showStopButton={filter === 'active'}
                    />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-3 border-t border-border/50 flex items-center justify-between text-sm flex-shrink-0 bg-background/50 backdrop-blur-sm z-10">
                    <div className="text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(endIndex, strategies.length)} of {strategies.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded-lg bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded-lg bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Stop Confirmation Modal */}
            <AnimatePresence>
                {strategyToStop && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setStrategyToStop(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0f111a] shadow-2xl ring-1 ring-white/5"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/0 via-red-500/50 to-red-500/0 opacity-50" />

                            <div className="p-6">
                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-4 rounded-full bg-red-500/10 p-3 ring-1 ring-red-500/20">
                                        <AlertCircle className="h-6 w-6 text-red-500" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold text-white">{t('stopModal.title')}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {t('stopModal.desc')}
                                    </p>
                                </div>

                                <div className="mt-8 grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setStrategyToStop(null)}
                                        className="inline-flex items-center justify-center rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors border border-white/5"
                                    >
                                        {t('stopModal.cancel')}
                                    </button>
                                    <button
                                        onClick={() => handleStopStrategy(strategyToStop)}
                                        className="inline-flex items-center justify-center rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                    >
                                        {t('stopModal.confirm')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Filter Tab Component
function FilterTab({
    active,
    children,
    onClick
}: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                active
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
            )}
        >
            {children}
        </button>
    );
}

// Strategy Card Component
function StrategyCard({
    strategy,
    onStop,
    formatTime,
    formatDuration,
    showStopButton = true
}: {
    strategy: Strategy;
    onStop: () => void;
    formatTime: (date: string) => string;
    formatDuration?: (start: string, end: string) => string; // Optional for active prop safety
    showStopButton?: boolean;
}) {
    const t = useTranslations('Portfolio.activeStrategies');
    // Mode Display Logic
    const isFixed = strategy.mode === 'FIXED_AMOUNT' || strategy.fixedAmount !== null;
    const modeLabel = isFixed
        ? `${t('risk.fixed')} $${strategy.fixedAmount?.toFixed(2) || '0.00'}`
        : `${(Number(strategy.sizeScale || 0) * 100).toFixed(0)}% ${t('risk.shares')}`;

    return (
        <div className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors relative group">
            <div className="flex flex-col gap-3">
                {/* Header Row: Trader + Badges + Stop */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded bg-primary/10">
                                <Target className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="text-sm font-bold truncate">
                                {strategy.traderName || strategy.traderAddress.slice(0, 8) + '...'}
                            </span>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-1.5">
                            {showStopButton ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 uppercase tracking-wide">
                                    {t('badges.active')}
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20 uppercase tracking-wide">
                                    {t('badges.stopped')}
                                </span>
                            )}

                            {/* Execution Mode Badge */}
                            {strategy.executionMode === 'EOA' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 uppercase tracking-wide flex items-center gap-1">
                                    ⚡ {t('badges.speed')}
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase tracking-wide flex items-center gap-1">
                                    🛡️ {t('badges.proxy')}
                                </span>
                            )}
                            {/* Auto Badge */}
                            {strategy.autoExecute && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-wide flex items-center gap-1">
                                    🤖 {t('badges.auto')}
                                </span>
                            )}
                        </div>
                    </div>

                    {showStopButton && (
                        <button
                            onClick={onStop}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
                            title={t('actions.stop')}
                        >
                            <StopCircle className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Risk Settings (Status Bar Style) */}
                <div className="grid grid-cols-4 gap-2 text-xs bg-black/40 rounded-lg p-2 border border-white/5">
                    {/* Mode */}
                    <div className="flex flex-col items-center justify-center text-center gap-1 p-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('risk.mode')}</span>
                        <div className="flex items-center gap-1.5">
                            <Settings2 className="h-3 w-3 text-primary opacity-70" />
                            <span className="font-medium text-white">{modeLabel}</span>
                        </div>
                    </div>
                    {/* Max per Trade */}
                    <div className="flex flex-col items-center justify-center text-center gap-1 p-1 border-l border-white/5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('risk.maxLimit')}</span>
                        <div className="flex items-center gap-1.5">
                            <DollarSign className="h-3 w-3 text-green-400 opacity-70" />
                            <span className="font-medium text-white">${strategy.maxSizePerTrade}</span>
                        </div>
                    </div>
                    {/* Slippage */}
                    <div className="flex flex-col items-center justify-center text-center gap-1 p-1 border-l border-white/5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('risk.slippage')}</span>
                        <div className="flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-yellow-500 opacity-70" />
                            <span className="font-medium text-white">
                                {strategy.slippageType === 'AUTO' ? t('badges.auto') : `${strategy.maxSlippage}%`}
                            </span>
                        </div>
                    </div>
                    {/* Direction */}
                    <div className="flex flex-col items-center justify-center text-center gap-1 p-1 border-l border-white/5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('risk.direction')}</span>
                        <div className="flex items-center gap-1.5">
                            {strategy.direction === 'COUNTER' ? (
                                <ArrowRightLeft className="h-3 w-3 text-red-400" />
                            ) : (
                                <ArrowRightLeft className="h-3 w-3 text-green-400" />
                            )}
                            <span className={cn(
                                "font-medium",
                                strategy.direction === 'COUNTER' ? "text-red-400" : "text-green-400"
                            )}>
                                {strategy.direction === 'COUNTER' ? t('risk.counter') : t('risk.copy')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer: Date + Infinite Mode + Link */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                            <span>{t('footer.started', { time: formatTime(strategy.createdAt) })}</span>
                            {/* Duration for Active/Stopped strategies */}
                            {formatDuration && (
                                <span className="text-muted-foreground/50">
                                    • {t.rich('footer.activeFor', {
                                        duration: formatDuration(
                                            strategy.createdAt,
                                            showStopButton ? new Date().toISOString() : strategy.updatedAt
                                        ),
                                        highlight: (chunks: any) => <span className="text-foreground">{chunks}</span>
                                    })}
                                </span>
                            )}
                            {!showStopButton && (
                                <span className="text-muted-foreground/50">
                                    • {t('footer.stoppedAt', { time: formatTime(strategy.updatedAt) })}
                                </span>
                            )}

                            {/* Infinite Mode Badge (if enabled) */}
                            {strategy.infiniteMode && showStopButton && (
                                <div className="flex items-center gap-1 text-green-400">
                                    <RefreshCw className="h-3 w-3" />
                                    <span>{t('footer.infinite')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <a
                        href={`https://polymarket.com/profile/${strategy.traderAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors group/link"
                    >
                        <span className="font-mono group-hover/link:underline">{strategy.traderAddress.slice(0, 6)}...{strategy.traderAddress.slice(-4)}</span>
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </div>
        </div>
    );
}
