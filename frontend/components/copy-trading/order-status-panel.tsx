/**
 * OrderStatusPanel Component
 * 
 * Displays a panel showing order status for copy trades
 */

'use client';

import { useState } from 'react';
import { RefreshCw, Clock, Check, X, AlertCircle, ChevronDown, ChevronUp, ExternalLink, StopCircle, History } from 'lucide-react';
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
    const { orders, stats, isLoading, error, refresh, lastUpdated } = useOrderStatus(walletAddress, {
        pollInterval: 30000, // 30 seconds for real-time updates
    });

    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [orderToStop, setOrderToStop] = useState<string | null>(null);
    const [historyLeader, setHistoryLeader] = useState<{ address: string, name?: string } | null>(null);
    const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Filter orders
    // Filter orders
    const filteredOrders = orders.filter(order => {
        if (filter === 'buy') {
            return order.side === 'BUY';
        }
        if (filter === 'sell') {
            return order.side === 'SELL';
        }
        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);



    // Reset to page 1 when filter changes
    const handleFilterChange = (newFilter: 'all' | 'buy' | 'sell') => {
        setFilter(newFilter);
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
            });

            if (!response.ok) {
                throw new Error('Failed to stop copying');
            }

            toast.success('Stopped copying trader', { id: toastId });
            refresh(); // Refresh list to remove it
        } catch (error) {
            console.error('Stop error:', error);
            toast.error('Failed to stop copying', { id: toastId });
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
                        <h3 className="font-semibold">Order Status</h3>
                        <p className="text-xs text-muted-foreground">
                            {lastUpdated ? `Updated ${formatTime(lastUpdated.toISOString())}` : 'Loading...'}
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
                <StatsItem label="Total" value={stats.total} />
                <StatsItem label="Pending" value={stats.pending} color="text-yellow-400" />
                <StatsItem label="Open" value={stats.open} color="text-blue-400" />
                <StatsItem label="Filled" value={stats.filled} color="text-green-400" />
                <StatsItem label="Failed" value={stats.failed} color="text-red-400" />
            </div>

            {/* Filters */}
            <div className="flex border-b border-border/50 flex-shrink-0">
                <FilterTab active={filter === 'all'} onClick={() => handleFilterChange('all')}>All</FilterTab>
                <FilterTab active={filter === 'buy'} onClick={() => handleFilterChange('buy')}>Buy</FilterTab>
                <FilterTab active={filter === 'sell'} onClick={() => handleFilterChange('sell')}>Sell</FilterTab>
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
                        <p className="text-sm">No orders found</p>
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
                                    <h3 className="mb-2 text-lg font-semibold text-white">Stop Copying Trader?</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        You are about to stop copying this strategy. Any open positions will remain open, but no new trades will be executed.
                                    </p>
                                </div>

                                <div className="mt-8 grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setOrderToStop(null)}
                                        className="inline-flex items-center justify-center rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 hover:text-white transition-colors border border-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmStopCopying}
                                        className="inline-flex items-center justify-center rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                    >
                                        Stop Copying
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
    const statusColor = getOrderStatusColor(order.status);
    const statusIcon = getOrderStatusIcon(order.status);

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
                            order.side === 'BUY'
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-red-500/10 text-red-400'
                        )}>
                            {order.side}
                        </span>
                        <span className="text-sm font-medium truncate">
                            {order.market || 'Unknown Market'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span title="Leader Size vs My Size" className="font-mono">L: ${order.leaderSize?.toFixed(2) ?? '-'} • My: ${order.size.toFixed(2)}</span>
                        {order.leaderTxHash && (
                            <a
                                href={`https://polygonscan.com/tx/${order.leaderTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                                title="View Leader Transaction"
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
                            title="View Leader History"
                        >
                            <History className="h-3 w-3" />
                            <span>History</span>
                        </button>
                    </div>
                </div>

                {/* Stop Action for Strategies */}
                {order.tradeId.startsWith('strategy_') && (
                    <button
                        onClick={onStop}
                        className="mr-2 p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                        title="Stop Copying"
                    >
                        <StopCircle className="h-4 w-4" />
                    </button>
                )}

                {/* Status & Time */}
                <div className="text-right">
                    <div className={cn('text-xs font-medium', statusColor)}>
                        {order.status}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mt-1 mb-0.5">Leader Time</div>
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
                                label="Trade ID"
                                value={order.tradeId}
                                copyable
                                className="col-span-2 sm:col-span-1"
                            />
                            <DetailItem label="Order ID" value={order.orderId || 'N/A'} copyable={!!order.orderId} />
                            <DetailItem
                                label="Price (Ex.)"
                                value={`$${order.price.toFixed(2)}`}
                                subValue={order.leaderPrice ? `Leader: $${order.leaderPrice.toFixed(2)}` : undefined}
                            />
                            <DetailItem
                                label="Slippage"
                                value={order.leaderPrice ? `${((order.price - order.leaderPrice) / order.leaderPrice * 100).toFixed(2)}%` : '-'}
                                color={order.leaderPrice ? (order.price > order.leaderPrice ? 'text-red-400' : 'text-green-400') : undefined}
                            />
                            <DetailItem
                                label="Leader Size"
                                value={`$${order.leaderSize?.toFixed(2) ?? 'N/A'}`}
                            />
                            {order.leaderTxHash && (
                                <div className="col-span-2 sm:col-span-1">
                                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Leader Tx</span>
                                    <a
                                        href={`https://polygonscan.com/tx/${order.leaderTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono break-all"
                                    >
                                        {order.leaderTxHash.slice(0, 10)}...{order.leaderTxHash.slice(-8)}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            )}
                            <DetailItem
                                label="Filled"
                                value={`${order.filledPercent}%`}
                                color={order.filledPercent === 100 ? 'text-green-400' : undefined}
                            />
                            <DetailItem label="Token ID" value={order.tokenId ? (order.tokenId.slice(0, 12) + '...') : 'N/A'} />
                            <DetailItem
                                label="Executed"
                                value={order.executedAt
                                    ? new Date(order.executedAt).toLocaleString()
                                    : 'Not yet'}
                            />
                        </div>
                    </div>

                    {order.errorMessage && (
                        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">
                            Error: {order.errorMessage}
                        </div>
                    )}

                    {order.orderId && (
                        <div className="mt-3 ml-[3.5rem]">
                            <a
                                href={`https://polygonscan.com/tx/${order.orderId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 w-fit"
                            >
                                View on PolygonScan
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
