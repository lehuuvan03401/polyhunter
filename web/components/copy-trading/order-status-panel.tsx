/**
 * OrderStatusPanel Component
 * 
 * Displays a panel showing order status for copy trades
 */

'use client';

import { useMemo, useState, useCallback } from 'react';
import { RefreshCw, Clock, Check, X, AlertCircle, ChevronDown, ChevronUp, ExternalLink, StopCircle, History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useOrderStatus, getOrderStatusColor, getOrderStatusIcon, type Order, type OrderStatus } from '@/lib/hooks/useOrderStatus';
import { AnimatePresence, motion } from 'framer-motion';
import { LeaderHistoryModal } from './leader-history-modal';

interface OrderStatusPanelProps {
    walletAddress: string;
    className?: string;
}

export function OrderStatusPanel({ walletAddress, className }: OrderStatusPanelProps) {
    const t = useTranslations('Portfolio.orderStatus');
    const { orders, isLoading, error, refresh, lastUpdated } = useOrderStatus(walletAddress, {
        pollInterval: 30000, // 30 seconds for real-time updates
    });

    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [orderToStop, setOrderToStop] = useState<string | null>(null);
    const [historyLeader, setHistoryLeader] = useState<{ address: string, name?: string } | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'open' | 'filled' | 'failed'>('all');
    const [modeFilter, setModeFilter] = useState<'all' | 'sim' | 'live'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const isSimulationOrder = useCallback((order: Order) => {
        const orderId = order.orderId?.toLowerCase() || '';
        // LIVE- prefix means Live mode, not simulation
        if (orderId.startsWith('live-')) return false;
        return order.isSim || orderId.startsWith('sim-') || orderId.startsWith('adjust-');
    }, []);

    const modeScopedOrders = useMemo(() => {
        if (modeFilter === 'sim') return orders.filter(order => isSimulationOrder(order));
        if (modeFilter === 'live') return orders.filter(order => !isSimulationOrder(order));
        return orders;
    }, [orders, modeFilter, isSimulationOrder]);

    const statusCounts = useMemo(() => {
        return modeScopedOrders.reduce(
            (acc, order) => {
                if (order.status === 'PENDING' || order.status === 'SETTLEMENT_PENDING') {
                    acc.pending += 1;
                } else if (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') {
                    acc.open += 1;
                } else if (order.status === 'FILLED') {
                    acc.filled += 1;
                } else if (order.status === 'REJECTED' || order.status === 'CANCELLED' || order.status === 'EXPIRED') {
                    acc.failed += 1;
                }
                return acc;
            },
            { pending: 0, open: 0, filled: 0, failed: 0 }
        );
    }, [modeScopedOrders]);

    // Filter orders
    const filteredOrders = modeScopedOrders.filter(order => {
        const statusMatches = (() => {
            if (statusFilter === 'pending') {
                return order.status === 'PENDING' || order.status === 'SETTLEMENT_PENDING';
            }
            if (statusFilter === 'open') {
                return order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED';
            }
            if (statusFilter === 'filled') {
                return order.status === 'FILLED';
            }
            if (statusFilter === 'failed') {
                return order.status === 'REJECTED' || order.status === 'CANCELLED' || order.status === 'EXPIRED';
            }
            return true;
        })();
        return statusMatches;
    });

    // Pagination
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);



    // Reset to page 1 when filter changes
    const handleStatusFilterChange = (newFilter: 'all' | 'pending' | 'open' | 'filled' | 'failed') => {
        setStatusFilter(newFilter);
        setCurrentPage(1);
    };

    const handleModeFilterChange = (newFilter: 'all' | 'sim' | 'live') => {
        setModeFilter(newFilter);
        setCurrentPage(1);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleStopCopying = (tradeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOrderToStop(tradeId);
    };

    const confirmStopCopying = async () => {
        if (!orderToStop) return;

        // Extract real config ID from strategy_ prefix
        const configId = orderToStop.replace('strategy_', '');
        const toastId = toast.loading('Stopping copy trade...');

        try {
            const response = await fetch(`/api/copy-trading/config?id=${configId}&wallet=${walletAddress}`, {
                method: 'DELETE',
                headers: {
                    'x-wallet-address': walletAddress.toLowerCase(),
                },
            });

            if (!response.ok) {
                throw new Error('Failed to stop copying');
            }

            toast.success(t('stopModal.success'), { id: toastId });
            refresh(); // Refresh list to remove it
        } catch (error) {
            console.error('Stop error:', error);
            toast.error(t('stopModal.error'), { id: toastId });
        } finally {
            setOrderToStop(null);
        }
    };

    return (
        <div className={cn('bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl flex flex-col overflow-hidden', className)}>
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold">{t('title')}</h3>
                        <p className="text-xs text-muted-foreground">
                            {lastUpdated ? t('updated', { time: formatTime(lastUpdated.toISOString()) }) : t('loading')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => refresh()}
                    disabled={isLoading}
                    className="p-2 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                </button>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-3 p-3 bg-muted/20 text-xs">
                <StatsItem label={t('stats.total')} value={modeScopedOrders.length} />
                <StatsItem label={t('stats.pending')} value={statusCounts.pending} color="text-yellow-400" />
                <StatsItem label={t('stats.open')} value={statusCounts.open} color="text-blue-400" />
                <StatsItem label={t('stats.filled')} value={statusCounts.filled} color="text-green-400" />
                <StatsItem label={t('stats.failed')} value={statusCounts.failed} color="text-red-400" />
            </div>

            {/* Filters */}
            <div className="border-b border-border/50 flex-shrink-0">
                <div className="flex">
                    <FilterTab active={statusFilter === 'all'} onClick={() => handleStatusFilterChange('all')}>
                        All ({modeScopedOrders.length})
                    </FilterTab>
                    <FilterTab active={statusFilter === 'pending'} onClick={() => handleStatusFilterChange('pending')}>
                        Pending ({statusCounts.pending})
                    </FilterTab>
                    <FilterTab active={statusFilter === 'open'} onClick={() => handleStatusFilterChange('open')}>
                        Open ({statusCounts.open})
                    </FilterTab>
                    <FilterTab active={statusFilter === 'filled'} onClick={() => handleStatusFilterChange('filled')}>
                        Filled ({statusCounts.filled})
                    </FilterTab>
                    <FilterTab active={statusFilter === 'failed'} onClick={() => handleStatusFilterChange('failed')}>
                        Failed ({statusCounts.failed})
                    </FilterTab>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground">{t('filters.mode')}:</span>
                    <button
                        onClick={() => handleModeFilterChange('all')}
                        className={cn(
                            "px-2 py-1 rounded-full border transition-colors",
                            modeFilter === 'all'
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                        )}
                    >
                        {t('filters.all')}
                    </button>
                    <button
                        onClick={() => handleModeFilterChange('sim')}
                        className={cn(
                            "px-2 py-1 rounded-full border transition-colors",
                            modeFilter === 'sim'
                                ? "bg-blue-500 text-white border-blue-500"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                        )}
                    >
                        {t('filters.sim')}
                    </button>
                    <button
                        onClick={() => handleModeFilterChange('live')}
                        className={cn(
                            "px-2 py-1 rounded-full border transition-colors",
                            modeFilter === 'live'
                                ? "bg-amber-500 text-black border-amber-500"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                        )}
                    >
                        {t('filters.live')}
                    </button>
                </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {error && (
                    <div className="p-4 text-center">
                        <AlertCircle className="h-5 w-5 text-red-400 mx-auto mb-2" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {!error && filteredOrders.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('empty')}</p>
                    </div>
                )}

                {paginatedOrders.map((order, i) => {
                    // Calculate global index (descending from total)
                    const globalIndex = filteredOrders.length - (startIndex + i);
                    return (
                        <OrderRow
                            key={order.tradeId}
                            index={globalIndex}
                            order={order}
                            expanded={expandedOrder === order.tradeId}
                            onToggle={() => setExpandedOrder(
                                expandedOrder === order.tradeId ? null : order.tradeId
                            )}
                            onStop={(e) => handleStopCopying(order.tradeId, e)}
                            onOpenHistory={(addr, name) => setHistoryLeader({ address: addr, name })}
                        />
                    );
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-3 border-t border-border/50 flex items-center justify-between text-sm flex-shrink-0 bg-background/50 backdrop-blur-sm z-10">
                    <div className="text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length}
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

            {/* Custom Stop Confirmation Modal */}
            <AnimatePresence>
                {/* ... existing stop modal ... */}
                {orderToStop && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        {/* Backdrop - High Blur for "Premium" feel */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOrderToStop(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0f111a] shadow-2xl ring-1 ring-white/5"
                        >
                            {/* Decorative Top Glow */}
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
                                        onClick={() => setOrderToStop(null)}
                                        className="inline-flex items-center justify-center rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 hover:text-white transition-colors border border-white/5"
                                    >
                                        {t('stopModal.cancel')}
                                    </button>
                                    <button
                                        onClick={confirmStopCopying}
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

            {/* Leader History Modal */}
            <LeaderHistoryModal
                isOpen={!!historyLeader}
                onClose={() => setHistoryLeader(null)}
                leaderAddress={historyLeader?.address || ''}
                leaderName={historyLeader?.name}
            />
        </div>
    );
}

// Stats Item
function StatsItem({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{label}:</span>
            <span className={cn('font-medium', color)}>{value}</span>
        </div>
    );
}

// Filter Tab
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

// Order Row
function OrderRow({
    order,
    index,
    expanded,
    onToggle,
    onStop,
    onOpenHistory
}: {
    order: Order;
    index: number;
    expanded: boolean;
    onToggle: () => void;
    onStop?: (e: React.MouseEvent) => void;
    onOpenHistory: (address: string, name?: string) => void;
}) {
    const t = useTranslations('Portfolio.orderStatus');
    const statusColor = getOrderStatusColor(order.status);
    const statusIcon = getOrderStatusIcon(order.status);
    const normalizedOrderId = order.orderId?.toLowerCase() || '';
    const isSimulation = (() => {
        // LIVE- prefix means Real mode, not simulation
        if (normalizedOrderId.startsWith('live-')) return false;
        return order.isSim || normalizedOrderId.startsWith('sim-') || normalizedOrderId.startsWith('adjust-');
    })();
    const isSettlementOrder = normalizedOrderId.includes('settlement-')
        || normalizedOrderId.includes('redeem')
        || normalizedOrderId.includes('settle-loss')
        || normalizedOrderId.startsWith('adjust-')
        || order.side === 'REDEEM';
    const leaderShares = order.leaderSize ?? 0;
    const leaderNotional = order.leaderPrice && leaderShares
        ? leaderShares * order.leaderPrice
        : null;
    const copyNotional = order.size;
    const copyShares = order.price
        ? (copyNotional / order.price)
        : (isSettlementOrder ? leaderShares : 0);
    const copyRatio = !isSettlementOrder && leaderShares > 0 ? (copyShares / leaderShares) : null;
    const infoMessage = order.errorMessage && (
        order.errorMessage.startsWith('Realized Loss') ||
        order.errorMessage.startsWith('Redeemed Profit') ||
        order.errorMessage.startsWith('Settlement')
    );
    const leaderPrefix = isSettlementOrder ? 'Pos' : 'L';
    const leaderLabel = isSettlementOrder ? t('details.posSize') : t('details.leaderSize');
    const settlementType = (() => {
        if (!isSettlementOrder) return null;
        if (normalizedOrderId.includes('redeem') || normalizedOrderId.startsWith('adjust-') || order.side === 'REDEEM') {
            return 'REDEEM';
        }
        return 'SETTLE';
    })();
    const displaySide = settlementType || order.side;
    const sideClass = displaySide === 'BUY' || displaySide === 'REDEEM'
        ? 'bg-green-500/10 text-green-400'
        : displaySide === 'SETTLE'
            ? 'bg-red-500/10 text-red-400'
            : 'bg-red-500/10 text-red-400';

    return (
        <div className="border-b border-border/30 last:border-b-0">
            <div
                role="button"
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left cursor-pointer outline-none focus-visible:bg-muted/30"
            >
                {/* Index Column */}
                <div className="text-xs font-mono text-muted-foreground/50 w-6 text-center shrink-0">
                    #{index}
                </div>

                {/* Status Icon */}
                <div className={cn('text-lg', statusColor)}>
                    {statusIcon}
                </div>

                {/* Order Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            'text-xs font-medium px-1.5 py-0.5 rounded',
                            sideClass
                        )}>
                            {displaySide}
                        </span>
                        {isSimulation && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                                SIM
                            </span>
                        )}
                        <span className="text-sm font-medium truncate">
                            {order.market || 'Unknown Market'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span title={t('details.leaderVsMySize')} className="font-mono">
                            {leaderPrefix}: {leaderShares ? leaderShares.toFixed(2) : '-'} sh • My: {copyShares.toFixed(2)} sh
                            {copyRatio !== null ? ` (${copyRatio.toFixed(2)}x)` : ''}
                        </span>
                        {order.leaderTxHash && (
                            <a
                                href={`https://polygonscan.com/tx/${order.leaderTxHash.split(':')[0]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                                title={t('details.viewLeaderTx')}
                            >
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                        <span>•</span>
                        <span>{order.traderName || order.traderAddress.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <a
                            href={`https://polymarket.com/profile/${order.traderAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors z-20 relative pointer-events-auto"
                        >
                            <span className="font-mono">{order.traderAddress.slice(0, 6)}...{order.traderAddress.slice(-4)}</span>
                            <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenHistory(order.traderAddress, order.traderName || undefined);
                            }}
                            className="text-xs bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors z-20 relative pointer-events-auto ml-2 px-2 py-0.5 rounded-md"
                            title={t('details.viewHistory')}
                        >
                            <History className="h-3 w-3" />
                            <span>{t('details.historyButton')}</span>
                        </button>
                    </div>
                </div>

                {/* Stop Action for Strategies */}
                {order.tradeId.startsWith('strategy_') && (
                    <button
                        onClick={onStop}
                        className="mr-2 p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                        title={t('details.stopCopying')}
                    >
                        <StopCircle className="h-4 w-4" />
                    </button>
                )}

                {/* Status & Time */}
                <div className="text-right">
                    <div className={cn('text-xs font-medium', statusColor)}>
                        {order.status}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mt-1 mb-0.5">{t('details.leaderTime')}</div>
                    <div className="text-xs text-foreground/80 whitespace-nowrap font-mono">
                        {new Date(order.detectedAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })}
                    </div>
                </div>

                {/* Expand Icon */}
                {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-3 pb-3 relative">
                    {/* Vertical line connecting to parent - optional visual link */}
                    <div className="absolute left-[1.6rem] top-0 bottom-3 w-px bg-border/30 -z-10" />

                    {/* Content wrapper with left margin to align with 'COPY' text */}
                    {/* w-6 (Index) + gap-3 + approx w-5 (Icon) + gap-3 = ~3.5rem - 4rem offset */}
                    <div className="ml-[3.5rem] space-y-2 bg-muted/10 rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <DetailItem
                                label={t('details.tradeId')}
                                value={order.tradeId}
                                copyable
                                className="col-span-2 sm:col-span-1"
                            />
                            <DetailItem label={t('details.orderId')} value={order.orderId || 'N/A'} copyable={!!order.orderId} />
                            <DetailItem
                                label={t('details.priceEx')}
                                value={`$${order.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                                subValue={order.leaderPrice ? `Leader: $${order.leaderPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : undefined}
                            />
                            <DetailItem
                                label={t('details.slippage')}
                                value={order.leaderPrice ? (order.price === order.leaderPrice ? '0.00%' : `${((order.price - order.leaderPrice) / order.leaderPrice * 100).toFixed(2)}%`) : '-'}
                                color={order.leaderPrice ? (order.price > order.leaderPrice ? 'text-red-400' : (order.price < order.leaderPrice ? 'text-green-400' : 'text-muted-foreground')) : undefined}
                            />
                            <DetailItem
                                label={t('details.mode')}
                                value={isSimulation ? t('details.simulation') : t('details.live')}
                            />
                            <DetailItem
                                label={leaderLabel}
                                value={`${leaderShares ? leaderShares.toFixed(2) : 'N/A'} sh`}
                                subValue={leaderNotional !== null ? `$${leaderNotional.toFixed(2)}` : undefined}
                            />
                            <DetailItem
                                label={t('details.mySize')}
                                value={`${copyShares.toFixed(2)} sh`}
                                subValue={`$${copyNotional.toFixed(2)}`}
                            />
                            {order.leaderTxHash && (
                                <div className="col-span-2 sm:col-span-1">
                                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">{t('details.leaderTx')}</span>
                                    <a
                                        href={`https://polygonscan.com/tx/${order.leaderTxHash.split(':')[0]}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono break-all"
                                    >
                                        {order.leaderTxHash.split(':')[0].slice(0, 10)}...{order.leaderTxHash.split(':')[0].slice(-8)}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            )}
                            <DetailItem
                                label={t('details.filled')}
                                value={`${order.filledPercent}%`}
                                color={order.filledPercent === 100 ? 'text-green-400' : undefined}
                            />
                            <DetailItem label={t('details.tokenId')} value={order.tokenId ? (order.tokenId.slice(0, 12) + '...') : 'N/A'} />
                            <DetailItem
                                label={t('details.executed')}
                                value={order.executedAt
                                    ? new Date(order.executedAt).toLocaleString()
                                    : t('details.notYet')}
                            />
                        </div>
                    </div>

                    {order.errorMessage && (
                        <div className={cn("p-2 rounded text-xs", infoMessage ? "bg-muted/40 text-muted-foreground" : "bg-red-500/10 text-red-400")}>
                            {infoMessage ? t('details.result') : t('details.error')}: {order.errorMessage}
                        </div>
                    )}

                    {order.orderId && !isSimulation && !order.orderId.toLowerCase().startsWith('sim-') && !order.orderId.toLowerCase().startsWith('live-') && !order.orderId.toLowerCase().startsWith('adjust-') && !order.orderId.toLowerCase().startsWith('settle-') && (
                        <div className="mt-3 ml-[3.5rem]">
                            <a
                                href={`https://polygonscan.com/tx/${order.orderId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 w-fit"
                            >
                                {t('details.viewPolygonScan')}
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Detail Item
function DetailItem({
    label,
    value,
    subValue,
    color,
    copyable,
    className
}: {
    label: string;
    value: string;
    subValue?: string;
    color?: string;
    copyable?: boolean;
    className?: string;
}) {
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        toast.success('Copied to clipboard');
    };

    return (
        <div className={className}>
            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">{label}</span>
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className={cn('font-medium font-mono text-xs break-all', color)}>{value}</span>
                    {copyable && (
                        <button
                            onClick={handleCopy}
                            className="p-1 hover:bg-white/10 rounded transition-colors text-muted-foreground hover:text-white shrink-0"
                            title="Copy"
                        >
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                        </button>
                    )}
                </div>
                {subValue && (
                    <span className="text-[10px] text-muted-foreground font-mono">{subValue}</span>
                )}
            </div>
        </div>
    );
}
