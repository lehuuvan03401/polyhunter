'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ERC20_ABI, formatUSDC } from '@/lib/contracts/abis';
import { AlertTriangle, CheckCircle, Fuel, Gauge, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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

    // Hardcoded for demo/default, usually from ENV
    const FUNDER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Default hardhat deployer

    const [treasury, setTreasury] = useState<WalletStatus>({
        address: CONTRACT_ADDRESSES.amoy.treasury || '0xedEe4820327176Bd433d13421DD558A7191193Aa',
        maticBalance: 0,
        usdcBalance: 0,
        loading: false
    });

    const [funder, setFunder] = useState<WalletStatus>({
        address: FUNDER_ADDRESS,
        maticBalance: 0,
        usdcBalance: 0,
        loading: false
    });

    const [workers, setWorkers] = useState<WalletStatus[]>([
        { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', maticBalance: 0, usdcBalance: 0, loading: false }, // Sample Worker 1
        { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', maticBalance: 0, usdcBalance: 0, loading: false }, // Sample Worker 2
        { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', maticBalance: 0, usdcBalance: 0, loading: false }, // Sample Worker 3
    ]);

    const [newWorkerInput, setNewWorkerInput] = useState('');

    const getProvider = useCallback(async () => {
        const wallet = wallets[0];
        if (!wallet) return null;
        return await wallet.getEthereumProvider();
    }, [wallets]);

    const fetchBalances = useCallback(async () => {
        setIsLoading(true);
        console.log("Fetching balances...");

        try {
            const providerReq = await getProvider();
            if (!providerReq) {
                console.warn("No provider found");
                return;
            }
            const provider = new ethers.providers.Web3Provider(providerReq);
            const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.amoy.usdc || CONTRACT_ADDRESSES.localhost.usdc, ERC20_ABI, provider);

            // 1. Fetch Treasury
            const tMatic = await provider.getBalance(treasury.address);
            const tUsdc = await usdcContract.balanceOf(treasury.address);
            setTreasury(prev => ({
                ...prev,
                maticBalance: Number(ethers.utils.formatEther(tMatic)),
                usdcBalance: formatUSDC(tUsdc),
                loading: false
            }));

            // 2. Fetch Funder
            const fMatic = await provider.getBalance(funder.address);
            setFunder(prev => ({
                ...prev,
                maticBalance: Number(ethers.utils.formatEther(fMatic)),
                loading: false
            }));

            // 3. Fetch Workers
            const updatedWorkers = await Promise.all(workers.map(async (w) => {
                const wMatic = await provider.getBalance(w.address);
                return {
                    ...w,
                    maticBalance: Number(ethers.utils.formatEther(wMatic)),
                    loading: false
                };
            }));
            setWorkers(updatedWorkers);

            toast.success("System status updated");

        } catch (error) {
            console.error("Failed to fetch balances:", error);
            toast.error("Failed to fetch system status");
        } finally {
            setIsLoading(false);
        }
    }, [getProvider, treasury.address, funder.address, workers.length]); // Dependencies simplistic for demo

    // Initial fetch
    useEffect(() => {
        if (ready && authenticated && wallets.length > 0) {
            fetchBalances();
        }
    }, [ready, authenticated, wallets.length]);

    const handleAddWorker = () => {
        if (!ethers.utils.isAddress(newWorkerInput)) {
            toast.error("Invalid address");
            return;
        }
        if (workers.some(w => w.address.toLowerCase() === newWorkerInput.toLowerCase())) {
            toast.error("Worker already exists");
            return;
        }
        setWorkers(prev => [...prev, { address: newWorkerInput, maticBalance: 0, usdcBalance: 0, loading: true }]);
        setNewWorkerInput('');
        // Trigger fetch in next effect cycle or manually if needed, but dependecy array handles it partially, better to call fetch
        setTimeout(() => fetchBalances(), 100);
    };

    const handleRemoveWorker = (address: string) => {
        setWorkers(prev => prev.filter(w => w.address !== address));
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
                                System Gas Monitor
                            </h1>
                            <span className="px-3 py-1 rounded-full bg-blue-900/30 text-blue-400 text-xs font-mono border border-blue-800">
                                Network: {process.env.NEXT_PUBLIC_NETWORK || 'Localhost'}
                            </span>
                        </div>
                        <p className="text-gray-400">
                            Real-time monitoring of the "Gas Station" infrastructure.
                        </p>
                    </div>
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
            </div>
        </div>
    );
}
