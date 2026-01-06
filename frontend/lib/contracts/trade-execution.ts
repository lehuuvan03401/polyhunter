/**
 * Trade Execution Helpers
 * 
 * Utilities for encoding Polymarket CLOB order calls
 * to be executed through the proxy contract
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, USDC_DECIMALS } from './abis';

// Network selection
const NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'polygon' ? 'polygon' : 'amoy';
const ADDRESSES = CONTRACT_ADDRESSES[NETWORK];

// CLOB Exchange ABI (for encoding order calls)
const CLOB_EXCHANGE_ABI = [
    // Fill order (market order execution)
    'function fillOrder((address maker, address taker, address makerAsset, address takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 makerAssetData, uint256 takerAssetData, uint256 salt, uint256 expiry, bytes signature) order, uint256 fillAmount, bytes signature) external',
    // Create order
    'function createOrder((address maker, address taker, address makerAsset, address takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 makerAssetData, uint256 takerAssetData, uint256 salt, uint256 expiry, bytes signature) order) external',
];

// CTF ABI for split/merge operations
const CTF_ABI = [
    'function splitPosition(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] partition, uint256 amount) external',
    'function mergePositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] partition, uint256 amount) external',
];

export interface TradeOrderParams {
    /** Token ID from Polymarket CLOB */
    tokenId: string;
    /** Trade side */
    side: 'BUY' | 'SELL';
    /** Amount in USDC */
    amount: number;
    /** Limit price (0-1) */
    price: number;
    /** Market condition ID */
    conditionId?: string;
}

export interface EncodedCall {
    target: string;
    data: string;
    description: string;
}

/**
 * Encode a CTF split operation
 * 
 * Split USDC into YES + NO tokens
 */
export function encodeSplitPosition(
    conditionId: string,
    amount: number
): EncodedCall {
    const iface = new ethers.utils.Interface(CTF_ABI);
    const amountWei = ethers.utils.parseUnits(amount.toString(), USDC_DECIMALS);

    const data = iface.encodeFunctionData('splitPosition', [
        ADDRESSES.usdc,                    // collateralToken
        ethers.constants.HashZero,         // parentCollectionId
        conditionId,                       // conditionId
        [1, 2],                            // partition [YES, NO]
        amountWei,                         // amount
    ]);

    return {
        target: ADDRESSES.ctfContract,
        data,
        description: `Split $${amount} USDC into YES + NO tokens`,
    };
}

/**
 * Encode a CTF merge operation
 * 
 * Merge YES + NO tokens back to USDC
 */
export function encodeMergePositions(
    conditionId: string,
    amount: number
): EncodedCall {
    const iface = new ethers.utils.Interface(CTF_ABI);
    const amountWei = ethers.utils.parseUnits(amount.toString(), USDC_DECIMALS);

    const data = iface.encodeFunctionData('mergePositions', [
        ADDRESSES.usdc,
        ethers.constants.HashZero,
        conditionId,
        [1, 2],
        amountWei,
    ]);

    return {
        target: ADDRESSES.ctfContract,
        data,
        description: `Merge ${amount} YES + NO tokens to USDC`,
    };
}

/**
 * Encode USDC approval for CLOB Exchange
 */
export function encodeApproveUSDC(
    spender: string,
    amount: number
): EncodedCall {
    const iface = new ethers.utils.Interface([
        'function approve(address spender, uint256 amount) returns (bool)',
    ]);
    const amountWei = amount === -1
        ? ethers.constants.MaxUint256
        : ethers.utils.parseUnits(amount.toString(), USDC_DECIMALS);

    const data = iface.encodeFunctionData('approve', [spender, amountWei]);

    return {
        target: ADDRESSES.usdc,
        data,
        description: amount === -1
            ? `Approve unlimited USDC for ${spender}`
            : `Approve $${amount} USDC for ${spender}`,
    };
}

/**
 * Get the appropriate exchange address for a trade
 */
export function getExchangeAddress(isNegRisk: boolean = false): string {
    return isNegRisk ? ADDRESSES.negRiskExchange : ADDRESSES.clobExchange;
}

/**
 * Summary of steps needed to execute a copy trade
 */
export function getCopyTradeSteps(params: TradeOrderParams): string[] {
    const steps = [
        `1. Approve USDC for CLOB Exchange`,
        `2. ${params.side} ${params.tokenId} for $${params.amount} at ${(params.price * 100).toFixed(1)}¢`,
    ];

    if (params.conditionId) {
        steps.push(`3. (Optional) Monitor position for ${params.conditionId}`);
    }

    return steps;
}

/**
 * Helper to format trade for display
 */
export function formatTradeDescription(params: TradeOrderParams): string {
    const sideEmoji = params.side === 'BUY' ? '🟢' : '🔴';
    return `${sideEmoji} ${params.side} $${params.amount.toFixed(2)} @ ${(params.price * 100).toFixed(1)}¢`;
}
