'use client';

/**
 * useProxy Hook
 * 
 * React hook for interacting with Horus proxy contracts
 * Uses Privy wallet provider for transaction signing
 */

import { useState, useCallback, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import {
    CONTRACT_ADDRESSES,
    PROXY_FACTORY_ABI,
    POLY_HUNTER_PROXY_ABI,
    ERC20_ABI,
    USDC_DECIMALS,
    parseUSDC,
    formatUSDC,
    TIERS,
    type TierName,
} from './abis';

export { TIERS, type TierName };

// Network to use
const rawNetwork = process.env.NEXT_PUBLIC_NETWORK || 'amoy';
const NETWORK = (rawNetwork === 'polygon' || rawNetwork === 'localhost') ? rawNetwork : 'amoy';
const ADDRESSES = CONTRACT_ADDRESSES[NETWORK];

// Chain Config
const ENV_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '');
const DEFAULT_CHAIN_IDS = { polygon: 137, localhost: 1337, amoy: 80002 };
const TARGET_CHAIN_ID = ENV_CHAIN_ID || DEFAULT_CHAIN_IDS[NETWORK];

/**
 * Parse blockchain/wallet errors into user-friendly messages
 */
function parseTransactionError(err: unknown): string {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const lowerMessage = errorMessage.toLowerCase();

    // User rejected transaction
    if (
        lowerMessage.includes('user rejected') ||
        lowerMessage.includes('user denied') ||
        lowerMessage.includes('action_rejected') ||
        lowerMessage.includes('user cancelled') ||
        lowerMessage.includes('rejected the request')
    ) {
        return 'Transaction cancelled by user';
    }

    // Insufficient funds
    if (
        lowerMessage.includes('insufficient funds') ||
        lowerMessage.includes('insufficient balance')
    ) {
        return 'Insufficient funds for transaction';
    }

    // Gas estimation failed
    if (lowerMessage.includes('gas required exceeds')) {
        return 'Transaction would fail - please check your balance';
    }

    // Network issues
    if (
        lowerMessage.includes('network') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('disconnected')
    ) {
        return 'Network error - please check your connection';
    }

    // Wrong network
    if (lowerMessage.includes('chain') || lowerMessage.includes('network mismatch')) {
        return 'Please switch to Polygon Amoy network';
    }

    // Contract errors
    if (lowerMessage.includes('execution reverted')) {
        // Try to extract reason
        const reasonMatch = errorMessage.match(/reason="([^"]+)"/);
        if (reasonMatch) {
            return `Transaction failed: ${reasonMatch[1]}`;
        }
        return 'Transaction failed - contract rejected the request';
    }

    // Generic fallback - truncate long messages
    if (errorMessage.length > 100) {
        return 'Transaction failed. Please try again.';
    }

    return errorMessage;
}

export interface ProxyStats {
    balance: number;
    deposited: number;
    withdrawn: number;
    feesPaid: number;
    profit: number;
    feePercent: number;
    pendingFee: number;
}

export interface UseProxyReturn {
    // State
    proxyAddress: string | null;
    hasProxy: boolean;
    stats: ProxyStats | null;
    usdcBalance: number;
    isLoading: boolean;
    error: string | null;

