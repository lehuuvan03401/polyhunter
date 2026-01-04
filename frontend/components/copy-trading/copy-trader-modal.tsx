'use client';

import * as React from 'react';
import { X, Settings, Filter, RefreshCcw, Copy, TrendingUp, AlertTriangle, Zap, Wallet, ShieldCheck, Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface CopyTraderModalProps {
    isOpen: boolean;
    onClose: () => void;
    traderAddress: string;
    traderName?: string;
}

import { useRouter } from 'next/navigation';

type TabType = 'Mode' | 'Filters' | 'Sells';
type CopyMode = '% Shares' | 'Range' | 'Fixed $';
type SellMode = 'Same %' | 'Fixed Amount' | 'Custom %';

export function CopyTraderModal({ isOpen, onClose, traderAddress, traderName }: CopyTraderModalProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = React.useState<TabType>('Mode');
    const [copyMode, setCopyMode] = React.useState<CopyMode>('% Shares');
    const [sellMode, setSellMode] = React.useState<SellMode>('Same %');
    const [infiniteMode, setInfiniteMode] = React.useState(false);

    // Form States
    const [sharePercent, setSharePercent] = React.useState('50');
    const [takeProfit, setTakeProfit] = React.useState('');
    const [stopLoss, setStopLoss] = React.useState('');
    const [copyDirection, setCopyDirection] = React.useState<'Copy' | 'Counter'>('Copy');

    // Range Mode State
    const [rangeMin, setRangeMin] = React.useState('2');
    const [rangeMax, setRangeMax] = React.useState('25');

    // Fixed Mode State
    const [fixedAmount, setFixedAmount] = React.useState('50');

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-[#1a1b1e] w-full max-w-md rounded-2xl border border-[#2c2d33] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 bg-[#1a1b1e]">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Copy className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white leading-tight">Copy {(traderAddress || '').slice(0, 6)}...{(traderAddress || '').slice(-4)}</h2>
                                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{traderAddress}</div>
                                </div>
                            </div>
                            <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/5 bg-[#141517]">
                        {[
                            { id: 'Mode', icon: Settings },
                            { id: 'Filters', icon: Filter },
                            { id: 'Sells', icon: TrendingUp } // Using TrendingUp as approximation for 'Sells' chart icon
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative",
                                    activeTab === tab.id ? "text-blue-500" : "text-muted-foreground hover:text-white hover:bg-white/5"
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.id}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">

                        {/* MODE TAB */}
                        {activeTab === 'Mode' && (
                            <>
                                <div className="space-y-4">
                                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Copy Mode</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['% Shares', 'Range', 'Fixed $'] as CopyMode[]).map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={() => setCopyMode(mode)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5",
                                                    copyMode === mode
                                                        ? "bg-blue-600/10 border-blue-500 text-blue-400"
                                                        : "bg-[#25262b] border-[#2c2d33] text-muted-foreground hover:border-white/20 hover:text-white"
                                                )}
                                            >
                                                {mode === '% Shares' && <RefreshCcw className="h-4 w-4" />}
                                                {mode === 'Range' && <AlertTriangle className="h-4 w-4" />} {/* Using AlertTriangle as placeholder icon */}
                                                {mode === 'Fixed $' && <div className="h-4 w-4 flex items-center justify-center font-bold text-xs border border-current rounded-full">$</div>}
                                                <span className="text-xs font-medium">{mode}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {copyMode === '% Shares' && (
                                        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-bold text-white">% of Trader&apos;s Shares</span>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={sharePercent}
                                                    onChange={(e) => setSharePercent(e.target.value)}
                                                    className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-4 py-3 text-lg font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">%</div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Buy {sharePercent}% of trader&apos;s shares each trade
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {['50%', '75%', '100%', '150%'].map((p) => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setSharePercent(p.replace('%', ''))}
                                                        className="py-1.5 rounded-lg bg-[#2c2d33] text-xs font-medium text-white hover:bg-[#383a42] transition-colors"
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {copyMode === 'Range' && (
                                        <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                                            <div className="space-y-3">
                                                <div>
                                                    <div className="text-xs font-bold text-white mb-1.5">% of Trader&apos;s Shares</div>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={sharePercent}
                                                            onChange={(e) => setSharePercent(e.target.value)}
                                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <div className="text-xs font-bold text-white mb-1.5">Min $ per Trade</div>
                                                        <div className="relative">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</div>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={rangeMin}
                                                                onChange={(e) => setRangeMin(e.target.value)}
                                                                className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg pl-6 pr-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-white mb-1.5">Max $ per Trade</div>
                                                        <div className="relative">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</div>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={rangeMax}
                                                                onChange={(e) => setRangeMax(e.target.value)}
                                                                className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg pl-6 pr-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground bg-white/5 p-2 rounded-lg">
                                                    Trade {sharePercent}% of trader&apos;s shares, clamped between ${rangeMin} and ${rangeMax}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {copyMode === 'Fixed $' && (
                                        <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 space-y-3">
                                            <div>
                                                <div className="text-xs font-bold text-white mb-1.5">Fixed Amount Per Trade</div>
                                                <div className="relative">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={fixedAmount}
                                                        onChange={(e) => setFixedAmount(e.target.value)}
                                                        className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg pl-6 pr-3 py-3 text-lg font-mono text-white focus:outline-none focus:border-green-500 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Every trade uses exactly ${fixedAmount}, regardless of trader&apos;s bet size
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {['10', '25', '50', '100'].map((amount) => (
                                                    <button
                                                        key={amount}
                                                        onClick={() => setFixedAmount(amount)}
                                                        className={cn(
                                                            "py-2 rounded-lg text-sm font-medium transition-colors",
                                                            fixedAmount === amount ? "bg-green-600 text-white" : "bg-[#2c2d33] text-muted-foreground hover:bg-[#383a42] hover:text-white"
                                                        )}
                                                    >
                                                        ${amount}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="text-xs text-muted-foreground bg-white/5 p-2 rounded-lg">
                                                Example: If trader buys $500, you still buy only ${fixedAmount}
                                            </div>
                                        </div>
                                    )}

                                    <div className={cn(
                                        "p-4 rounded-xl border flex items-center justify-between transition-colors",
                                        infiniteMode ? "border-green-500/30 bg-green-500/5" : "border-[#2c2d33] bg-[#25262b]"
                                    )}>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    <RefreshCcw className="h-3.5 w-3.5" /> Infinite Mode
                                                </div>
                                                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase">Recommended</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground max-w-[240px]">
                                                Copytrading normally stops indefinitely if you run out of funds, but Infinite Mode pauses and retries.
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setInfiniteMode(!infiniteMode)}
                                            className={cn("w-10 h-6 rounded-full transition-colors relative flex items-center border", infiniteMode ? "bg-green-500 border-green-500" : "bg-transparent border-white/20")}
                                        >
                                            <div className={cn("h-4 w-4 rounded-full bg-white transition-transform absolute", infiniteMode ? "translate-x-5" : "translate-x-0.5")} />
                                        </button>
                                    </div>

                                    <div>
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <ShieldCheck className="h-3.5 w-3.5" /> Risk Management
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-[#25262b] border border-[#2c2d33] rounded-xl p-3 hover:border-green-500/30 transition-colors group">
                                                <div className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-green-500" /> Take Profit ($)
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="No limit"
                                                    className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                                                />
                                                <div className="text-[10px] text-muted-foreground mt-1.5">Auto-pause at this profit</div>
                                            </div>
                                            <div className="bg-[#25262b] border border-[#2c2d33] rounded-xl p-3 hover:border-red-500/30 transition-colors">
                                                <div className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-red-500" /> Stop Loss ($)
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="No limit"
                                                    className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                                                />
                                                <div className="text-[10px] text-muted-foreground mt-1.5">Auto-pause at this loss</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Direction</div>
                                        <div className="grid grid-cols-2 gap-3 bg-[#25262b] p-1 rounded-xl border border-[#2c2d33]">
                                            <button
                                                onClick={() => setCopyDirection('Copy')}
                                                className={cn(
                                                    "py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                                    copyDirection === 'Copy' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "text-muted-foreground hover:text-white"
                                                )}
                                            >
                                                <Copy className="h-3.5 w-3.5" /> Copy
                                            </button>
                                            <button
                                                onClick={() => setCopyDirection('Counter')}
                                                className={cn(
                                                    "py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                                    copyDirection === 'Counter' ? "bg-red-500/10 text-red-500 border border-red-500/20" : "text-muted-foreground hover:text-white"
                                                )}
                                            >
                                                <RefreshCcw className="h-3.5 w-3.5" /> Counter
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* FILTERS TAB */}
                        {activeTab === 'Filters' && (
                            <div className="space-y-4">
                                {[
                                    { label: 'Max Days Out', desc: 'Only copy trades on markets ending within X days', icon: '📅' },
                                    { label: 'Max Per Market ($)', desc: 'Limit total investment per market to prevent over-exposure', icon: '⏱️' },
                                    { label: 'Min Liquidity ($)', desc: 'Only copy trades on markets with sufficient liquidity', icon: '💧' },
                                    { label: 'Min Volume ($)', desc: 'Require minimum trading volume for active markets', icon: '📊' },
                                    { label: 'Max Odds (%)', desc: 'Avoid copying trades on very likely outcomes (e.g., 80 = skip trades above 80%)', icon: '🎯', placeholder: 'e.g. 80' },
                                    { label: 'Min Trigger ($)', desc: 'Minimum amount trader must trade to trigger your copy', icon: '⚡' }
                                ].map((filter, i) => (
                                    <div key={i} className="bg-[#25262b] border border-[#2c2d33] p-4 rounded-xl space-y-2">
                                        <label className="text-xs font-bold text-white flex items-center gap-2">
                                            {/* <span className="text-base">{filter.icon}</span>  */}
                                            {filter.label}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={filter.placeholder || "No limit"}
                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <div className="text-[10px] text-muted-foreground leading-snug">{filter.desc}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* SELLS TAB */}
                        {activeTab === 'Sells' && (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                                    Configure how your copy trades handle sell orders.
                                </p>

                                <button
                                    onClick={() => setSellMode('Same %')}
                                    className={cn("w-full text-left p-4 rounded-xl border transition-all space-y-1 block", sellMode === 'Same %' ? "bg-blue-600/10 border-blue-500" : "bg-[#25262b] border-[#2c2d33] hover:border-blue-500/30")}
                                >
                                    <div className={cn("font-bold text-sm flex items-center gap-2", sellMode === 'Same %' ? "text-blue-400" : "text-white")}>
                                        <RefreshCcw className="h-4 w-4" /> Same % as Trader
                                    </div>
                                    <div className="text-xs text-muted-foreground leading-relaxed">
                                        When trader sells 20% of their position, you sell 20% of yours. Recommended setting.
                                    </div>
                                </button>

                                <button
                                    onClick={() => setSellMode('Fixed Amount')}
                                    className={cn("w-full text-left p-4 rounded-xl border transition-all space-y-1 block", sellMode === 'Fixed Amount' ? "bg-green-600/10 border-green-500" : "bg-[#25262b] border-[#2c2d33] hover:border-green-500/30")}
                                >
                                    <div className={cn("font-bold text-sm flex items-center gap-2", sellMode === 'Fixed Amount' ? "text-green-400" : "text-white")}>
                                        <div className="h-4 w-4 rounded-full border border-current flex items-center justify-center text-[10px]">$</div> Fixed Amount
                                    </div>
                                    <div className="text-xs text-muted-foreground leading-relaxed">
                                        Always sell a fixed dollar amount when trader sells
                                    </div>

                                    {sellMode === 'Fixed Amount' && (
                                        <div className="mt-3 pt-3 border-t border-green-500/20" onClick={e => e.stopPropagation()}>
                                            <div className="text-xs font-medium text-white mb-1.5">Sell Amount</div>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-full bg-[#1a1b1e] border border-green-500/30 rounded-lg pl-6 pr-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                                                    placeholder="25"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={() => setSellMode('Custom %')}
                                    className={cn("w-full text-left p-4 rounded-xl border transition-all space-y-1 block", sellMode === 'Custom %' ? "bg-purple-600/10 border-purple-500" : "bg-[#25262b] border-[#2c2d33] hover:border-purple-500/30")}
                                >
                                    <div className={cn("font-bold text-sm flex items-center gap-2", sellMode === 'Custom %' ? "text-purple-400" : "text-white")}>
                                        <Settings className="h-4 w-4" /> Custom % of Position
                                    </div>
                                    <div className="text-xs text-muted-foreground leading-relaxed">
                                        Sell a custom percentage of your position when trader sells any amount
                                    </div>

                                    {sellMode === 'Custom %' && (
                                        <div className="mt-3 pt-3 border-t border-purple-500/20" onClick={e => e.stopPropagation()}>
                                            <div className="text-xs font-medium text-white mb-1.5">Sell Percentage</div>
                                            <div className="relative flex items-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    className="w-full bg-[#1a1b1e] border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                                    placeholder="25"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</div>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-1.5">Always sell X% when they sell any amount</div>
                                        </div>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/5 bg-[#141517]">
                        <div className="flex justify-center gap-6 text-[10px] text-muted-foreground mb-3 font-medium">
                            <span className="flex items-center gap-1.5"><Fuel className="h-3 w-3" /> Gas sponsored</span>
                            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-yellow-500" /> Instant</span>
                            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-green-500" /> Non-custodial</span>
                        </div>

                        <div className="text-[10px] text-yellow-500 text-center mb-4 flex items-center justify-center gap-1.5 bg-yellow-500/5 py-1.5 rounded-lg border border-yellow-500/10">
                            <AlertTriangle className="h-3 w-3" />
                            Min 5 shares and/or $1 per order required
                        </div>

                        <button
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 text-sm active:scale-[0.98]"
                            onClick={() => {
                                const newCopyCtx = {
                                    traderAddress,
                                    traderName: traderName || `Trader ${traderAddress.slice(0, 4)}`,
                                    activeTab,
                                    mode: copyMode === 'Fixed $' ? 'fixed_amount' : 'percentage',
                                    fixedAmount: copyMode === 'Fixed $' ? fixedAmount : undefined,
                                    sharePercent: copyMode === '% Shares' ? sharePercent : undefined,
                                    timestamp: Date.now()
                                };

                                // Save to local storage for simulation
                                try {
                                    const existing = JSON.parse(localStorage.getItem('active_copies') || '[]');
                                    // Remove if already exists to update
                                    const filtered = existing.filter((c: any) => c.traderAddress !== traderAddress);
                                    filtered.push(newCopyCtx);
                                    localStorage.setItem('active_copies', JSON.stringify(filtered));

                                    // Redirect to portfolio to show user it worked
                                    router.push('/portfolio');
                                } catch (e) {
                                    console.error("Failed to save copy config", e);
                                    onClose();
                                }
                            }}
                        >
                            Start Copying
                        </button>
                    </div>

                </motion.div>
            </div>
        </AnimatePresence>
    );
}
