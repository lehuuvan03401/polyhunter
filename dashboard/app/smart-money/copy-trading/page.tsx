'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, shortenAddress } from '@/lib/utils';
import { useSmartMoneyLeaderboard } from '@/lib/hooks/use-smart-money';

interface CopyTradingConfig {
    selectedWallets: string[];
    copyRatio: number;
    maxPerTrade: number;
    slippage: number;
    testMode: boolean;
    sideFilter: 'ALL' | 'BUY' | 'SELL';
}

interface TradeLog {
    id: string;
    timestamp: Date;
    type: 'detected' | 'executed' | 'skipped' | 'system';
    traderAddress: string;
    side?: 'BUY' | 'SELL';
    market?: string;
    amount?: number;
    price?: number;
    copyAmount?: number;
    message?: string;
}

export default function CopyTradingPage() {
    const { data: topTraders, isLoading: loadingTraders } = useSmartMoneyLeaderboard(20);
    const [isActive, setIsActive] = useState(false);
    const [logs, setLogs] = useState<TradeLog[]>([]);
    const [config, setConfig] = useState<CopyTradingConfig>({
        selectedWallets: [],
        copyRatio: 10,
        maxPerTrade: 100,
        slippage: 2,
        testMode: true,
        sideFilter: 'ALL',
    });
    const [stats, setStats] = useState({
        detected: 0,
        executed: 0,
        skipped: 0,
        totalPnL: 0,
        activeTime: 0,
    });

    // Simulate trade detection
    useEffect(() => {
        if (!isActive || config.selectedWallets.length === 0) return;

        const interval = setInterval(() => {
            if (Math.random() > 0.65) {
                const walletIndex = Math.floor(Math.random() * config.selectedWallets.length);
                const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
                const amount = Math.round(50 + Math.random() * 500);
                const price = 0.3 + Math.random() * 0.4;
                const markets = ['Bitcoin $100k by EOY', 'ETH to flip BTC', 'Trump wins 2024', 'Fed cuts rates'];

                const log: TradeLog = {
                    id: `${Date.now()}`,
                    timestamp: new Date(),
                    type: 'detected',
                    traderAddress: config.selectedWallets[walletIndex],
                    side: side as 'BUY' | 'SELL',
                    market: markets[Math.floor(Math.random() * markets.length)],
                    amount,
                    price,
                };

                setLogs(prev => [log, ...prev].slice(0, 30));
                setStats(prev => ({ ...prev, detected: prev.detected + 1 }));

                setTimeout(() => {
                    const copyAmount = amount * config.copyRatio / 100;
                    const shouldExecute =
                        (config.sideFilter === 'ALL' || config.sideFilter === side) &&
                        (copyAmount * price <= config.maxPerTrade);

                    if (shouldExecute) {
                        const execLog: TradeLog = {
                            ...log,
                            id: `${Date.now()}-exec`,
                            type: 'executed' as const,
                            copyAmount,
                            message: config.testMode ? '🧪 Test mode - simulated' : '✅ Order placed',
                        };
                        setLogs(prev => [execLog, ...prev].slice(0, 30));
                        setStats(prev => ({
                            ...prev,
                            executed: prev.executed + 1,
                            totalPnL: prev.totalPnL + (Math.random() - 0.4) * copyAmount,
                        }));
                    } else {
                        const skipLog: TradeLog = {
                            ...log,
                            id: `${Date.now()}-skip`,
                            type: 'skipped' as const,
                            message: 'Filtered by settings',
                        };
                        setLogs(prev => [skipLog, ...prev].slice(0, 30));
                        setStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
                    }
                }, 300);
            }
        }, 2500);

        const timeInterval = setInterval(() => {
            setStats(prev => ({ ...prev, activeTime: prev.activeTime + 1 }));
        }, 1000);

        return () => {
            clearInterval(interval);
            clearInterval(timeInterval);
        };
    }, [isActive, config]);

    const toggleWallet = useCallback((address: string) => {
        if (isActive) return;
        setConfig(prev => ({
            ...prev,
            selectedWallets: prev.selectedWallets.includes(address)
                ? prev.selectedWallets.filter(w => w !== address)
                : [...prev.selectedWallets, address]
        }));
    }, [isActive]);

    const handleStart = () => {
        if (config.selectedWallets.length === 0) return;
        setIsActive(true);
        setLogs([{
            id: 'start',
            timestamp: new Date(),
            type: 'system',
            traderAddress: '',
            message: `🚀 Started - Following ${config.selectedWallets.length} wallet(s)`,
        }]);
    };

    const handleStop = () => {
        setIsActive(false);
        setLogs(prev => [{
            id: 'stop',
            timestamp: new Date(),
            type: 'system',
            traderAddress: '',
            message: '⏹️ Stopped copy trading',
        }, ...prev]);
    };

    const formatTime = (s: number) =>
        `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-4 mb-1">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <span className="text-2xl">🤖</span>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-50">智能跟单交易</h1>
                                    <p className="text-slate-400 text-base">自动复制专业交易者操作</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/smart-money" className="text-slate-400 hover:text-slate-200 transition text-sm">
                                ← 排行榜
                            </Link>
                            <StatusBadge active={isActive} time={formatTime(stats.activeTime)} />
                        </div>
                    </div>
                </header>

                {/* Stats Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <MiniStat icon="⏱️" label="运行时间" value={formatTime(stats.activeTime)} active={isActive} />
                    <MiniStat icon="👁️" label="已检测" value={stats.detected.toString()} active={isActive} />
                    <MiniStat icon="⚡" label="已执行" value={stats.executed.toString()} active={isActive} highlight />
                    <MiniStat icon="⏭️" label="已跳过" value={stats.skipped.toString()} active={isActive} />
                    <MiniStat
                        icon="💰"
                        label="盈亏"
                        value={`${stats.totalPnL >= 0 ? '+' : ''}${formatCurrency(stats.totalPnL)}`}
                        active={isActive}
                        positive={stats.totalPnL >= 0}
                    />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Wallet Selection */}
                    <div className="lg:col-span-5">
                        <Card className="bg-slate-800/50 border-slate-700/30 backdrop-blur-sm h-full">
                            <CardHeader className="border-b border-slate-700/20 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-slate-50 text-lg">专业交易者钱包</CardTitle>
                                        <CardDescription className="text-slate-400 text-sm">
                                            选择要跟随的钱包
                                        </CardDescription>
                                    </div>
                                    <Badge variant="default" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                        {config.selectedWallets.length} 已选
                                    </Badge>                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {loadingTraders ? (
                                    <LoadingPlaceholder />
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {topTraders?.slice(0, 12).map((trader, i) => (
                                            <WalletRow
                                                key={trader.address}
                                                rank={i + 1}
                                                address={trader.address}
                                                pnl={trader.pnl}
                                                selected={config.selectedWallets.includes(trader.address)}
                                                onClick={() => toggleWallet(trader.address)}
                                                disabled={isActive}
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Middle: Settings */}
                    <div className="lg:col-span-4">
                        <Card className="bg-slate-800/50 border-slate-700/30 backdrop-blur-sm h-full">
                            <CardHeader className="border-b border-slate-700/20 pb-4">
                                <CardTitle className="text-slate-50 text-lg">跟单设置</CardTitle>
                                <CardDescription className="text-slate-400 text-sm">
                                    配置跟单参数和风险控制
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-6">
                                {/* Copy Ratio */}
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-300">跟单比例</span>
                                        <span className="text-slate-200 font-medium">{config.copyRatio}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        value={config.copyRatio}
                                        min={1}
                                        max={100}
                                        onChange={(e) => setConfig(p => ({ ...p, copyRatio: parseInt(e.target.value) }))}
                                        disabled={isActive}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>1%</span>
                                        <span>100%</span>
                                    </div>
                                </div>

                                {/* Max Per Trade */}
                                <div>
                                    <p className="text-slate-300 text-sm mb-2">单笔最大金额</p>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                        <input
                                            type="number"
                                            value={config.maxPerTrade}
                                            onChange={(e) => setConfig(p => ({ ...p, maxPerTrade: parseInt(e.target.value) || 0 }))}
                                            disabled={isActive}
                                            className="w-full pl-7 pr-4 py-3 bg-slate-700 border border-slate-600/50 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                {/* Slippage */}
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-300">滑点容忍度</span>
                                        <span className="text-slate-200 font-medium">{config.slippage}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        value={config.slippage}
                                        min={0.5}
                                        max={5}
                                        step={0.5}
                                        onChange={(e) => setConfig(p => ({ ...p, slippage: parseFloat(e.target.value) }))}
                                        disabled={isActive}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>0.5%</span>
                                        <span>5%</span>
                                    </div>
                                </div>

                                {/* Side Filter */}
                                <div>
                                    <p className="text-slate-300 text-sm mb-3">交易方向过滤</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['ALL', 'BUY', 'SELL'] as const).map(s => (
                                            <button
                                                key={s}
                                                onClick={() => !isActive && setConfig(p => ({ ...p, sideFilter: s }))}
                                                disabled={isActive}
                                                className={`py-2.5 rounded-lg text-sm font-medium transition ${config.sideFilter === s
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-slate-700 text-slate-400 border border-transparent hover:bg-slate-600'
                                                    } ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Test Mode */}
                                <div className="flex items-center justify-between p-3.5 bg-slate-700/50 rounded-lg">
                                    <div>
                                        <p className="text-slate-200 text-sm font-medium">测试模式</p>
                                        <p className="text-slate-500 text-xs">模拟交易，不实际下单</p>
                                    </div>
                                    <Toggle
                                        checked={config.testMode}
                                        onChange={() => !isActive && setConfig(p => ({ ...p, testMode: !p.testMode }))}
                                        disabled={isActive}
                                    />
                                </div>

                                {/* Action Button */}
                                <div className="pt-2">
                                    {isActive ? (
                                        <Button 
                                            variant="danger" 
                                            size="lg" 
                                            className="w-full py-6 text-base bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400"
                                            onClick={handleStop}
                                        >
                                            ⏹️ 停止跟单
                                        </Button>                                    ) : (
                                        <Button
                                            variant="primary"
                                            size="lg"
                                            className="w-full py-6 text-base bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20"
                                            onClick={handleStart}
                                            disabled={config.selectedWallets.length === 0}
                                        >
                                            🚀 开始跟单交易
                                        </Button>                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Execution Log */}
                    <div className="lg:col-span-3">
                        <Card className="bg-slate-800/50 border-slate-700/30 backdrop-blur-sm h-full">
                            <CardHeader className="border-b border-slate-700/20 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-slate-50 text-lg">实时活动</CardTitle>
                                        <CardDescription className="text-slate-400 text-sm">
                                            跟单操作日志
                                        </CardDescription>
                                    </div>
                                    {isActive && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                            <span className="text-rose-400 text-xs font-medium">运行中</span>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {logs.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 mx-auto rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
                                            <span className="text-2xl">📋</span>
                                        </div>
                                        <p className="text-slate-300 mb-1">暂无活动</p>
                                        <p className="text-slate-500 text-sm">开始跟单交易以查看实时事件</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {logs.map((log) => (
                                            <LogRow key={log.id} log={log} />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.3);
        }
      `}</style>
        </div>
    );
}

// Components
function StatusBadge({ active, time }: { active: boolean; time: string }) {
    return (
        <div className={`px-3.5 py-2 rounded-full flex items-center gap-2 ${active ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-700/50 border border-slate-600/50'
            }`}>
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className={`text-sm font-medium ${active ? 'text-emerald-400' : 'text-slate-400'}`}>
                {active ? `运行中 • ${time}` : '已停止'}
            </span>
        </div>
    );
}

function MiniStat({ icon, label, value, active, highlight, positive }: {
    icon: string; label: string; value: string; active: boolean; highlight?: boolean; positive?: boolean;
}) {
    return (
        <Card className={`p-4 transition-all ${active ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-700/20 bg-slate-800/30'
            }`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{icon}</span>
                <span className="text-slate-400 text-xs uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-xl font-bold ${positive !== undefined ? (positive ? 'text-emerald-400' : 'text-rose-400') :
                highlight ? 'text-emerald-400' : 'text-slate-200'
                }`}>{value}</p>
        </Card>
    );
}

function WalletRow({ rank, address, pnl, selected, onClick, disabled }: {
    rank: number; address: string; pnl: number; selected: boolean; onClick: () => void; disabled: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full p-3.5 rounded-xl flex items-center justify-between transition ${selected ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-700/30 border border-transparent hover:bg-slate-700/50'
                } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${rank <= 3 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900' : 'bg-slate-600 text-slate-300'
                    }`}>
                    {rank}
                </div>
                <div className="flex flex-col">
                    <span className="text-slate-200 font-mono text-sm">{shortenAddress(address)}</span>
                    <span className="text-slate-500 text-xs">#{rank} 位</span>
                </div>
            </div>
            <div className="text-right">
                <span className={`font-semibold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, 0)}
                </span>
                <div className={`w-2 h-2 rounded-full mt-1.5 ${pnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            </div>
        </button>
    );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled: boolean }) {
    return (
        <button
            onClick={onChange}
            disabled={disabled}
            className={`w-12 h-6 rounded-full p-0.5 transition ${checked ? 'bg-emerald-500' : 'bg-slate-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
    );
}

function LogRow({ log }: { log: TradeLog }) {
    const config = {
        detected: { border: 'border-blue-500/20', bg: 'bg-blue-500/5', icon: '👁️', color: 'text-blue-400' },
        executed: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', icon: '✅', color: 'text-emerald-400' },
        skipped: { border: 'border-amber-500/20', bg: 'bg-amber-500/5', icon: '⏭️', color: 'text-amber-400' },
        system: { border: 'border-slate-500/20', bg: 'bg-slate-500/5', icon: '💬', color: 'text-slate-400' },
    }[log.type];

    return (
        <div className={`p-3.5 rounded-xl border ${config.border} ${config.bg}`}>
            <div className="flex items-start gap-3">
                <span className={`text-lg ${config.color}`}>{config.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {log.side && (
                            <Badge variant={log.side === 'BUY' ? 'success' : 'danger'} className="text-xs">
                                {log.side}
                            </Badge>
                        )}                        {log.market && <span className="text-slate-200 text-sm truncate">{log.market}</span>}
                    </div>
                    {log.message && <p className="text-slate-400 text-xs">{log.message}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                    {log.copyAmount && (
                        <p className="text-emerald-400 text-sm font-medium">${(log.copyAmount * (log.price || 0)).toFixed(2)}</p>
                    )}
                    <p className="text-slate-500 text-xs">{log.timestamp.toLocaleTimeString()}</p>
                </div>
            </div>
        </div>
    );
}

function LoadingPlaceholder() {
    return (
        <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-700/20 rounded-xl animate-pulse" />
            ))}
        </div>
    );
}