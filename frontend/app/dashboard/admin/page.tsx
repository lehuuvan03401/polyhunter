'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ERC20_ABI, formatUSDC } from '@/lib/contracts/abis';
import { AlertTriangle, CheckCircle, Fuel, Gauge, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovePayoutDialog } from '@/components/admin/approve-payout-dialog';

// Configurable constants
const LOW_GAS_THRESHOLD = 2.0; // MATIC
const TARGET_GAS_LEVEL = 10.0; // MATIC

interface WalletStatus {
    address: string;
    maticBalance: number;
    usdcBalance: number; // Only for Treasury
    loading: boolean;
}

const GasGauge = ({ level, max = 20 }: { level: number; max?: number }) => {
    const percentage = Math.min((level / max) * 100, 100);
    // Green > 10, Yellow 2-10, Red < 2
    let color = 'bg-red-500';
    let textColor = 'text-red-400';

    if (level >= TARGET_GAS_LEVEL) {
        color = 'bg-green-500';
        textColor = 'text-green-400';
    } else if (level > LOW_GAS_THRESHOLD) {
        color = 'bg-yellow-500';
        textColor = 'text-yellow-400';
    }

    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-1">
                <span className={`text-2xl font-bold ${textColor}`}>{level.toFixed(4)} <span className="text-xs text-gray-500">MATIC</span></span>
                <span className="text-xs text-gray-500">{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {level < LOW_GAS_THRESHOLD && (
                <div className="flex items-center gap-1 mt-2 text-red-400 text-xs animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Low Fuel Warning</span>
                </div>
            )}
        </div>
    );
};

