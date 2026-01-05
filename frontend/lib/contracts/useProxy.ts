'use client';

/**
 * useProxy Hook
 * 
 * React hook for interacting with PolyHunter proxy contracts
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

// Network to use
const NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'polygon' ? 'polygon' : 'amoy';
const ADDRESSES = CONTRACT_ADDRESSES[NETWORK];

export interface ProxyStats {
    balance: number;
    deposited: number;
    withdrawn: number;
    feesPaid: number;
    profit: number;
    feePercent: number;
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
    approveUSDC: (amount: number) => Promise<boolean>;

    // Transaction state
    txPending: boolean;
    txHash: string | null;
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
    const [txHash, setTxHash] = useState<string | null>(null);

    const walletAddress = user?.wallet?.address;

    /**
     * Get ethers provider and signer from Privy wallet
     */
    const getSignerAndProvider = useCallback(async () => {
        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
        const externalWallet = wallets.find(w => w.walletClientType !== 'privy');
        const wallet = externalWallet || embeddedWallet;

        if (!wallet) {
            throw new Error('No wallet connected');
        }

        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.providers.Web3Provider(provider);
        const signer = ethersProvider.getSigner();

        return { provider: ethersProvider, signer };
    }, [wallets]);

    /**
     * Fetch user's proxy address and check if they have one
     */
    const fetchProxyAddress = useCallback(async () => {
        if (!walletAddress || !ADDRESSES.proxyFactory) {
            setHasProxy(false);
            setProxyAddress(null);
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
        } catch (err) {
            console.error('Error fetching proxy address:', err);
            return null;
        }
    }, [walletAddress, getSignerAndProvider]);

    /**
     * Fetch proxy stats from contract
     */
    const refreshStats = useCallback(async () => {
        if (!proxyAddress) return;

        try {
            const { provider } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, provider);

            const [statsResult, balanceResult] = await Promise.all([
                proxy.getStats(),
                provider.getBalance(proxyAddress), // ETH balance (for gas if needed)
            ]);

            setStats({
                balance: formatUSDC(statsResult.balance),
                deposited: formatUSDC(statsResult.deposited),
                withdrawn: formatUSDC(statsResult.withdrawn),
                feesPaid: formatUSDC(statsResult.feesPaid),
                profit: Number(statsResult.profit) / 10 ** USDC_DECIMALS,
                feePercent: Number(statsResult.currentFeePercent) / 100,
            });
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, [proxyAddress, getSignerAndProvider]);

    /**
     * Fetch user's USDC balance
     */
    const fetchUsdcBalance = useCallback(async () => {
        if (!walletAddress || !ADDRESSES.usdc) return;

        try {
            const { provider } = await getSignerAndProvider();
            const usdc = new ethers.Contract(ADDRESSES.usdc, ERC20_ABI, provider);
            const balance = await usdc.balanceOf(walletAddress);
            setUsdcBalance(formatUSDC(balance));
        } catch (err) {
            console.error('Error fetching USDC balance:', err);
        }
    }, [walletAddress, getSignerAndProvider]);

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
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const factory = new ethers.Contract(ADDRESSES.proxyFactory, PROXY_FACTORY_ABI, signer);

            const tx = await factory.createProxy(TIERS[tier]);
            setTxHash(tx.hash);

            const receipt = await tx.wait();

            // Parse event to get proxy address
            const event = receipt.events?.find((e: { event: string }) => e.event === 'ProxyCreated');
            const newProxyAddress = event?.args?.proxy || null;

            if (newProxyAddress) {
                setProxyAddress(newProxyAddress);
                setHasProxy(true);

                // Register in database
                await fetch('/api/proxy/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress,
                        proxyAddress: newProxyAddress,
                        tier,
                    }),
                });
            }

            return newProxyAddress;
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Failed to create proxy';
            setError(errMessage);
            return null;
        } finally {
            setTxPending(false);
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
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const usdc = new ethers.Contract(ADDRESSES.usdc, ERC20_ABI, signer);

            const tx = await usdc.approve(proxyAddress, parseUSDC(amount).toString());
            setTxHash(tx.hash);

            await tx.wait();
            return true;
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Failed to approve USDC';
            setError(errMessage);
            return false;
        } finally {
            setTxPending(false);
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
        setTxHash(null);

        try {
            const { signer, provider } = await getSignerAndProvider();

            // Check allowance first
            const usdc = new ethers.Contract(ADDRESSES.usdc, ERC20_ABI, provider);
            const allowance = await usdc.allowance(walletAddress, proxyAddress);
            const amountBigInt = parseUSDC(amount);

            if (BigInt(allowance.toString()) < amountBigInt) {
                // Need to approve first
                const approved = await approveUSDC(amount * 1.1); // Approve slightly more
                if (!approved) return false;
            }

            // Deposit
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);
            const tx = await proxy.deposit(amountBigInt.toString());
            setTxHash(tx.hash);

            await tx.wait();
            await refreshStats();
            await fetchUsdcBalance();

            return true;
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Failed to deposit';
            setError(errMessage);
            return false;
        } finally {
            setTxPending(false);
        }
    }, [proxyAddress, walletAddress, getSignerAndProvider, approveUSDC, refreshStats, fetchUsdcBalance]);

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
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);

            const tx = await proxy.withdraw(parseUSDC(amount).toString());
            setTxHash(tx.hash);

            await tx.wait();
            await refreshStats();
            await fetchUsdcBalance();

            return true;
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Failed to withdraw';
            setError(errMessage);
            return false;
        } finally {
            setTxPending(false);
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
        setTxHash(null);

        try {
            const { signer } = await getSignerAndProvider();
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);

            const tx = await proxy.withdrawAll();
            setTxHash(tx.hash);

            await tx.wait();
            await refreshStats();
            await fetchUsdcBalance();

            return true;
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Failed to withdraw all';
            setError(errMessage);
            return false;
        } finally {
            setTxPending(false);
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
        approveUSDC,
        txPending,
        txHash,
    };
}
