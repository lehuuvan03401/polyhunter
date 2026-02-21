import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCopyTradingReadiness } from '@/lib/hooks/useCopyTradingReadiness';

const ACTION_LABELS: Record<string, string> = {
    ENABLE_REAL_TRADING: 'Enable real trading (set ENABLE_REAL_TRADING=true)',
    CREATE_PROXY: 'Create a proxy wallet in the dashboard',
    TOP_UP_WALLET_MATIC: 'Top up EOA MATIC for gas',
    DEPOSIT_PROXY_USDC: 'Deposit USDC.e to your Proxy wallet',
    APPROVE_USDC: 'Approve USDC spending for Executor',
    APPROVE_CTF: 'Approve CTF spending for Executor',
    CONFIGURE_EXECUTOR: 'Configure executor address (NEXT_PUBLIC_EXECUTOR_ADDRESS)',
    CONFIGURE_CTF: 'Configure CTF address (NEXT_PUBLIC_CTF_ADDRESS)',
};

const formatUsd = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '--';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatMatic = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '--';
    return `${value.toFixed(4)} MATIC`;
};

const formatAddress = (address?: string | null) => {
    if (!address) return '--';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function FundingStatusPanel({ walletAddress }: { walletAddress: string }) {
    const { readiness, isLoading, refresh } = useCopyTradingReadiness(walletAddress, { refreshInterval: 15000 });

    const actions = useMemo(() => readiness?.requiredActions || [], [readiness?.requiredActions]);
    const isReady = readiness?.ready && actions.length === 0;

    const copyAddress = (address?: string | null) => {
        if (!address) return;
        navigator.clipboard.writeText(address);
    };

    return (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    {isReady ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                        <div className="text-sm font-medium">Funding & Allowance Status</div>
                        <div className="text-xs text-muted-foreground">
                            {isLoading ? 'Checking readiness...' : (isReady ? 'Ready to trade' : 'Action required')}
                        </div>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => refresh()}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh
                </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Wallet (EOA)</span>
                        <button className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground" onClick={() => copyAddress(readiness?.walletAddress)}>
                            {formatAddress(readiness?.walletAddress)}
                            <Copy className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Wallet MATIC</span>
                        <span className={cn((readiness?.balances?.walletMatic || 0) < 0.1 ? 'text-amber-500' : 'text-foreground')}>
                            {formatMatic(readiness?.balances?.walletMatic)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Wallet USDC.e</span>
                        <span>{formatUsd(readiness?.balances?.walletUsdc)}</span>
                    </div>
                </div>

                <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Proxy Wallet</span>
                        <button className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground" onClick={() => copyAddress(readiness?.proxyAddress)}>
                            {formatAddress(readiness?.proxyAddress)}
                            <Copy className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Proxy USDC.e</span>
                        <span className={cn((readiness?.balances?.proxyUsdc || 0) < 1 ? 'text-amber-500' : 'text-foreground')}>
                            {formatUsd(readiness?.balances?.proxyUsdc)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">USDC Allowance</span>
                        <span className={cn(readiness?.allowances?.usdc?.allowed ? 'text-green-500' : 'text-amber-500')}>
                            {readiness?.allowances?.usdc?.allowed ? 'Approved' : 'Missing'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">CTF Approval</span>
                        <span className={cn(readiness?.allowances?.ctf?.allowed ? 'text-green-500' : 'text-amber-500')}>
                            {readiness?.allowances?.ctf?.allowed ? 'Approved' : 'Missing'}
                        </span>
                    </div>
                </div>
            </div>

            {!isReady && actions.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <div className="font-medium mb-1">Required actions</div>
                    <ul className="space-y-1">
                        {actions.map((action) => (
                            <li key={action}>• {ACTION_LABELS[action] || action}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
