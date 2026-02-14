'use client';

import * as React from 'react';
import { X, Settings, Filter, RefreshCcw, Copy, TrendingUp, AlertTriangle, Zap, Wallet, ShieldCheck, Fuel, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCopyTradingStore } from '@/lib/copy-trading-store';
import { usePrivy } from '@privy-io/react-auth';
import { useProxy } from '@/lib/contracts/useProxy';
import { useTranslations } from 'next-intl';

import { AgentTemplate } from '@/components/agents/agent-card';

interface CopyTraderModalProps {
    isOpen: boolean;
    onClose: () => void;
    traderAddress: string;
    traderName?: string;
    agentTemplate?: AgentTemplate | null;
}

type TabType = 'Mode' | 'Filters' | 'Sells';
type CopyMode = '% Shares' | 'Range' | 'Fixed $';
type SellMode = 'Same %' | 'Fixed Amount' | 'Custom %';

export function CopyTraderModal({ isOpen, onClose, traderAddress, traderName, agentTemplate }: CopyTraderModalProps) {
    const router = useRouter();
    const { user, authenticated } = usePrivy();
    const { hasProxy, stats, isExecutorAuthorized, isLoading: proxyLoading } = useProxy();
    const t = useTranslations('CopyTrader');
    const addConfig = useCopyTradingStore((state) => state.addConfig);
    const [isStarting, setIsStarting] = React.useState(false);

    // Calculate if user has enough in Proxy
    const proxyBalance = stats?.balance ?? 0;
    const minRequired = 5; // Minimum $5 to start copying
    const hasEnoughFunds = proxyBalance >= minRequired;

    const [activeTab, setActiveTab] = React.useState<TabType>('Mode');
    const [isAdvancedMode, setIsAdvancedMode] = React.useState(false); // Default to Simple Mode
    const [riskProfile, setRiskProfile] = React.useState<'Conservative' | 'Moderate' | 'Aggressive'>('Moderate');

    // Initialize state based on Agent Template if available
    const [copyMode, setCopyMode] = React.useState<CopyMode>('% Shares');
    const [sellMode, setSellMode] = React.useState<SellMode>('Same %');
    const [infiniteMode, setInfiniteMode] = React.useState(true); // Default ON for continuous copying

    // Form States
    const [sharePercent, setSharePercent] = React.useState('10'); // Default Moderate 10%
    const [takeProfit, setTakeProfit] = React.useState('');
    const [stopLoss, setStopLoss] = React.useState('');
    const [copyDirection, setCopyDirection] = React.useState<'Copy' | 'Counter'>('Copy');
    const [maxPerTrade, setMaxPerTrade] = React.useState('100');

    // Range Mode State
    const [rangeMin, setRangeMin] = React.useState('5');
    const [rangeMax, setRangeMax] = React.useState('50');

    // Fixed Mode State
    const [fixedAmount, setFixedAmount] = React.useState('50');

    // Effect to apply Agent Template settings when modal opens
    React.useEffect(() => {
        if (isOpen && agentTemplate) {
            // Map strategy profile
            const profileMap: Record<string, 'Conservative' | 'Moderate' | 'Aggressive'> = {
                'CONSERVATIVE': 'Conservative',
                'MODERATE': 'Moderate',
                'AGGRESSIVE': 'Aggressive'
            };
            if (agentTemplate.strategyProfile) {
                setRiskProfile(profileMap[agentTemplate.strategyProfile] || 'Moderate');
            }

            // Map other fields
            if (agentTemplate.sizeScale) setSharePercent((agentTemplate.sizeScale * 100).toString());
            if (agentTemplate.fixedAmount) setFixedAmount(agentTemplate.fixedAmount.toString());
            if (agentTemplate.maxSizePerTrade) setMaxPerTrade(agentTemplate.maxSizePerTrade.toString());
            if (agentTemplate.stopLoss) setStopLoss(agentTemplate.stopLoss.toString());
            if (agentTemplate.takeProfit) setTakeProfit(agentTemplate.takeProfit.toString());
            if (agentTemplate.mode === 'FIXED_AMOUNT') setCopyMode('Fixed $');

            // Filters
            if (agentTemplate.maxOdds) setMaxOdds((agentTemplate.maxOdds * 100).toString());
            if (agentTemplate.minLiquidity) setMinLiquidity(agentTemplate.minLiquidity.toString());
            if (agentTemplate.minVolume) setMinVolume(agentTemplate.minVolume.toString());
        }
    }, [isOpen, agentTemplate]);

    // Filter States - Default recommended values
    const [maxDaysOut, setMaxDaysOut] = React.useState('30');        // 30 days max
    const [maxPerMarket, setMaxPerMarket] = React.useState('500');   // $500 per market cap
    const [minLiquidity, setMinLiquidity] = React.useState('1000');  // $1000 min liquidity
    const [minVolume, setMinVolume] = React.useState('1000');        // $1000 min volume
    const [maxOdds, setMaxOdds] = React.useState('95');              // 95% max odds (Updated default)
    const [minTrigger, setMinTrigger] = React.useState('100');       // $100 min trigger size

    // Sell Mode States
    const [sellFixedAmount, setSellFixedAmount] = React.useState('25');
    const [sellPercentage, setSellPercentage] = React.useState('50');

    // Slippage State
    const [slippageMode, setSlippageMode] = React.useState<'FIXED' | 'AUTO'>('AUTO');
    const [maxSlippageInput, setMaxSlippageInput] = React.useState('2.0');

    // Auto Execution - Default ON (Hands-Free mode)
    const [autoExecute, setAutoExecute] = React.useState(true);

    // Execution Mode (Security vs Speed)
    const [executionMode, setExecutionMode] = React.useState<'PROXY' | 'EOA'>('PROXY');
    const [privateKeyInput, setPrivateKeyInput] = React.useState('');
    const [privateKeyError, setPrivateKeyError] = React.useState('');

    // Pure validation function for render-time check (no setState)
    const isValidPrivateKey = (key: string): boolean => {
        if (!key) return false;
        return /^0x[a-fA-F0-9]{64}$/.test(key);
    };

    // Validation with error state update (for onChange only)
    const handlePrivateKeyChange = (value: string) => {
        setPrivateKeyInput(value);
        if (!value) {
            setPrivateKeyError('');
        } else if (!isValidPrivateKey(value)) {
            setPrivateKeyError('Invalid format: must be 0x + 64 hex characters');
        } else {
            setPrivateKeyError('');
        }
    };

    // Check if start button should be disabled (pure, no setState)
    const isEOAInvalid = executionMode === 'EOA' && (!privateKeyInput || !isValidPrivateKey(privateKeyInput));


    const handleStartCopying = async () => {
        setIsStarting(true);
        try {
            // Get wallet address from Privy
            const walletAddress = user?.wallet?.address;

            if (!authenticated || !walletAddress) {
                throw new Error('Please connect your wallet first');
            }

            // Determine sell mode for API
            let apiSellMode = 'SAME_PERCENT';
            if (sellMode === 'Fixed Amount') apiSellMode = 'FIXED_AMOUNT';
            if (sellMode === 'Custom %') apiSellMode = 'CUSTOM_PERCENT';

            // Smart Defaults for Simple Mode
            let smartLiquidity = 1000;
            let smartOdds = 0.95;
            let smartVolume = 1000;

            if (!isAdvancedMode) {
                if (riskProfile === 'Conservative') {
                    smartLiquidity = 2000;
                    smartOdds = 0.85;
                } else if (riskProfile === 'Aggressive') {
                    smartLiquidity = 500;
                    smartOdds = 0.98;
                }
            }

            // Save to API for backend copy trading
            const apiResponse = await fetch('/api/copy-trading/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: walletAddress.toLowerCase(),
                    traderAddress,
                    traderName: traderName || `Trader ${traderAddress.slice(0, 6)}`,
                    // Mode settings - Simple Mode now uses Range (percentage with min/max caps)
                    mode: !isAdvancedMode ? 'percentage' : (copyMode === 'Fixed $' ? 'fixed_amount' : 'percentage'),
                    sizeScale: !isAdvancedMode ? Number(sharePercent) / 100 : ((copyMode === '% Shares' || copyMode === 'Range') ? Number(sharePercent) / 100 : undefined),
                    fixedAmount: !isAdvancedMode ? undefined : (copyMode === 'Fixed $' ? Number(fixedAmount) : undefined),
                    maxSizePerTrade: !isAdvancedMode ? (Number(maxPerTrade) || 100) : (copyMode === 'Range' ? Number(rangeMax) : (Number(maxPerTrade) || 100)),
                    minSizePerTrade: !isAdvancedMode ? 0.1 : (copyMode === 'Range' ? Number(rangeMin) : undefined),
                    // Advanced mode settings
                    infiniteMode: !isAdvancedMode ? true : infiniteMode,
                    takeProfit: takeProfit ? Number(takeProfit) : undefined,
                    stopLoss: stopLoss ? Number(stopLoss) : undefined,
                    direction: (!isAdvancedMode ? 'COPY' : (copyDirection === 'Counter' ? 'COUNTER' : 'COPY')),
                    // Filters
                    maxDaysOut: maxDaysOut ? Number(maxDaysOut) : undefined,
                    maxPerMarket: !isAdvancedMode ? undefined : (maxPerMarket ? Number(maxPerMarket) : undefined), // Unlimited in Simple Mode
                    minLiquidity: !isAdvancedMode ? smartLiquidity : (minLiquidity ? Number(minLiquidity) : undefined),
                    minVolume: !isAdvancedMode ? smartVolume : (minVolume ? Number(minVolume) : undefined),
                    maxOdds: !isAdvancedMode ? smartOdds : (maxOdds ? Number(maxOdds) / 100 : undefined),
                    minTriggerSize: minTrigger ? Number(minTrigger) : undefined,
                    // Sell strategy
                    sellMode: !isAdvancedMode ? 'SAME_PERCENT' : apiSellMode,
                    sellFixedAmount: sellMode === 'Fixed Amount' ? Number(sellFixedAmount) : undefined,
                    sellPercentage: sellMode === 'Custom %' ? Number(sellPercentage) / 100 : undefined,

                    // Slippage
                    slippageType: !isAdvancedMode ? 'AUTO' : slippageMode,
                    maxSlippage: Number(maxSlippageInput) || 2.0,

                    // Auto Execution
                    autoExecute,
                    channel: autoExecute ? 'EVENT_LISTENER' : 'POLLING',
                    // Execution Mode
                    executionMode,
                    privateKey: executionMode === 'EOA' ? privateKeyInput : undefined
                }),
            });

            if (!apiResponse.ok) {
                const err = await apiResponse.json();
                throw new Error(err.error || 'Failed to save config');
            }

            const responseData = await apiResponse.json();
            const createdConfig = responseData.config;

            // Also save to Zustand for local state
            addConfig({
                id: createdConfig.id, // Use the DB ID!
                traderAddress,
                traderName: traderName || `Trader ${traderAddress.slice(0, 6)}`,
                mode: copyMode === 'Fixed $' ? 'fixed_amount' : 'percentage',
                sizeScale: copyMode === '% Shares' ? Number(sharePercent) / 100 : undefined,
                fixedAmount: copyMode === 'Fixed $' ? Number(fixedAmount) : undefined,
                maxSizePerTrade: Number(maxPerTrade) || 100,
                sideFilter: undefined,
                dryRun: false, // Now using real backend!
                strategyProfile: 'MODERATE' // Default or grab from input if added to modal
            });

            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-medium">{t('toast.started')}</span>
                    <span className="text-xs text-muted-foreground">
                        {t('toast.following', { name: traderName || traderAddress.slice(0, 10) })}
                    </span>
                </div>
            );

            router.push('/portfolio');
        } catch (error) {
            console.error('Failed to start copy trading:', error);
            const errorMsg = error instanceof Error ? error.message : 'Please try again.';
            toast.error(t('toast.error', { error: errorMsg }));
        } finally {
            setIsStarting(false);
        }
    };

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
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                    <Copy className="h-5 w-5 text-blue-500" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-white leading-tight truncate">
                                        {t('title', { address: `${(traderAddress || '').slice(0, 6)}...${(traderAddress || '').slice(-4)}` })}
                                    </h2>
                                    <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{traderAddress}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                {/* Pro Mode Toggle */}
                                <div className="flex items-center gap-1 bg-[#25262b] rounded-lg p-1 border border-[#2c2d33]">
                                    <button
                                        onClick={() => setIsAdvancedMode(false)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5",
                                            !isAdvancedMode ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <Zap className="h-3 w-3" />
                                        {t('mode.simple')}
                                    </button>
                                    <button
                                        onClick={() => setIsAdvancedMode(true)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5",
                                            isAdvancedMode ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <Settings className="h-3 w-3" />
                                        {t('mode.pro')}
                                    </button>
                                </div>
                                <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Proxy Status Warning */}
                    {!proxyLoading && (!hasProxy || !hasEnoughFunds || !isExecutorAuthorized) && (
                        <div className="mx-4 mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div className="text-xs">
                                    {!hasProxy ? (
                                        <>
                                            <span className="text-yellow-400 font-medium">{t('warnings.proxyRequired')}</span>
                                            <p className="text-muted-foreground mt-1">
                                                {t('warnings.createProxy')}
                                                <a href="/dashboard/proxy" className="text-blue-400 ml-1 hover:underline">{t('warnings.setupProxy')}</a>
                                            </p>
                                        </>
                                    ) : !hasEnoughFunds ? (
                                        <>
                                            <span className="text-yellow-400 font-medium">{t('warnings.depositRequired')}</span>
                                            <p className="text-muted-foreground mt-1">
                                                {t('warnings.depositDesc', { balance: proxyBalance.toFixed(2), min: minRequired })}
                                                <a href="/dashboard/proxy" className="text-blue-400 ml-1 hover:underline">{t('warnings.depositLink')}</a>
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-yellow-400 font-medium">{t('warnings.botAuthRequired')}</span>
                                            <p className="text-muted-foreground mt-1">
                                                {t('warnings.authDesc')}
                                                <a href="/dashboard/proxy" className="text-blue-400 ml-1 hover:underline">{t('warnings.authLink')}</a>
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tabs (Only in Advanced Mode) */}
                    {isAdvancedMode && (
                        <div className="flex border-b border-white/5 bg-[#141517]">
                            {[
                                { id: 'Mode', label: t('tabs.mode'), icon: Settings },
                                { id: 'Filters', label: t('tabs.filters'), icon: Filter },
                                { id: 'Sells', label: t('tabs.sells'), icon: TrendingUp }
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
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Simple Mode Content */}
                    {!isAdvancedMode && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Simple Form: Range Mode (Proportional with Max Cap) */}
                            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-4">
                                {/* Preset Buttons */}
                                <div>
                                    <div className="text-xs font-bold text-white mb-2">{t('form.riskProfile')}</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => { setRiskProfile('Conservative'); setSharePercent('5'); setMaxPerTrade('50'); }}
                                            className={cn(
                                                "py-2 rounded-lg text-xs font-bold transition-colors",
                                                riskProfile === 'Conservative'
                                                    ? "bg-green-600 text-white"
                                                    : "bg-[#2c2d33] text-muted-foreground hover:bg-[#383a42] hover:text-white"
                                            )}
                                        >
                                            🛡️ {t('form.conservative')}
                                        </button>
                                        <button
                                            onClick={() => { setRiskProfile('Moderate'); setSharePercent('10'); setMaxPerTrade('100'); }}
                                            className={cn(
                                                "py-2 rounded-lg text-xs font-bold transition-colors",
                                                riskProfile === 'Moderate'
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[#2c2d33] text-muted-foreground hover:bg-[#383a42] hover:text-white"
                                            )}
                                        >
                                            ⚖️ {t('form.moderate')}
                                        </button>
                                        <button
                                            onClick={() => { setRiskProfile('Aggressive'); setSharePercent('20'); setMaxPerTrade('200'); }}
                                            className={cn(
                                                "py-2 rounded-lg text-xs font-bold transition-colors",
                                                riskProfile === 'Aggressive'
                                                    ? "bg-orange-600 text-white"
                                                    : "bg-[#2c2d33] text-muted-foreground hover:bg-[#383a42] hover:text-white"
                                            )}
                                        >
                                            🚀 {t('form.aggressive')}
                                        </button>
                                    </div>
                                </div>

                                {/* Two Column Inputs */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="text-xs font-bold text-white mb-1.5">{t('form.sharePercent')}</div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={sharePercent}
                                                onChange={(e) => setSharePercent(e.target.value)}
                                                className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-lg font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-white mb-1.5">{t('form.maxPerTrade')}</div>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</div>
                                            <input
                                                type="number"
                                                min="5"
                                                value={maxPerTrade}
                                                onChange={(e) => setMaxPerTrade(e.target.value)}
                                                className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg pl-6 pr-3 py-2.5 text-lg font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Explanation */}
                                <div className="text-xs text-muted-foreground bg-white/5 p-2.5 rounded-lg leading-relaxed">
                                    {t.rich('preview.text', {
                                        sharePercent: sharePercent,
                                        maxPerTrade: maxPerTrade,
                                        strong: (chunks) => <strong className="text-white">{chunks}</strong>
                                    })}
                                </div>
                            </div>

                            {/* Execution Mode Selector (Simple Mode) */}
                            <div className="space-y-3">
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5" /> {t('form.executionSpeed')}
                                </div>
                                <div className="grid grid-cols-2 gap-3 bg-[#25262b] p-1 rounded-xl border border-[#2c2d33]">
                                    <button
                                        onClick={() => setExecutionMode('PROXY')}
                                        className={cn(
                                            "py-2.5 rounded-lg text-sm font-bold flex flex-col items-center justify-center gap-1 transition-all",
                                            executionMode === 'PROXY'
                                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                                : "text-muted-foreground hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t('form.securityMode')}</div>
                                        <div className="text-[10px] font-normal opacity-80">{t('form.nonCustodial')}</div>
                                    </button>
                                    <button
                                        onClick={() => setExecutionMode('EOA')}
                                        className={cn(
                                            "py-2.5 rounded-lg text-sm font-bold flex flex-col items-center justify-center gap-1 transition-all",
                                            executionMode === 'EOA'
                                                ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                                                : "text-muted-foreground hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> {t('form.speedMode')}</div>
                                        <div className="text-[10px] font-normal opacity-80">{t('form.custodial')}</div>
                                    </button>
                                </div>

                                {/* Private Key Input for Speed Mode */}
                                {executionMode === 'EOA' && (
                                    <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                                            <div className="text-xs text-yellow-200/80 leading-relaxed">
                                                <b>{t('form.warning')}</b> {t('form.privateKeyWarning')}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-white mb-1.5">{t('form.privateKey')}</div>
                                            <input
                                                type="password"
                                                value={privateKeyInput}
                                                onChange={(e) => handlePrivateKeyChange(e.target.value)}
                                                placeholder={t('form.privateKeyPlaceholder')}
                                                className={cn(
                                                    "w-full bg-[#1a1b1e] border rounded-lg px-3 py-2.5 text-sm font-mono text-white focus:outline-none transition-colors placeholder:text-muted-foreground/30",
                                                    privateKeyError ? "border-red-500" : "border-yellow-500/30 focus:border-yellow-500"
                                                )}
                                            />
                                            {privateKeyError && (
                                                <div className="text-xs text-red-400 mt-1.5">{privateKeyError}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Auto Slippage Info (Simple Mode) */}
                            <div className="bg-[#25262b] border border-[#2c2d33] rounded-xl p-4 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-white flex items-center gap-2">
                                        <Zap className="h-3.5 w-3.5 text-blue-500" /> {t('form.slippageInfo')}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {t('form.slippageInfoDesc')}
                                    </div>
                                </div>
                                <div className="text-[10px] font-bold bg-blue-500/10 text-blue-500 px-2 py-1 rounded border border-blue-500/20">
                                    {t('form.auto')}
                                </div>
                            </div>

                            {/* Info Card: What happens? */}
                            <div className="bg-[#25262b] border border-[#2c2d33] rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-white font-bold text-sm">
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                    {t('preview.smartCopy')}
                                </div>
                                <div className="space-y-2 text-xs text-muted-foreground">
                                    <div className="flex items-start gap-2">
                                        <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5" />
                                        <span>
                                            {t.rich('preview.smartCopyPoints.1', {
                                                b: (chunks) => <b>{chunks}</b>
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5" />
                                        <span>
                                            {t.rich('preview.smartCopyPoints.2', {
                                                b: (chunks) => <b>{chunks}</b>
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5" />
                                        <span>
                                            {t.rich('preview.smartCopyPoints.3', {
                                                b: (chunks) => <b>{chunks}</b>
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2 pt-1 border-t border-white/5 mt-1">
                                        <RefreshCcw className="h-3 w-3 text-blue-500 mt-0.5" />
                                        <span className="font-medium text-blue-200">
                                            {t.rich('preview.continuousMode', {
                                                b: (chunks) => <b className="text-white">{chunks}</b>,
                                                default: "Continuous Copying Enabled" // Fallback if key missing
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Max Loss Protection */}
                            <div>
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    {t('form.maxLossProtection')}
                                </div>
                                <div className="bg-[#25262b] border border-[#2c2d33] rounded-xl p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-white mb-1.5">{t('form.autoStopLoss')}</div>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</div>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder={t('form.noLimit')}
                                                value={stopLoss}
                                                onChange={(e) => setStopLoss(e.target.value)}
                                                className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg pl-6 pr-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Trade Preview */}
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                                <div className="text-xs text-blue-300">
                                    {t.rich('preview.dynamicPreview', {
                                        amount1000: Math.min(Number(sharePercent) * 10, Number(maxPerTrade) || 100).toFixed(0),
                                        amount500: Math.min(Number(sharePercent) * 5, Number(maxPerTrade) || 100).toFixed(0),
                                        strong: (chunks) => <strong>${chunks}</strong>
                                    })}
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Content Scroll Area (Advanced Mode) */}
                    {isAdvancedMode && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">

                            {/* MODE TAB */}
                            {activeTab === 'Mode' && (
                                <>
                                    <div className="space-y-4">
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('form.copyMode')}</div>
                                        <div className="grid grid-cols-3 gap-3">
                                            {(['% Shares', 'Range', 'Fixed $'] as CopyMode[]).map((mode) => {
                                                const modeLabels: Record<CopyMode, string> = {
                                                    '% Shares': t('mode.shares'),
                                                    'Range': t('mode.range'),
                                                    'Fixed $': t('mode.fixed')
                                                };
                                                return (
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
                                                        <span className="text-xs font-medium">{modeLabels[mode]}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {copyMode === '% Shares' && (
                                            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-bold text-white">{t('form.sharePercent')}</span>
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
                                                    {t('form.sharePercent')}
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
                                                        <div className="text-xs font-bold text-white mb-1.5">{t('form.sharePercent')}</div>
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
                                                            <div className="text-xs font-bold text-white mb-1.5">{t('form.minPerTrade')}</div>
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
                                                            <div className="text-xs font-bold text-white mb-1.5">{t('form.maxPerTradeLabel')}</div>
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
                                                        {t('preview.rangeText', { sharePercent, rangeMin, rangeMax })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {copyMode === 'Fixed $' && (
                                            <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 space-y-3">
                                                <div>
                                                    <div className="text-xs font-bold text-white mb-1.5">{t('form.fixedAmountPerTrade')}</div>
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
                                                <div className="text-xs text-muted-foreground min-h-[32px] flex items-center">
                                                    {t('preview.fixedText', { fixedAmount })}
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['1', '5', '10', '25', '50', '100'].map((amount) => (
                                                        <button
                                                            key={amount}
                                                            onClick={() => setFixedAmount(amount)}
                                                            className={cn(
                                                                "h-9 w-full rounded-lg text-sm font-medium transition-colors flex items-center justify-center",
                                                                fixedAmount === amount ? "bg-green-600 text-white" : "bg-[#2c2d33] text-muted-foreground hover:bg-[#383a42] hover:text-white"
                                                            )}
                                                        >
                                                            ${amount}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="text-xs text-muted-foreground bg-white/5 p-2 rounded-lg">
                                                    {t('preview.example', { fixedAmount })}
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
                                                        <RefreshCcw className="h-3.5 w-3.5" /> {t('form.infiniteMode')}
                                                    </div>
                                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase">{t('form.recommended')}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground max-w-[240px]">
                                                    {t('preview.infiniteModeDesc')}
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
                                                <ShieldCheck className="h-3.5 w-3.5" /> {t('form.riskManagement')}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-[#25262b] border border-[#2c2d33] rounded-xl p-3 hover:border-green-500/30 transition-colors group">
                                                    <div className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-green-500" /> {t('form.takeProfit')}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder={t('form.noLimit')}
                                                        className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                                                    />
                                                    <div className="text-[10px] text-muted-foreground mt-1.5">{t('form.autoPauseProfit')}</div>
                                                </div>
                                                <div className="bg-[#25262b] border border-[#2c2d33] rounded-xl p-3 hover:border-red-500/30 transition-colors">
                                                    <div className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-red-500" /> {t('form.stopLoss')}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder={t('form.noLimit')}
                                                        className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                                                    />
                                                    <div className="text-[10px] text-muted-foreground mt-1.5">{t('form.autoPauseLoss')}</div>
                                                </div>
                                            </div>
                                        </div>


                                        {/* Slippage Settings */}
                                        <div>
                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <Zap className="h-3.5 w-3.5" /> {t('form.slippage')}
                                            </div>
                                            <div className="bg-[#25262b] border border-[#2c2d33] rounded-xl p-4 space-y-4">
                                                <div className="flex bg-[#1a1b1e] p-1 rounded-lg border border-[#2c2d33]">
                                                    <button
                                                        onClick={() => setSlippageMode('AUTO')}
                                                        className={cn(
                                                            "flex-1 py-1.5 text-xs font-bold rounded-md transition-colors",
                                                            slippageMode === 'AUTO' ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"
                                                        )}
                                                    >
                                                        {t('form.auto')}
                                                    </button>
                                                    <button
                                                        onClick={() => setSlippageMode('FIXED')}
                                                        className={cn(
                                                            "flex-1 py-1.5 text-xs font-bold rounded-md transition-colors",
                                                            slippageMode === 'FIXED' ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"
                                                        )}
                                                    >
                                                        {t('form.fixed')}
                                                    </button>
                                                </div>

                                                <div>
                                                    <div className="flex justify-between text-xs mb-1.5">
                                                        <span className="font-bold text-white">
                                                            {slippageMode === 'AUTO' ? t('form.maxAllowedSlippage') : t('form.fixedSlippage')} (%)
                                                        </span>
                                                        {slippageMode === 'AUTO' && (
                                                            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded flex items-center">
                                                                {t('form.recommended')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0.1"
                                                            step="0.1"
                                                            value={maxSlippageInput}
                                                            onChange={(e) => setMaxSlippageInput(e.target.value)}
                                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</div>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                                                        {slippageMode === 'AUTO'
                                                            ? t('preview.slippageAuto')
                                                            : t('preview.slippageFixed')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('form.direction')}</div>
                                            <div className="grid grid-cols-2 gap-3 bg-[#25262b] p-1 rounded-xl border border-[#2c2d33]">
                                                <button
                                                    onClick={() => setCopyDirection('Copy')}
                                                    className={cn(
                                                        "py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                                        copyDirection === 'Copy' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "text-muted-foreground hover:text-white"
                                                    )}
                                                >
                                                    <Copy className="h-3.5 w-3.5" /> {t('form.copy')}
                                                </button>
                                                <button
                                                    onClick={() => setCopyDirection('Counter')}
                                                    className={cn(
                                                        "py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                                        copyDirection === 'Counter' ? "bg-red-500/10 text-red-500 border border-red-500/20" : "text-muted-foreground hover:text-white"
                                                    )}
                                                >
                                                    <RefreshCcw className="h-3.5 w-3.5" /> {t('form.counter')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* FILTERS TAB */}
                            {activeTab === 'Filters' && (
                                <div className="space-y-4">
                                    {/* Max Days Out */}
                                    <div className="bg-[#25262b] border border-[#2c2d33] p-4 rounded-xl space-y-2">
                                        <label className="text-xs font-bold text-white">{t('form.maxDaysOut')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={t('form.noLimit')}
                                            value={maxDaysOut}
                                            onChange={(e) => setMaxDaysOut(e.target.value)}
                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <div className="text-[10px] text-muted-foreground leading-snug">{t('preview.maxDaysOutDesc')}</div>
                                    </div>

                                    {/* Max Per Market */}
                                    <div className="bg-[#25262b] border border-[#2c2d33] p-4 rounded-xl space-y-2">
                                        <label className="text-xs font-bold text-white">{t('form.maxPerMarket')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={t('form.noLimit')}
                                            value={maxPerMarket}
                                            onChange={(e) => setMaxPerMarket(e.target.value)}
                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <div className="text-[10px] text-muted-foreground leading-snug">{t('preview.maxPerMarketDesc')}</div>
                                    </div>

                                    {/* Min Liquidity */}
                                    <div className="bg-[#25262b] border border-[#2c2d33] p-4 rounded-xl space-y-2">
                                        <label className="text-xs font-bold text-white">{t('form.minLiquidity')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={t('form.noLimit')}
                                            value={minLiquidity}
                                            onChange={(e) => setMinLiquidity(e.target.value)}
                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <div className="text-[10px] text-muted-foreground leading-snug">{t('preview.minLiquidityDesc')}</div>
                                    </div>

                                    {/* Min Volume */}
                                    <div className="bg-[#25262b] border border-[#2c2d33] p-4 rounded-xl space-y-2">
                                        <label className="text-xs font-bold text-white">{t('form.minVolume')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={t('form.noLimit')}
                                            value={minVolume}
                                            onChange={(e) => setMinVolume(e.target.value)}
                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <div className="text-[10px] text-muted-foreground leading-snug">{t('preview.minVolumeDesc')}</div>
                                    </div>

                                    {/* Max Odds */}
                                    <div className="bg-[#25262b] border border-[#2c2d33] p-4 rounded-xl space-y-2">
                                        <label className="text-xs font-bold text-white">{t('form.maxOdds')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            placeholder={t('form.eg80')}
                                            value={maxOdds}
                                            onChange={(e) => setMaxOdds(e.target.value)}
                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <div className="text-[10px] text-muted-foreground leading-snug">{t('preview.maxOddsDesc')}</div>
                                    </div>

                                    {/* Min Trigger */}
                                    <div className="bg-[#25262b] border border-[#2c2d33] p-4 rounded-xl space-y-2">
                                        <label className="text-xs font-bold text-white">{t('form.minTrigger')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={t('form.noLimit')}
                                            value={minTrigger}
                                            onChange={(e) => setMinTrigger(e.target.value)}
                                            className="w-full bg-[#1a1b1e] border border-[#2c2d33] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <div className="text-[10px] text-muted-foreground leading-snug">{t('preview.minTriggerDesc')}</div>
                                    </div>
                                </div>
                            )}

                            {/* SELLS TAB */}
                            {activeTab === 'Sells' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                                        {t('sell.header')}
                                    </p>

                                    <button
                                        onClick={() => setSellMode('Same %')}
                                        className={cn("w-full text-left p-4 rounded-xl border transition-all space-y-1 block", sellMode === 'Same %' ? "bg-blue-600/10 border-blue-500" : "bg-[#25262b] border-[#2c2d33] hover:border-blue-500/30")}
                                    >
                                        <div className={cn("font-bold text-sm flex items-center gap-2", sellMode === 'Same %' ? "text-blue-400" : "text-white")}>
                                            <RefreshCcw className="h-4 w-4" /> {t('sell.samePercent')}
                                        </div>
                                        <div className="text-xs text-muted-foreground leading-relaxed">
                                            {t('sell.samePercentDesc')}
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setSellMode('Fixed Amount')}
                                        className={cn("w-full text-left p-4 rounded-xl border transition-all space-y-1 block", sellMode === 'Fixed Amount' ? "bg-green-600/10 border-green-500" : "bg-[#25262b] border-[#2c2d33] hover:border-green-500/30")}
                                    >
                                        <div className={cn("font-bold text-sm flex items-center gap-2", sellMode === 'Fixed Amount' ? "text-green-400" : "text-white")}>
                                            <div className="h-4 w-4 rounded-full border border-current flex items-center justify-center text-[10px]">$</div> {t('sell.fixedAmount')}
                                        </div>
                                        <div className="text-xs text-muted-foreground leading-relaxed">
                                            {t('sell.fixedAmountDesc')}
                                        </div>

                                        {sellMode === 'Fixed Amount' && (
                                            <div className="mt-3 pt-3 border-t border-green-500/20" onClick={e => e.stopPropagation()}>
                                                <div className="text-xs font-medium text-white mb-1.5">{t('sell.sellAmount')}</div>
                                                <div className="relative">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={sellFixedAmount}
                                                        onChange={(e) => setSellFixedAmount(e.target.value)}
                                                        className="w-full bg-[#1a1b1e] border border-green-500/30 rounded-lg pl-6 pr-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                                                        placeholder={t('form.eg25')}
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
                                            <Settings className="h-4 w-4" /> {t('sell.customPercent')}
                                        </div>
                                        <div className="text-xs text-muted-foreground leading-relaxed">
                                            {t('sell.customPercentDesc')}
                                        </div>

                                        {sellMode === 'Custom %' && (
                                            <div className="mt-3 pt-3 border-t border-purple-500/20" onClick={e => e.stopPropagation()}>
                                                <div className="text-xs font-medium text-white mb-1.5">{t('sell.sellPercentage')}</div>
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={sellPercentage}
                                                        onChange={(e) => setSellPercentage(e.target.value)}
                                                        className="w-full bg-[#1a1b1e] border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                                        placeholder={t('form.eg25')}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</div>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1.5">{t('sell.customPercentHelper')}</div>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Auto Execute Toggle - Persistent */}
                    <div className="px-4 pb-2 z-10 bg-[#1a1b1e]">
                        <div className={cn(
                            "p-3 rounded-xl border flex items-center justify-between transition-all",
                            autoExecute ? "border-yellow-500/50 bg-yellow-500/10" : "border-[#2c2d33] bg-[#25262b]"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg flex-shrink-0", autoExecute ? "bg-yellow-500/20 text-yellow-500" : "bg-[#1a1b1e] text-muted-foreground")}>
                                    <Zap className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className={cn("text-xs font-bold transition-colors", autoExecute ? "text-yellow-500" : "text-white")}>
                                            {t('form.handsFree')}
                                        </div>
                                        {autoExecute && <span className="text-[8px] uppercase tracking-wider font-bold bg-yellow-500 text-black px-1.5 rounded-sm">{t('form.beta')}</span>}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground leading-snug">
                                        {autoExecute ? t('form.handsFreeDesc') : t('form.manualDesc')}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setAutoExecute(!autoExecute)}
                                className={cn("w-10 h-6 rounded-full transition-colors relative flex items-center border flex-shrink-0", autoExecute ? "bg-yellow-500 border-yellow-500" : "bg-transparent border-white/20")}
                            >
                                <div className={cn("h-3.5 w-3.5 rounded-full bg-white transition-transform absolute shadow-sm", autoExecute ? "translate-x-5" : "translate-x-0.5")} />
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/5 bg-[#141517]">
                        <div className="flex justify-center gap-6 text-[10px] text-muted-foreground mb-3 font-medium">
                            <span className="flex items-center gap-1.5"><Fuel className="h-3 w-3" /> {t('footer.gas')}</span>
                            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-yellow-500" /> {t('footer.instant')}</span>
                            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-green-500" /> {t('footer.nonCustodial')}</span>
                        </div>

                        <div className="text-[10px] text-yellow-500 text-center mb-4 flex items-center justify-center gap-1.5 bg-yellow-500/5 py-1.5 rounded-lg border border-yellow-500/10">
                            <AlertTriangle className="h-3 w-3" />
                            {t('footer.minReq')}
                        </div>

                        <button
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 text-sm active:scale-[0.98] disabled:active:scale-100 flex items-center justify-center gap-2"
                            onClick={handleStartCopying}
                            disabled={isStarting || !hasProxy || !hasEnoughFunds || !isExecutorAuthorized || (executionMode === 'EOA' && (!privateKeyInput || !!privateKeyError))}
                        >
                            {isStarting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('form.starting')}
                                </>
                            ) : (
                                t('form.startCopying')
                            )}
                        </button>
                    </div>

                </motion.div>
            </div >
        </AnimatePresence >
    );
}
