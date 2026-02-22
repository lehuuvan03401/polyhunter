import { ethers } from 'ethers';
import { ERC20_ABI, EXECUTOR_ABI, CONTRACT_ADDRESSES, USDC_DECIMALS } from './contracts.js'; // Use .js for SDK
import { WalletManager } from './wallet-manager.js';
import { getErrorMessage } from './errors.js';

export interface DebtItem {
    id: string;
    proxyAddress: string;
    botAddress: string;
    amount: number;
    currency: string;
    createdAt: Date;
}

export interface DebtRepository {
    getPendingDebts(): Promise<DebtItem[]>;
    markRepaid(id: string): Promise<void>;
    getProxyDebt(proxyAddress: string): Promise<number>;
}

export class DebtManager {
    private repository: DebtRepository;
    private walletManager: WalletManager;
    private provider: ethers.providers.Provider;
    private chainId: number;
    private recoveryTimer?: NodeJS.Timeout;

    constructor(
        repository: DebtRepository,
        walletManager: WalletManager,
        provider: ethers.providers.Provider,
        chainId: number = 137
    ) {
        this.repository = repository;
        this.walletManager = walletManager;
        this.provider = provider;
        this.chainId = chainId;
    }

    /**
     * Start a background loop to continuously recover pending debts.
     * @param intervalMs How often to scan and recover (e.g. 1800000 for 30m)
     */
    startDebtRecoveryLoop(intervalMs: number = 1800000): void {
        if (this.recoveryTimer) {
            clearInterval(this.recoveryTimer);
        }
        console.log(`[DebtManager] 🔄 Starting Debt Recovery Loop (interval: ${intervalMs}ms)`);
        this.recoveryTimer = setInterval(async () => {
            try {
                await this.recoverPendingDebts();
            } catch (err) {
                console.error(`[DebtManager] Error in recovery loop: ${getErrorMessage(err)}`);
            }
        }, intervalMs);
    }

    /**
     * Stop the background recovery loop.
     */
    stopDebtRecoveryLoop(): void {
        if (this.recoveryTimer) {
            clearInterval(this.recoveryTimer);
            this.recoveryTimer = undefined;
            console.log(`[DebtManager] 🛑 Stopped Debt Recovery Loop`);
        }
    }

    /**
     * Gets the total active USDC debt currently owed by a proxy.
     */
    async getProxyDebt(proxyAddress: string): Promise<number> {
        return this.repository.getProxyDebt(proxyAddress);
    }

    /**
     * Scan pending debts and attempt recovery
     */
    async recoverPendingDebts(): Promise<{ recovered: number, errors: number }> {
        const debts = await this.repository.getPendingDebts();
        if (debts.length === 0) return { recovered: 0, errors: 0 };

        console.log(`[DebtManager] 🩺 Found ${debts.length} pending debts. Attempting recovery...`);
        let recoveredCount = 0;
        let errorCount = 0;

        // Group by Bot Address to potentially batch? No, one by one is safer for now.
        for (const debt of debts) {
            try {
                const success = await this.attemptRecovery(debt);
                if (success) {
                    await this.repository.markRepaid(debt.id);
                    recoveredCount++;
                    console.log(`[DebtManager] ✅ Recovered $${debt.amount} for Bot ${debt.botAddress} from Proxy ${debt.proxyAddress}`);
                }
            } catch (err: unknown) {
                console.error(`[DebtManager] ❌ Recovery failed for Debt ${debt.id}: ${getErrorMessage(err)}`);
                errorCount++;
            }
        }

        return { recovered: recoveredCount, errors: errorCount };
    }

    private async attemptRecovery(debt: DebtItem): Promise<boolean> {
        // 1. Get Bot Signer
        // WalletManager holds the fleet. We need to find the worker that matches the botAddress.
        // Wait, WalletManager generates wallets deterministically. 
        // We can just iterate or ask WalletManager for the signer?
        // WalletManager exposes `getWorker(index)`.
        // We don't have a map of Address -> Signer in WalletManager public API yet.
        // But for MVP, we can iterate limited pool or create a temporary signer if we have the mnemonic.
        // Actually, logic inside WalletManager: `this.workers[i]`.
        // Let's assume we can get the signer.

        const signer = this.walletManager.getSignerForAddress(debt.botAddress);
        if (!signer) {
            console.warn(`[DebtManager] ⚠️ Bot ${debt.botAddress} not found in current fleet. Skipping.`);
            return false;
        }

        // 2. Check Proxy Balance
        const addresses = (this.chainId === 137 || this.chainId === 31337) ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
        const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, this.provider);
        const proxyBalanceWei = await usdc.balanceOf(debt.proxyAddress);
        const proxyBalance = Number(ethers.utils.formatUnits(proxyBalanceWei, USDC_DECIMALS));

        if (proxyBalance < debt.amount) {
            // Still insufficient
            // console.debug(`[DebtManager] Proxy ${debt.proxyAddress} insufficient funds (${proxyBalance} < ${debt.amount})`);
            return false;
        }

        // 3. Execute Transfer (Proxy -> Bot)
        // Using Executor
        const executor = new ethers.Contract(addresses.executor, EXECUTOR_ABI, signer);
        const erc20Interface = new ethers.utils.Interface(ERC20_ABI);
        const amountWei = ethers.utils.parseUnits(debt.amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

        // Encode: usdc.transfer(botAddress, amountWei)
        const transferData = erc20Interface.encodeFunctionData('transfer', [
            debt.botAddress,
            amountWei
        ]);

        console.log(`[DebtManager] 💸 Initiating Recovery Transfer: $${debt.amount} from ${debt.proxyAddress} -> ${debt.botAddress}`);

        // Ensure we handle nonces correctly if bot is active?
        // WalletManager manages Nonces? No, provider usually does.

        const tx = await executor.executeOnProxy(
            debt.proxyAddress,
            addresses.usdc,
            transferData
        );

        await tx.wait();
        return true;
    }
}