export default function AdminDashboardPage() {
    const { authenticated, ready } = usePrivy();
    const { wallets } = useWallets();
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'INFRA' | 'AFFILIATES' | 'PAYOUTS'>('INFRA');

    // --- PAYOUTS STATE ---
    const [payouts, setPayouts] = useState<any[]>([]);
    const [payoutFilter, setPayoutFilter] = useState<string>('PENDING');
    const [isPayoutsLoading, setIsPayoutsLoading] = useState(false);
    const [payoutsSummary, setPayoutsSummary] = useState({ pendingCount: 0, processingCount: 0, pendingTotal: 0 });
    const [txHashInput, setTxHashInput] = useState<{ [key: string]: string }>({});
    const [approvalDialog, setApprovalDialog] = useState<{ isOpen: boolean; payout: any | null }>({ isOpen: false, payout: null });

    // --- INFRASTRUCTURE STATE ---
    const [treasury, setTreasury] = useState<WalletStatus>({
        address: process.env.NEXT_PUBLIC_TREASURY_WALLET || '0xTreasury...',
        maticBalance: 145.20,
        usdcBalance: 5430.50,
        loading: false
    });
    const [funder, setFunder] = useState<WalletStatus>({
        address: process.env.NEXT_PUBLIC_FUNDER_WALLET || '0xFunder...',
        maticBalance: 8.5,
        usdcBalance: 0,
        loading: false
    });
    const [workers, setWorkers] = useState<WalletStatus[]>([
        { address: '0xWorker1...', maticBalance: 2.1, usdcBalance: 0, loading: false },
        { address: '0xWorker2...', maticBalance: 0.8, usdcBalance: 0, loading: false },
    ]);
    const [newWorkerInput, setNewWorkerInput] = useState('');

    const fetchBalances = useCallback(async () => {
        setIsLoading(true);
        // Mock fetch for infrastructure
        setTimeout(() => setIsLoading(false), 800);
    }, []);

    const handleAddWorker = () => {
        if (!newWorkerInput) return;
        setWorkers([...workers, { address: newWorkerInput, maticBalance: 0, usdcBalance: 0, loading: false }]);
        setNewWorkerInput('');
    };

    const handleRemoveWorker = (address: string) => {
        setWorkers(workers.filter(w => w.address !== address));
    };

    useEffect(() => {
        if (activeTab === 'INFRA') {
            fetchBalances();
        }
    }, [activeTab, fetchBalances]);

    // --- TABS & AFFILIATE MANAGER UPDATE ---


    const [affiliates, setAffiliates] = useState<any[]>([]);
    const [affiliatePage, setAffiliatePage] = useState(1);
    const [affiliateSearch, setAffiliateSearch] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [isAffiliateLoading, setIsAffiliateLoading] = useState(false);

    const fetchAffiliates = useCallback(async () => {
        setIsAffiliateLoading(true);
        try {
            // In a real app, sign a message or proper auth.
            // Here we rely on the wallet being connected and matching ENV allowlist on backend (mocked check).
            const res = await fetch(`/api/admin/affiliates?page=${affiliatePage}&search=${affiliateSearch}`, {
                headers: {
                    'x-admin-wallet': wallets[0]?.address || ''
                }
            });
            const data = await res.json();
            if (res.ok) {
                setAffiliates(data.data);
                setTotalPages(data.pagination.totalPages);
            } else {
                toast.error('Failed to load affiliates: ' + (data.error || 'Unknown'));
            }
        } catch (e) {
            toast.error('Network error loading affiliates');
        } finally {
            setIsAffiliateLoading(false);
        }
    }, [affiliatePage, affiliateSearch, wallets]);

    useEffect(() => {
        if (activeTab === 'AFFILIATES' && authenticated) {
            fetchAffiliates();
        }
    }, [activeTab, affiliatePage, authenticated]); // Search usually triggers via Enter or separate Effect with debounce

    // --- PAYOUTS FETCH ---
    const fetchPayouts = useCallback(async () => {
        setIsPayoutsLoading(true);
        try {
            const res = await fetch(`/api/admin/payouts?status=${payoutFilter}`, {
                headers: { 'x-admin-wallet': wallets[0]?.address || '' }
            });
            if (res.ok) {
                const data = await res.json();
                setPayouts(data.payouts || []);
                setPayoutsSummary(data.summary || { pendingCount: 0, processingCount: 0, pendingTotal: 0 });
            }
        } catch (e) {
            toast.error('Failed to load payouts');
        } finally {
            setIsPayoutsLoading(false);
        }
    }, [payoutFilter, wallets]);

    useEffect(() => {
        if (activeTab === 'PAYOUTS' && authenticated) {
            fetchPayouts();
        }
    }, [activeTab, payoutFilter, authenticated, fetchPayouts]);

    const handlePayoutAction = async (id: string, action: 'approve' | 'reject' | 'complete', txHash?: string) => {
        // Intercept approve action to show custom dialog
        if (action === 'approve') {
            const payout = payouts.find(p => p.id === id);
            if (payout) {
                setApprovalDialog({ isOpen: true, payout });
            }
            return;
        }

        const actionLabel = action === 'reject' ? 'Reject' : 'Complete';
        if (!window.confirm(`${actionLabel} this payout?`)) return;

        await processPayoutAction(id, action, txHash);
    };

    const processPayoutAction = async (id: string, action: 'approve' | 'reject' | 'complete', txHash?: string) => {
        const res = await fetch('/api/admin/payouts', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-wallet': wallets[0]?.address || ''
            },
            body: JSON.stringify({ id, action, txHash })
        });
        if (res.ok) {
            if (action !== 'approve') { // Approve toast is handled by dialog
                toast.success(`Payout ${action}d successfully`);
            }
            fetchPayouts();
        } else {
            const data = await res.json();
            throw new Error(data.error || 'Action failed');
        }
    };

    const handleTierUpdate = async (id: string, newTier: string) => {
        if (!window.confirm(`Force update tier to ${newTier}?`)) return;
        try {
            const res = await fetch('/api/admin/affiliates', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-wallet': wallets[0]?.address || ''
                },
                body: JSON.stringify({ id, tier: newTier })
            });
            if (res.ok) {
                toast.success('Tier updated successfully');
                fetchAffiliates();
            } else {
                toast.error('Update failed');
            }
        } catch (e) {
            toast.error('Network error');
        }
    };

    if (!ready || !authenticated) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <p className="text-gray-400">Please connect wallet to view admin dashboard.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Gauge className="w-8 h-8 text-blue-500" />
                                Admin Dashboard
                            </h1>
                            <span className="px-3 py-1 rounded-full bg-blue-900/30 text-blue-400 text-xs font-mono border border-blue-800">
                                {activeTab === 'INFRA' ? 'Infrastructure' : 'Affiliate Network'}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('INFRA')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'INFRA' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Infrastructure
                        </button>
                        <button
                            onClick={() => setActiveTab('AFFILIATES')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'AFFILIATES' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Affiliates
                        </button>
                        <button
                            onClick={() => { setActiveTab('PAYOUTS'); fetchPayouts(); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'PAYOUTS' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Payouts {payoutsSummary.pendingCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{payoutsSummary.pendingCount}</span>}
                        </button>
                    </div>
                </div>

                {activeTab === 'INFRA' ? (
                    // --- INFRASTRUCTURE VIEW (Existing Code) ---
                    <>
                        <div className="flex justify-end mb-6">
                            <button
                                onClick={fetchBalances}
                                disabled={isLoading}
                                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-400 transition-colors"
                                title="Refresh Data"
                            >
                                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* Treasury Card */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                                    Treasury (Revenue)
                                </h2>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">USDC Balance (Fees Collected)</p>
                                        <p className="text-3xl font-bold text-white">${treasury.usdcBalance.toLocaleString()}</p>
                                    </div>
                                    <div className="pt-4 border-t border-gray-800">
                                        <p className="text-sm text-gray-500 mb-2">MATIC Balance (Operational)</p>
                                        <GasGauge level={treasury.maticBalance} max={100} />
                                    </div>
                                    <div className="bg-gray-950 p-2 rounded text-xs font-mono text-gray-600 break-all">
                                        {treasury.address}
                                    </div>
                                </div>
                            </div>

                            {/* Funder Card */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Fuel className="w-5 h-5 text-yellow-500" />
                                    Funder Wallet (Gas Station)
                                </h2>
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-2">Fuel Level</p>
                                        <GasGauge level={funder.maticBalance} max={50} />
                                    </div>
                                    <div className="bg-gray-800/50 p-4 rounded-lg">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-400">Status</span>
                                            <span className="text-green-400 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> Online
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Auto-Topup</span>
                                            <span className="text-blue-400">Enabled</span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-950 p-2 rounded text-xs font-mono text-gray-600 break-all">
                                        {funder.address}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Worker Fleet Grid */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    Worker Fleet Status
                                </h2>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add Worker Address (0x...)"
                                        value={newWorkerInput}
                                        onChange={(e) => setNewWorkerInput(e.target.value)}
                                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-64"
                                    />
                                    <button
                                        onClick={handleAddWorker}
                                        className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {workers.map((worker) => (
                                    <div key={worker.address} className="bg-gray-950 border border-gray-800 p-4 rounded-lg relative group hover:border-gray-700 transition-colors">
                                        <button
                                            onClick={() => handleRemoveWorker(worker.address)}
                                            className="absolute top-2 right-2 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="mb-3">
                                            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1">Worker</p>
                                            <p className="text-gray-500 text-xs font-mono truncate">{worker.address}</p>
                                        </div>
                                        <GasGauge level={worker.maticBalance} max={20} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : activeTab === 'AFFILIATES' ? (
                    // --- AFFILIATE MANAGER VIEW ---
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <div className="flex justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Partner Management</h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Search wallet or code..."
                                    value={affiliateSearch}
                                    onChange={(e) => setAffiliateSearch(e.target.value)}
                                    // Trigger search on blur or provide button
                                    onBlur={() => { setAffiliatePage(1); fetchAffiliates(); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { setAffiliatePage(1); fetchAffiliates(); } }}
                                    className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white w-64"
                                />
                                <button onClick={fetchAffiliates} className="p-2 bg-gray-800 rounded-lg text-blue-400">
                                    <RefreshCw className={`w-5 h-5 ${isAffiliateLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-gray-500 uppercase bg-gray-950/50 border-b border-gray-800">
                                    <tr>
                                        <th className="px-6 py-3">User</th>
                                        <th className="px-6 py-3">Rank (Tier)</th>
                                        <th className="px-6 py-3 text-right">Volume</th>
                                        <th className="px-6 py-3 text-right">Team Size</th>
                                        <th className="px-6 py-3 text-right">Earnings</th>
                                        <th className="px-6 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {affiliates.map((aff) => (
                                        <tr key={aff.id} className="hover:bg-gray-800/50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white">{aff.referralCode}</div>
                                                <div className="text-xs text-gray-500 font-mono">{aff.walletAddress.slice(0, 6)}...{aff.walletAddress.slice(-4)}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${aff.tier === 'SUPER_PARTNER' ? 'bg-yellow-500/20 text-yellow-500' :
                                                    aff.tier === 'PARTNER' ? 'bg-purple-500/20 text-purple-500' :
                                                        aff.tier === 'ELITE' ? 'bg-blue-500/20 text-blue-500' :
                                                            'bg-gray-700 text-gray-300'
                                                    }`}>
                                                    {aff.tier}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                ${aff.totalVolume.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-purple-400">
                                                <div className="font-bold">{aff.teamSize}</div>
                                                <div className="text-xs text-gray-500">{aff.directReferrals} Direct</div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-green-400 font-mono">
                                                ${aff.totalEarned.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <select
                                                    className="bg-gray-950 border border-gray-800 rounded text-xs px-2 py-1 text-white"
                                                    value={aff.tier}
                                                    onChange={(e) => handleTierUpdate(aff.id, e.target.value)}
                                                >
                                                    <option value="ORDINARY">Ordinary</option>
                                                    <option value="VIP">VIP</option>
                                                    <option value="ELITE">Elite</option>
                                                    <option value="PARTNER">Partner</option>
                                                    <option value="SUPER_PARTNER">Super</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {affiliates.length === 0 && !isAffiliateLoading && (
                                <div className="text-center py-8 text-gray-500">No affiliates found</div>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                            <div>
                                Page {affiliatePage} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setAffiliatePage((p) => Math.max(1, p - 1))}
                                    disabled={affiliatePage === 1 || isAffiliateLoading}
                                    className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setAffiliatePage((p) => Math.min(totalPages, p + 1))}
                                    disabled={affiliatePage >= totalPages || isAffiliateLoading}
                                    className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'PAYOUTS' ? (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Payout Requests</h2>
                            <div className="flex gap-2">
                                {['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setPayoutFilter(status)}
                                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${payoutFilter === status
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-gray-800 rounded-lg p-4">
                                <p className="text-xs text-gray-400">Pending</p>
                                <p className="text-2xl font-bold text-yellow-400">{payoutsSummary.pendingCount}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4">
                                <p className="text-xs text-gray-400">Processing</p>
                                <p className="text-2xl font-bold text-blue-400">{payoutsSummary.processingCount}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4">
                                <p className="text-xs text-gray-400">Pending Total</p>
                                <p className="text-2xl font-bold text-green-400">${payoutsSummary.pendingTotal.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Payouts Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-700 text-gray-400">
                                        <th className="text-left py-3 px-2">Wallet</th>
                                        <th className="text-right py-3 px-2">Amount</th>
                                        <th className="text-center py-3 px-2">Status</th>
                                        <th className="text-left py-3 px-2">Requested</th>
                                        <th className="text-center py-3 px-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isPayoutsLoading ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-500">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                                            </td>
                                        </tr>
                                    ) : payouts.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-500">
                                                No payouts found
                                            </td>
                                        </tr>
                                    ) : payouts.map((payout) => (
                                        <tr key={payout.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                            <td className="py-3 px-2">
                                                <span className="font-mono text-xs text-white">{payout.walletAddress.slice(0, 10)}...</span>
                                                <span className="text-gray-500 text-xs ml-2">({payout.referralCode})</span>
                                            </td>
                                            <td className="text-right py-3 px-2 font-bold text-green-400">${payout.amount.toFixed(2)}</td>
                                            <td className="text-center py-3 px-2">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${payout.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    payout.status === 'PROCESSING' ? 'bg-blue-500/20 text-blue-400' :
                                                        payout.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                                                            'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {payout.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-gray-400 text-xs">
                                                {new Date(payout.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-2">
                                                <div className="flex justify-center gap-2">
                                                    {payout.status === 'PENDING' && (
                                                        <>
                                                            <button
                                                                onClick={() => handlePayoutAction(payout.id, 'approve')}
                                                                className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
                                                            >
                                                                ✓ Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handlePayoutAction(payout.id, 'reject')}
                                                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                                                            >
                                                                ✗ Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {payout.status === 'PROCESSING' && (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                placeholder="txHash..."
                                                                value={txHashInput[payout.id] || ''}
                                                                onChange={(e) => setTxHashInput({ ...txHashInput, [payout.id]: e.target.value })}
                                                                className="w-24 px-2 py-1 bg-gray-700 rounded text-xs text-white"
                                                            />
                                                            <button
                                                                onClick={() => handlePayoutAction(payout.id, 'complete', txHashInput[payout.id])}
                                                                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                                                                disabled={!txHashInput[payout.id]}
                                                            >
                                                                Complete
                                                            </button>
                                                        </div>
                                                    )}
                                                    {payout.status === 'COMPLETED' && payout.txHash && (
                                                        <a
                                                            href={`https://polygonscan.com/tx/${payout.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:underline text-xs"
                                                        >
                                                            View Tx
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}
            </div>

            <ApprovePayoutDialog
                isOpen={approvalDialog.isOpen}
                onClose={() => setApprovalDialog({ ...approvalDialog, isOpen: false })}
                payout={approvalDialog.payout}
                onConfirm={async () => {
                    if (approvalDialog.payout) {
                        await processPayoutAction(approvalDialog.payout.id, 'approve');
                        setApprovalDialog({ ...approvalDialog, isOpen: false });
                    }
                }}
            />
        </div>
    );
}
