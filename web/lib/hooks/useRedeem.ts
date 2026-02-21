import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { toast } from 'sonner';

// CTF Contract on Polygon
const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

const CTF_ABI = [
    'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets) external'
];

export function useRedeem() {
    const { wallets } = useWallets();
    const [isRedeeming, setIsRedeeming] = useState(false);

    const redeem = async (conditionId: string, outcome: string, title: string) => {
        setIsRedeeming(true);
        const toastId = toast.loading(`Redeeming winnings for ${title}...`);

        try {
            const wallet = wallets[0];
            if (!wallet) throw new Error("Wallet not connected");

            const ethereumProvider = await wallet.getEthereumProvider();
            const provider = new ethers.providers.Web3Provider(ethereumProvider);
            const signer = provider.getSigner();

            const ctf = new ethers.Contract(CTF_CONTRACT, CTF_ABI, signer);

            // Determine Index Set
            // YES / UP = [1] (Index 0)
            // NO / DOWN = [2] (Index 1)
            const normalizedOutcome = outcome.trim().toUpperCase();
            let indexSet: number[] = [];

            if (normalizedOutcome === 'YES' || normalizedOutcome === 'UP') {
                indexSet = [1];
            } else if (normalizedOutcome === 'NO' || normalizedOutcome === 'DOWN') {
                indexSet = [2];
            } else {
                // Fallback or error? defaulting to 1 for now or throw
                // Better to throw to avoid burning gas on wrong redeem
                throw new Error(`Unknown outcome: ${outcome}`);
            }

            console.log(`Redeeming ${outcome} (IndexSet: ${JSON.stringify(indexSet)}) for condition ${conditionId}`);

            const tx = await ctf.redeemPositions(
                USDC_CONTRACT,
                ethers.constants.HashZero, // parentCollectionId
                conditionId,
                indexSet
            );

            console.log("Redeem TX Sent:", tx.hash);

            toast.loading(`Transaction sent! Waiting for confirmation...`, { id: toastId });
            await tx.wait();

            toast.success("Redemption successful!", { id: toastId });
            return true;
        } catch (err: any) {
            console.error("Redeem failed:", err);
            // Handle specific errors like "INSUFFICIENT_BALANCE"
            let msg = err.message || 'Unknown error';
            if (msg.includes('user rejected')) msg = 'User rejected transaction';

            toast.error(`Redemption failed: ${msg}`, { id: toastId });
            return false;
        } finally {
            setIsRedeeming(false);
        }
    };

    const redeemSim = async (walletAddress: string, tokenId: string, conditionId: string, outcome: string, slug: string) => {
        setIsRedeeming(true);
        const toastId = toast.loading(`Redeeming simulated position...`);

        try {
            const res = await fetch('/api/copy-trading/redeem-sim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, tokenId, conditionId, outcome, marketSlug: slug })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to redeem');
            }

            const data = await res.json();
            toast.success(`Redemption successful! Profit: $${data.profit.toFixed(4)}`, { id: toastId });
            return true;
        } catch (err: any) {
            console.error("Redeem failed:", err);
            toast.error(`Redeem failed: ${err.message}`, { id: toastId });
            return false;
        } finally {
            setIsRedeeming(false);
        }
    };

    return { redeem, redeemSim, isRedeeming };
}
