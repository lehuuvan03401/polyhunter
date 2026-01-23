
'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { polyClient } from '@/lib/polymarket';
import type { Trade } from '@catalyst-team/poly-sdk'; // Ensure this is exported or mock it if needed
import { cn } from '@/lib/utils'; // Assuming this exists based on other files

interface LeaderHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    leaderAddress: string;
    leaderName?: string;
}

export function LeaderHistoryModal({ isOpen, onClose, leaderAddress, leaderName }: LeaderHistoryModalProps) {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && leaderAddress) {
            fetchHistory();
        }
    }, [isOpen, leaderAddress]);

    const fetchHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch trades for the leader
            const history = await polyClient.dataApi.getTradesByUser(leaderAddress, { limit: 50 });
            setTrades(history);
        } catch (err) {
            console.error("Failed to fetch leader history", err);
            setError("Failed to load history. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f111a] shadow-2xl ring-1 ring-white/5"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Trade History</h3>
                                <p className="text-xs text-muted-foreground font-mono">
                                    {leaderName || `${leaderAddress.slice(0, 6)}...${leaderAddress.slice(-4)}`}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full py-12 space-y-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                    <p className="text-sm text-muted-foreground">Loading specific trades...</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center h-full py-12 space-y-3 text-red-400">
                                    <p>{error}</p>
                                    <button
                                        onClick={fetchHistory}
                                        className="text-xs underline hover:text-red-300"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : trades.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                                    <p>No recent trades found for this user.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {trades.map((trade, i) => (
                                        <div
                                            key={trade.transactionHash + i}
                                            className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex items-center justify-between gap-3"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                                                        trade.side === 'BUY' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                    )}>
                                                        {trade.side}
                                                    </span>
                                                    <span className="text-xs font-medium text-white truncate max-w-[200px]" title={trade.title || trade.market}>
                                                        {trade.title || trade.market || 'Unknown Market'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <span className="font-medium text-foreground">{trade.outcome}</span>
                                                    <span>•</span>
                                                    <span className="font-mono">{new Date(trade.timestamp * 1000).toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-mono font-medium text-white">
                                                    {trade.size.toFixed(2)} shares
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    @ ${trade.price.toFixed(2)}
                                                </div>
                                            </div>

                                            <div className="shrink-0">
                                                <a
                                                    href={`https://polygonscan.com/tx/${trade.transactionHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 block text-muted-foreground hover:text-blue-400 transition-colors"
                                                    title="View on PolygonScan"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
