/**
 * OrderStatusPanel Component
 * 
 * Displays a panel showing order status for copy trades
 */

'use client';

import { useState } from 'react';
import { RefreshCw, Clock, Check, X, AlertCircle, ChevronDown, ChevronUp, ExternalLink, StopCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useOrderStatus, getOrderStatusColor, getOrderStatusIcon, type Order, type OrderStatus } from '@/lib/hooks/useOrderStatus';

interface OrderStatusPanelProps {
    walletAddress: string;
    className?: string;
}

export function OrderStatusPanel({ walletAddress, className }: OrderStatusPanelProps) {
    const { orders, stats, isLoading, error, refresh, lastUpdated } = useOrderStatus(walletAddress, {
        pollInterval: 15000, // 15 seconds
    });

    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

    // Filter orders
    const filteredOrders = orders.filter(order => {
        if (filter === 'active') {
            return ['PENDING', 'OPEN', 'PARTIALLY_FILLED', 'SETTLEMENT_PENDING'].includes(order.status);
        }
        if (filter === 'completed') {
            return ['FILLED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(order.status);
        }
        return true;
    });

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

    const handleStopCopying = async (tradeId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // Extract real config ID from strategy_ prefix
        const configId = tradeId.replace('strategy_', '');

        if (!confirm('Are you sure you want to stop copying this trader?')) {
            return;
        }

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
        }
    };

    return (
        <div className={cn('bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden', className)}>
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
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

            {/* Filter Tabs */}
            <div className="flex border-b border-border/50">
                <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterTab>
                <FilterTab active={filter === 'active'} onClick={() => setFilter('active')}>Active</FilterTab>
                <FilterTab active={filter === 'completed'} onClick={() => setFilter('completed')}>Completed</FilterTab>
            </div>

            {/* Orders List */}
            <div className="max-h-[400px] overflow-y-auto">
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

                {filteredOrders.map(order => (
                    <OrderRow
                        key={order.tradeId}
                        order={order}
                        expanded={expandedOrder === order.tradeId}
                        onToggle={() => setExpandedOrder(
                            expandedOrder === order.tradeId ? null : order.tradeId
                        )}
                        onStop={(e) => handleStopCopying(order.tradeId, e)}
                    />

                ))}
            </div>
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
    expanded,
    onToggle,
    onStop
}: {
    order: Order;
    expanded: boolean;
    onToggle: () => void;
    onStop?: (e: React.MouseEvent) => void;
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
                        <span>${order.size.toFixed(2)}</span>
                        <span>•</span>
                        <span>{order.traderName || order.traderAddress.slice(0, 8)}</span>
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
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
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
                <div className="px-3 pb-3 space-y-2 bg-muted/10">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Strategy vs Trade Details */}
                        {order.tradeId.startsWith('strategy_') ? (
                            <>
                                <DetailItem label="Strategy ID" value={order.tradeId.replace('strategy_', '').slice(0, 16) + '...'} />
                                <DetailItem label="Target" value="All Markets" />
                                <DetailItem label="Size" value={order.size ? `$${order.size}` : 'Variable'} />
                                <DetailItem label="Status" value="Active Monitoring" color="text-green-400" />
                                <DetailItem label="Started" value={new Date(order.detectedAt).toLocaleString()} />
                            </>
                        ) : (
                            <>
                                <DetailItem label="Trade ID" value={order.tradeId.slice(0, 16) + '...'} />
                                <DetailItem label="Order ID" value={order.orderId ? (order.orderId.slice(0, 16) + '...') : 'N/A'} />
                                <DetailItem label="Price" value={`$${order.price.toFixed(2)}`} />
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
                                        : 'Not yet'
                                    }
                                />
                            </>
                        )}
                    </div>

                    {order.errorMessage && (
                        <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">
                            Error: {order.errorMessage}
                        </div>
                    )}

                    {order.orderId && (
                        <a
                            href={`https://polygonscan.com/tx/${order.orderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                            <ExternalLink className="h-3 w-3" />
                            View on Explorer
                        </a>
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
    color
}: {
    label: string;
    value: string;
    color?: string;
}) {
    return (
        <div>
            <span className="text-muted-foreground">{label}: </span>
            <span className={cn('font-medium', color)}>{value}</span>
        </div>
    );
}