    // Actions
    createProxy: (tier?: TierName) => Promise<string | null>;
    deposit: (amount: number) => Promise<boolean>;
    withdraw: (amount: number) => Promise<boolean>;
    withdrawAll: () => Promise<boolean>;
    refreshStats: () => Promise<void>;
    settleFees: () => Promise<boolean>;
    approveUSDC: (amount: number) => Promise<boolean>;
    /** Execute arbitrary call through proxy (for trading) */
    executeCall: (target: string, data: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
    /** Authorize an operator */
    authorizeOperator: (operator: string, active: boolean) => Promise<{ success: boolean; txHash?: string; error?: string }>;

    // Transaction state
    txPending: boolean;
    txStatus: 'IDLE' | 'APPROVING' | 'DEPOSITING' | 'WITHDRAWING' | 'AUTHORIZING' | 'CREATING' | 'EXECUTING' | 'CONFIRMING' | 'SETTLING';
    txHash: string | null;
    isExecutorAuthorized: boolean;
}

export function useProxy(): UseProxyReturn {
    const { user, authenticated } = usePrivy();
    const { wallets } = useWallets();

    const [proxyAddress, setProxyAddress] = useState<string | null>(null);
    const [hasProxy, setHasProxy] = useState(false);
    const [stats, setStats] = useState<ProxyStats | null>(null);
    const [usdcBalance, setUsdcBalance] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [txPending, setTxPending] = useState(false);
    const [txStatus, setTxStatus] = useState<UseProxyReturn['txStatus']>('IDLE');
    const [txHash, setTxHash] = useState<string | null>(null);
    const [isExecutorAuthorized, setIsExecutorAuthorized] = useState(false);

    const walletAddress = user?.wallet?.address;

    /**
     * Target chain ID based on network setting
     */
    const targetChainId = TARGET_CHAIN_ID;

    /**
     * Switch wallet to the correct network
     */
    const ensureCorrectNetwork = useCallback(async () => {
        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
        const externalWallet = wallets.find(w => w.walletClientType !== 'privy');
        const wallet = externalWallet || embeddedWallet;

        if (!wallet) {
            throw new Error('No wallet connected');
        }

        let provider;
        try {
            provider = await wallet.getEthereumProvider();
        } catch (err) {
            // Wallet exists but not connected yet - silently fail
            throw new Error('Wallet not ready');
        }

        // Check current chain
        const currentChainId = await provider.request({ method: 'eth_chainId' });
        const currentChainIdNum = parseInt(currentChainId as string, 16);

        if (currentChainIdNum !== targetChainId) {
            console.log(`Switching from chain ${currentChainIdNum} to ${targetChainId}`);

            try {
                // Try to switch to the target network
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${targetChainId.toString(16)}` }],
                });
            } catch (switchError: unknown) {
                // If the chain hasn't been added to MetaMask, add it
                const error = switchError as { code?: number };
                if (error.code === 4902) {
                    let networkParams;
                    if (targetChainId === 137) {
                        networkParams = {
                            chainId: '0x89',
                            chainName: 'Polygon Mainnet',
                            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                            rpcUrls: ['https://polygon-rpc.com'],
                            blockExplorerUrls: ['https://polygonscan.com'],
                        };
                    } else if (targetChainId === 31337 || targetChainId === 1337) {
                        networkParams = {
                            chainId: `0x${targetChainId.toString(16)}`,
                            chainName: 'Localhost',
                            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                            rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'],
                        };
                    } else {
                        networkParams = {
                            chainId: '0x13882',
                            chainName: 'Polygon Amoy Testnet',
                            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                            rpcUrls: ['https://rpc-amoy.polygon.technology'],
                            blockExplorerUrls: ['https://amoy.polygonscan.com'],
                        };
                    }

                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [networkParams],
                    });
                } else {
                    throw switchError;
                }
            }
        }

        return provider;
    }, [wallets, targetChainId]);

    /**
     * Get ethers provider and signer from Privy wallet
     */
    const getSignerAndProvider = useCallback(async () => {
        // Ensure we're on the correct network first
        const rawProvider = await ensureCorrectNetwork();

        const ethersProvider = new ethers.providers.Web3Provider(rawProvider);
        const signer = ethersProvider.getSigner();

        return { provider: ethersProvider, signer };
    }, [ensureCorrectNetwork]);

    /**
     * Fetch user's proxy address and check if they have one
     */
    const fetchProxyAddress = useCallback(async () => {
        if (!walletAddress || !ADDRESSES.proxyFactory) {
            setHasProxy(false);
            setProxyAddress(null);
            return null;
        }

        // Check if wallet is available and authenticated before trying to get provider
        if (wallets.length === 0 || !authenticated) {
            return null;
        }

        try {
            const { provider } = await getSignerAndProvider();
            const factory = new ethers.Contract(ADDRESSES.proxyFactory, PROXY_FACTORY_ABI, provider);

            const address = await factory.getUserProxy(walletAddress);
            const exists = address !== ethers.constants.AddressZero;

            setHasProxy(exists);
            setProxyAddress(exists ? address : null);
            return exists ? address : null;
        } catch (err: any) {
            // Only log unexpected errors, not wallet connection issues
            if (err?.message !== 'Wallet not ready' && err?.message !== 'No wallet connected') {
                console.error('Error fetching proxy address:', err);
            }
            return null;
        }
    }, [walletAddress, wallets, authenticated, getSignerAndProvider]);

    /**
     * Fetch proxy stats from contract
     */
    const refreshStats = useCallback(async () => {
        if (!proxyAddress) return;

        try {
            const { provider } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, provider);

            const promises: Promise<any>[] = [
                proxy.getStats(),
                provider.getBalance(proxyAddress), // ETH balance (for gas if needed)
            ];

            // Check if Default Executor is authorized
            if (ADDRESSES.executor) {
                promises.push(proxy.operators(ADDRESSES.executor));
            }

            const results = await Promise.all(promises);
            const statsResult = results[0];
            const isAuthorized = ADDRESSES.executor ? results[2] : false;

            setStats({
                balance: formatUSDC(statsResult.balance),
                deposited: formatUSDC(statsResult.deposited),
                withdrawn: formatUSDC(statsResult.withdrawn),
                feesPaid: formatUSDC(statsResult.feesPaid),
                profit: Number(statsResult.profit) / 10 ** USDC_DECIMALS,
                feePercent: Number(statsResult.currentFeePercent) / 100,
                pendingFee: formatUSDC(statsResult.pendingFee),
            });
            setIsExecutorAuthorized(isAuthorized);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, [proxyAddress, getSignerAndProvider]);

    /**
     * Fetch user's USDC balance
     */
    const fetchUsdcBalance = useCallback(async () => {
        if (!walletAddress || !ADDRESSES.usdc) return;

        // Check if wallet is available and authenticated before trying to get provider
        if (wallets.length === 0 || !authenticated) {
            return;
        }

        try {
            const { provider } = await getSignerAndProvider();
            const usdc = new ethers.Contract(ADDRESSES.usdc, ERC20_ABI, provider);
            const balance = await usdc.balanceOf(walletAddress);
            setUsdcBalance(formatUSDC(balance));
        } catch (err: any) {
            // Only log unexpected errors, not wallet connection issues
            if (err?.message !== 'Wallet not ready' && err?.message !== 'No wallet connected') {
                console.error('Error fetching USDC balance:', err);
            }
        }
    }, [walletAddress, wallets, authenticated, getSignerAndProvider]);

    /**
     * Create a new proxy
     */
    const createProxy = useCallback(async (tier: TierName = 'STARTER'): Promise<string | null> => {
        if (!ADDRESSES.proxyFactory) {
            setError('ProxyFactory not deployed');
            return null;
        }

        setError(null);
        setTxPending(true);
        setTxStatus('CREATING');
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const factory = new ethers.Contract(ADDRESSES.proxyFactory, PROXY_FACTORY_ABI, signer);

            const tx = await factory.createProxy(TIERS[tier]);
            setTxHash(tx.hash);
            setTxStatus('CONFIRMING');

            const receipt = await tx.wait();

            // Parse event to get proxy address
            const event = receipt.events?.find((e: { event: string }) => e.event === 'ProxyCreated');
            const newProxyAddress = event?.args?.proxy || null;

            if (newProxyAddress) {
                setProxyAddress(newProxyAddress);
                setHasProxy(true);

                // Register in database (non-blocking for UI)
                fetch('/api/proxy/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress,
                        proxyAddress: newProxyAddress,
                        tier,
                    }),
                }).catch(err => console.error('Failed to register proxy in DB:', err));
            }

            return newProxyAddress;
        } catch (err: unknown) {
            setError(parseTransactionError(err));
            return null;
        } finally {
            setTxPending(false);
            setTxStatus('IDLE');
        }
    }, [walletAddress, getSignerAndProvider]);

    /**
     * Approve USDC spending for proxy
     */
    const approveUSDC = useCallback(async (amount: number): Promise<boolean> => {
        if (!proxyAddress || !ADDRESSES.usdc) {
            setError('No proxy or USDC address');
            return false;
        }

        setError(null);
        setTxPending(true);
        setTxStatus('APPROVING');
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const usdc = new ethers.Contract(ADDRESSES.usdc, ERC20_ABI, signer);

            const tx = await usdc.approve(proxyAddress, parseUSDC(amount).toString());
            setTxHash(tx.hash);
            setTxStatus('CONFIRMING');

            await tx.wait();
            return true;
        } catch (err: unknown) {
            setError(parseTransactionError(err));
            return false;
        } finally {
            setTxPending(false);
            setTxStatus('IDLE');
        }
    }, [proxyAddress, getSignerAndProvider]);

    /**
     * Deposit USDC into proxy
     */
    const deposit = useCallback(async (amount: number): Promise<boolean> => {
        if (!proxyAddress) {
            setError('No proxy address');
            return false;
        }

        setError(null);
        setTxPending(true);
        setTxStatus('APPROVING'); // Start with allowance check phase
        setTxHash(null);

        try {
            const { signer, provider } = await getSignerAndProvider();
            const usdc = new ethers.Contract(ADDRESSES.usdc, ERC20_ABI, provider);
            const usdcSigner = usdc.connect(signer);

            // 1. Check Allowance
            const allowance = await usdc.allowance(walletAddress, proxyAddress);
            const amountBigInt = parseUSDC(amount);
            console.log(`Checking allowance: ${allowance.toString()} vs Amount: ${amountBigInt.toString()}`);

            if (BigInt(allowance.toString()) < amountBigInt) {
                // 2. Approve if needed
                console.log('Requesting Approval...');
                try {
                    const approveTx = await usdcSigner.approve(proxyAddress, parseUSDC(amount * 1.1).toString()); // Approve slightly more
                    setTxStatus('CONFIRMING'); // Confirming Approval
                    console.log('Approval Tx Sent:', approveTx.hash);
                    await approveTx.wait();
                    console.log('Approval Confirmed');
                } catch (approveErr) {
                    console.error('Approval failed:', approveErr);
                    throw approveErr;
                }
            }

            // 3. Deposit
            setTxStatus('DEPOSITING');
            console.log('Requesting Deposit...');
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);

            // Add manual gas limit to prevent estimation errors on localhost/Amoy
            const tx = await proxy.deposit(amountBigInt.toString(), {
                gasLimit: 300000
            });

            setTxHash(tx.hash);
            setTxStatus('CONFIRMING'); // Confirming Deposit

            await tx.wait();

            // Log transaction to DB
            try {
                await fetch('/api/proxy/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress,
                        proxyAddress,
                        type: 'DEPOSIT',
                        amount,
                        txHash: tx.hash,
                        status: 'COMPLETED'
                    })
                });
            } catch (logErr) {
                console.error('Failed to log deposit:', logErr);
            }

            await refreshStats();
            await fetchUsdcBalance();

            return true;
        } catch (err: unknown) {
            console.error('Deposit Error Details:', err);
            setError(parseTransactionError(err));
            return false;
        } finally {
            setTxPending(false);
            setTxStatus('IDLE');
        }
    }, [proxyAddress, walletAddress, getSignerAndProvider, refreshStats, fetchUsdcBalance]);

    /**
     * Withdraw USDC from proxy
     */
    const withdraw = useCallback(async (amount: number): Promise<boolean> => {
        if (!proxyAddress) {
            setError('No proxy address');
            return false;
        }

        setError(null);
        setTxPending(true);
        setTxStatus('WITHDRAWING');
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);

            const tx = await proxy.withdraw(parseUSDC(amount).toString());
            setTxHash(tx.hash);
            setTxStatus('CONFIRMING');

            await tx.wait();

            // Log transaction to DB
            try {
                await fetch('/api/proxy/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress,
                        proxyAddress,
                        type: 'WITHDRAW',
                        amount,
                        txHash: tx.hash,
                        status: 'COMPLETED'
                    })
                });
            } catch (logErr) {
                console.error('Failed to log withdrawal:', logErr);
            }

            await refreshStats();
            await fetchUsdcBalance();

            return true;
        } catch (err: unknown) {
            setError(parseTransactionError(err));
            return false;
        } finally {
            setTxPending(false);
            setTxStatus('IDLE');
        }
    }, [proxyAddress, getSignerAndProvider, refreshStats, fetchUsdcBalance]);

    /**
     * Withdraw all USDC from proxy
     */
    const withdrawAll = useCallback(async (): Promise<boolean> => {
        if (!proxyAddress) {
            setError('No proxy address');
            return false;
        }

        setError(null);
        setTxPending(true);
        setTxStatus('WITHDRAWING');
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);

            const tx = await proxy.withdrawAll();
            setTxHash(tx.hash);
            setTxStatus('CONFIRMING');

            await tx.wait();
            await refreshStats();
            await fetchUsdcBalance();

            return true;
        } catch (err: unknown) {
            setError(parseTransactionError(err));
            return false;
        } finally {
            setTxPending(false);
            setTxStatus('IDLE');
        }
    }, [proxyAddress, getSignerAndProvider, refreshStats, fetchUsdcBalance]);

    // Initialize on mount
    useEffect(() => {
        if (!authenticated || !walletAddress) {
            setIsLoading(false);
            return;
        }

        const init = async () => {
            setIsLoading(true);
            try {
                const addr = await fetchProxyAddress();
                if (addr) {
                    await refreshStats();
                }
                await fetchUsdcBalance();
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [authenticated, walletAddress, fetchProxyAddress, refreshStats, fetchUsdcBalance]);

    /**
     * Execute arbitrary call through proxy
     * Used for trading operations (CTF split/merge, CLOB orders)
     */
    const executeCall = useCallback(async (target: string, data: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
        if (!proxyAddress) {
            return { success: false, error: 'No proxy address' };
        }

        setTxPending(true);
        setTxStatus('EXECUTING');
        setError(null);

        try {
            const { signer } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);

            const tx = await proxy.execute(target, data);
            setTxHash(tx.hash);
            setTxStatus('CONFIRMING');

            await tx.wait();
            await refreshStats();

            return { success: true, txHash: tx.hash };
        } catch (err: unknown) {
            const errorMsg = parseTransactionError(err);
            setError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setTxPending(false);
            setTxStatus('IDLE');
        }
    }, [proxyAddress, getSignerAndProvider, refreshStats]);


    /**
     * Authorize or deauthorize an operator
     */
    const authorizeOperator = useCallback(async (operator: string, active: boolean): Promise<{ success: boolean; txHash?: string; error?: string }> => {
        if (!proxyAddress) {
            return { success: false, error: 'No proxy address' };
        }

        setTxPending(true);
        setTxStatus('AUTHORIZING');
        setError(null);

        try {
            const { signer } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);

            const tx = await proxy.setOperator(operator, active);
            setTxHash(tx.hash);
            setTxStatus('CONFIRMING');

            await tx.wait();
            // Refresh stats to check if auth status updated
            await refreshStats();

            return { success: true, txHash: tx.hash };
        } catch (err: unknown) {
            const errorMsg = parseTransactionError(err);
            setError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setTxPending(false);
            setTxStatus('IDLE');
        }
    }, [proxyAddress, getSignerAndProvider, refreshStats]);

    /**
     * Settle pending fees manually
     */
    const settleFees = useCallback(async (): Promise<boolean> => {
        if (!proxyAddress) {
            setError('No proxy address');
            return false;
        }

        setError(null);
        setTxPending(true);
        setTxStatus('SETTLING');
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);

            // Execute settleFees
            const tx = await proxy.settleFees();
            setTxHash(tx.hash);
            setTxStatus('CONFIRMING');

            await tx.wait();
            await refreshStats();

            return true;
        } catch (err: unknown) {
            setError(parseTransactionError(err));
            return false;
        } finally {
            setTxPending(false);
            setTxStatus('IDLE');
        }
    }, [proxyAddress, getSignerAndProvider, refreshStats]);


    return {
        proxyAddress,
        hasProxy,
        stats,
        usdcBalance,
        isLoading,
        error,
        createProxy,
        deposit,
        withdraw,
        withdrawAll,
        refreshStats,
        settleFees,
        approveUSDC,
        executeCall,
        authorizeOperator,
        txPending,
        txStatus,
        txHash,
        isExecutorAuthorized,
    };
}
