/**
 * PendingTradesAlert Component
 * 
 * Displays pending copy trades that need user confirmation
 */

'use client';

import { useState } from 'react';
import { Bell, X, Check, Clock, TrendingUp, TrendingDown, Loader2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePendingTrades, type PendingTrade } from '@/lib/hooks/usePendingTrades';
import { useProxy } from '@/lib/contracts/useProxy';
import { encodeApproveUSDC, getExchangeAddress } from '@/lib/contracts/trade-execution';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface PendingTradesAlertProps {
    walletAddress: string;
}

export function PendingTradesAlert({ walletAddress }: PendingTradesAlertProps) {
    const t = useTranslations('Portfolio.pendingTrades');
    const { pendingTrades, isLoading, executeTrade, skipTrade, refresh } = usePendingTrades(walletAddress);
    const { hasProxy, proxyAddress, executeCall, txPending } = useProxy();
    const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
    const [executing, setExecuting] = useState<string | null>(null);

    if (isLoading && pendingTrades.length === 0) {
        return null; // Don't show anything while loading initially
    }

    if (pendingTrades.length === 0) {
        return null; // No pending trades
    }

    const handleExecute = async (trade: PendingTrade) => {
        setExecuting(trade.id);
        try {
            /**
             * EXECUTION FLOW:
             * 1. Try server-side execution (if TRADING_PRIVATE_KEY configured)
             * 2. Fall back to manual proxy execution if needed
             * 3. Update database with result
             */

            // Step 1: Try server-side CLOB execution
            const serverResponse = await fetch('/api/copy-trading/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tradeId: trade.id,
                    walletAddress: walletAddress,
                    executeOnServer: true,
                    orderMode: 'market',
                    slippage: 0.02,
                }),
            });

            const serverResult = await serverResponse.json();

            if (serverResult.success) {
                toast.success(
                    <div className="flex flex-col gap-1">
                        <span className="font-medium">{t('actions.executed')}</span>
                        <span className="text-xs text-muted-foreground">
                            {trade.originalSide} ${trade.copySize.toFixed(2)} on {trade.marketSlug || 'market'}
                        </span>
                        {serverResult.orderId && (
                            <span className="text-xs text-green-400">
                                Order: {serverResult.orderId.slice(0, 20)}...
                            </span>
                        )}
                    </div>
                );
                refresh();
                return;
            }

            // Step 2: Server execution not available - try manual proxy execution
            if (serverResult.requiresManualExecution) {
                // Check proxy availability
                if (!hasProxy || !proxyAddress) {
                    toast.error(
                        <div className="flex flex-col gap-1">
                            <span className="font-medium">{t('proxyError.title')}</span>
                            <span className="text-xs text-muted-foreground">
                                {t('proxyError.desc')}
                            </span>
                        </div>
                    );
                    return;
                }

                // Approve USDC for CLOB Exchange
                const exchangeAddress = getExchangeAddress();
                if (exchangeAddress) {
                    const approveCall = encodeApproveUSDC(exchangeAddress, -1);
                    await executeCall(approveCall.target, approveCall.data);
                }

                // Mark as executed (manual mode)
                const success = await executeTrade(trade.id, 'executed', undefined);
                if (success) {
                    toast.success(
                        <div className="flex flex-col gap-1">
                            <span className="font-medium">{t('actions.tradeApproved')}</span>
                            <span className="text-xs text-muted-foreground">
                                {trade.originalSide} ${trade.copySize.toFixed(2)}
                            </span>
                            <span className="text-xs text-yellow-400">
                                {t('actions.manualNote')}
                            </span>
                        </div>
                    );
                    refresh();
                }
            } else {
                // Server execution failed
                toast.error(serverResult.error || t('actions.failed'));
            }
        } catch (err) {
            console.error('Execute error:', err);
            toast.error(t('actions.failed'));
        } finally {
            setExecuting(null);
        }
    };

    const handleSkip = async (trade: PendingTrade) => {
        setExecuting(trade.id);
        try {
            await skipTrade(trade.id);
            toast.info(t('actions.skipped'));
        } finally {
            setExecuting(null);
        }
    };

    const formatTimeLeft = (expiresAt: string | null) => {
        if (!expiresAt) return t('time.noExpiry');
        const diff = new Date(expiresAt).getTime() - Date.now();
        if (diff <= 0) return t('time.expired');
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return t('time.lessThanMin');
        return t('time.minLeft', { mins });
    };

    // Show warning if no proxy
    const showProxyWarning = !hasProxy;

    return (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl overflow-hidden">
            {/* Proxy Warning */}
            {showProxyWarning && (
                <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-yellow-400">{t('proxyWarning')}</span>
                </div>
            )}

            {/* Header */}
            <div className="p-4 flex items-center justify-between bg-blue-500/5">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Bell className="h-5 w-5 text-blue-400" />
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                            {pendingTrades.length}
                        </span>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{t('title')}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('subtitle', { count: pendingTrades.length })}
                        </p>
                    </div>
                </div>
                <button
                    onClick={refresh}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                    {t('refresh')}
                </button>
            </div>

            {/* Trade List */}
            <div className="divide-y divide-white/5">
                {pendingTrades.map((trade) => (
                    <div key={trade.id} className="p-4">
                        <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center",
                                    trade.originalSide === 'BUY' ? "bg-green-500/10" : "bg-red-500/10"
                                )}>
                                    {trade.originalSide === 'BUY' ? (
                                        <TrendingUp className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <TrendingDown className="h-4 w-4 text-red-500" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "font-bold text-sm",
                                            trade.originalSide === 'BUY' ? "text-green-400" : "text-red-400"
                                        )}>
                                            {trade.originalSide}
                                        </span>
                                        <span className="text-white font-medium">${trade.copySize.toFixed(2)}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {trade.config.traderName || trade.config.traderAddress.slice(0, 10)}...
                                        {trade.outcome && <span className="ml-1">→ {trade.outcome}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatTimeLeft(trade.expiresAt)}
                                </div>
                                {expandedTrade === trade.id ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedTrade === trade.id && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">{t('details.original')}:</span>
                                        <span className="ml-2 text-white">${(trade.originalSize * trade.originalPrice).toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">{t('details.yourCopy')}:</span>
                                        <span className="ml-2 text-white">${trade.copySize.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">{t('details.price')}:</span>
                                        <span className="ml-2 text-white">{(trade.originalPrice * 100).toFixed(1)}¢</span>
                                    </div>
                                    {trade.marketSlug && (
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">{t('details.market')}:</span>
                                            <span className="ml-2 text-white">{trade.marketSlug}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleSkip(trade); }}
                                        disabled={executing === trade.id}
                                        className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <X className="h-4 w-4" />
                                        {t('actions.skip')}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleExecute(trade); }}
                                        disabled={executing === trade.id}
                                        className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        {executing === trade.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Check className="h-4 w-4" />
                                        )}
                                        {t('actions.execute')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
