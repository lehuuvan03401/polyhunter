/**
 * ActiveStrategiesPanel Component
 * 
 * Displays active copy trading strategies separately from order execution history
 */

'use client';

import { useState, useEffect } from 'react';
import { Target, StopCircle, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

interface Strategy {
    id: string;
    traderName: string | null;
    traderAddress: string;
    mode: 'FIXED_AMOUNT' | 'SIZE_SCALE';
    fixedAmount: number | null;
    sizeScale: number | null;
    createdAt: string;
}

interface ActiveStrategiesPanelProps {
    walletAddress: string;
    className?: string;
}

export function ActiveStrategiesPanel({ walletAddress, className }: ActiveStrategiesPanelProps) {
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
        const toastId = toast.loading('Stopping strategy...');

        try {
            const response = await fetch(`/api/copy-trading/config?id=${strategyId}&wallet=${walletAddress}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to stop strategy');

            toast.success('Strategy stopped', { id: toastId });
            fetchStrategies(); // Refresh list
        } catch (error) {
            console.error('Stop error:', error);
            toast.error('Failed to stop strategy', { id: toastId });
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

    return (
        <div className={cn('bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl', className)}>
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Active Copy Trading Strategies</h3>
                        <p className="text-xs text-muted-foreground">
                            {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'} monitoring
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
            <div className="flex border-b border-border/50">
                <FilterTab active={filter === 'active'} onClick={() => handleFilterChange('active')}>Active</FilterTab>
                <FilterTab active={filter === 'stopped'} onClick={() => handleFilterChange('stopped')}>Stopped</FilterTab>
            </div>

            {/* Strategies List */}
            <div className="p-4 space-y-3">
                {error && (
                    <div className="p-4 text-center">
                        <AlertCircle className="h-5 w-5 text-red-400 mx-auto mb-2" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {!error && strategies.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No active strategies</p>
                        <p className="text-xs mt-1">Start copying a trader to see strategies here</p>
                    </div>
                )}

                {paginatedStrategies.map((strategy) => (
                    <StrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        onStop={() => setStrategyToStop(strategy.id)}
                        formatTime={formatTime}
                        showStopButton={filter === 'active'}
                    />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-3 border-t border-border/50 flex items-center justify-between text-sm">
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
                                    <h3 className="mb-2 text-lg font-semibold text-white">Stop Copy Trading?</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        You are about to stop this strategy. Any open positions will remain, but no new trades will be copied.
                                    </p>
                                </div>

                                <div className="mt-8 grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setStrategyToStop(null)}
                                        className="inline-flex items-center justify-center rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors border border-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleStopStrategy(strategyToStop)}
                                        className="inline-flex items-center justify-center rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                    >
                                        Stop Strategy
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
    showStopButton = true
}: {
    strategy: Strategy;
    onStop: () => void;
    formatTime: (date: string) => string;
    showStopButton?: boolean;
}) {
    return (
        <div className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    {/* Trader Info */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded bg-primary/10">
                            <Target className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-medium truncate">
                            {strategy.traderName || strategy.traderAddress.slice(0, 10) + '...'}
                        </span>
                    </div>

                    {/* Strategy Details */}
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground/70">Mode:</span>
                            <span className="font-medium">
                                {strategy.mode === 'FIXED_AMOUNT'
                                    ? `Fixed Amount ($${strategy.fixedAmount?.toFixed(2) || '0.00'})`
                                    : `Size Scale (${strategy.sizeScale || 0}x)`
                                }
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground/70">Started:</span>
                            <span>{formatTime(strategy.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground/70">Markets:</span>
                            <span>All</span>
                        </div>
                    </div>

                    {/* Trader Address Link */}
                    <a
                        href={`https://polymarket.com/profile/${strategy.traderAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <span className="font-mono">{strategy.traderAddress.slice(0, 6)}...{strategy.traderAddress.slice(-4)}</span>
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>

                {/* Stop Button - only show for active strategies */}
                {showStopButton && (
                    <button
                        onClick={onStop}
                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors shrink-0"
                        title="Stop Strategy"
                    >
                        <StopCircle className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
