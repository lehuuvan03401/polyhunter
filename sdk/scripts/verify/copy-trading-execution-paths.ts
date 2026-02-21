import { ethers } from 'ethers';
import { TradingService } from '../../src/services/trading-service.js';
import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service.js';
import { RateLimiter } from '../../src/core/rate-limiter.js';
import { createUnifiedCache } from '../../src/core/unified-cache.js';
import { EncryptionService } from '../../src/core/encryption.js';

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337', 10);
const TOKEN_ID = process.env.VERIFY_TOKEN_ID || 'mock-token-exec-path-1234567890';
const EOA_PRIVATE_KEY = process.env.VERIFY_EOA_PRIVATE_KEY || process.env.TRADING_PRIVATE_KEY || '';
const FLEET_PRIVATE_KEY = process.env.VERIFY_FLEET_PRIVATE_KEY || process.env.TRADING_PRIVATE_KEY || '';
const VERIFY_PROXY_ADDRESS = process.env.VERIFY_PROXY_ADDRESS || ethers.constants.AddressZero;
const VERIFY_WALLET_ADDRESS = process.env.VERIFY_WALLET_ADDRESS || '';

const API_CREDENTIALS = process.env.POLY_API_KEY && process.env.POLY_API_SECRET && process.env.POLY_API_PASSPHRASE
    ? { key: process.env.POLY_API_KEY, secret: process.env.POLY_API_SECRET, passphrase: process.env.POLY_API_PASSPHRASE }
    : undefined;

const cache = createUnifiedCache();

async function verifyEOAPath(): Promise<void> {
    if (!EOA_PRIVATE_KEY) {
        console.warn('[EOA] Missing private key. Set VERIFY_EOA_PRIVATE_KEY or TRADING_PRIVATE_KEY.');
        return;
    }

    console.log('\n=== EOA Execution Path ===');
    const { encryptedData, iv } = EncryptionService.encrypt(EOA_PRIVATE_KEY);
    const decrypted = EncryptionService.decrypt(encryptedData, iv);
    if (decrypted !== EOA_PRIVATE_KEY) {
        throw new Error('[EOA] Decrypted key mismatch.');
    }

    const rateLimiter = new RateLimiter();
    const eoaService = new TradingService(rateLimiter, cache, {
        privateKey: decrypted,
        chainId: CHAIN_ID,
        credentials: API_CREDENTIALS,
    });
    await eoaService.initialize();

    const derivedAddress = new ethers.Wallet(EOA_PRIVATE_KEY).address;
    const serviceAddress = eoaService.getAddress();
    console.log(`[EOA] Wallet address: ${derivedAddress}`);
    console.log(`[EOA] TradingService address: ${serviceAddress}`);
    console.log(`[EOA] Address match: ${derivedAddress.toLowerCase() === serviceAddress.toLowerCase()}`);

    const orderResult = await eoaService.createMarketOrder({
        tokenId: TOKEN_ID,
        side: 'BUY',
        amount: 1,
        price: 0.5,
        orderType: 'FOK',
    });

    console.log('[EOA] createMarketOrder result:', orderResult);
}

async function verifyProxyPath(): Promise<void> {
    if (!FLEET_PRIVATE_KEY) {
        console.warn('[Proxy] Missing fleet private key. Set VERIFY_FLEET_PRIVATE_KEY or TRADING_PRIVATE_KEY.');
        return;
    }

    console.log('\n=== Proxy Execution Path ===');
    const rateLimiter = new RateLimiter();
    const fleetService = new TradingService(rateLimiter, cache, {
        privateKey: FLEET_PRIVATE_KEY,
        chainId: CHAIN_ID,
        credentials: API_CREDENTIALS,
    });
    await fleetService.initialize();

    const fleetWallet = new ethers.Wallet(FLEET_PRIVATE_KEY);
    const fleetAddress = await fleetWallet.getAddress();
    console.log(`[Proxy] Fleet wallet address: ${fleetAddress}`);
    console.log(`[Proxy] Using proxy address: ${VERIFY_PROXY_ADDRESS}`);
    if (CHAIN_ID === 1337 && TOKEN_ID.length > 15 && !TOKEN_ID.startsWith('0x')) {
        console.log('[Proxy] Localhost mock token bypass enabled (no on-chain transfers).');
    }

    const executionService = new CopyTradingExecutionService(fleetService, fleetWallet, CHAIN_ID);
    const result = await executionService.executeOrderWithProxy({
        tradeId: 'verify-proxy-path',
        walletAddress: VERIFY_WALLET_ADDRESS || fleetAddress,
        tokenId: TOKEN_ID,
        side: 'SELL',
        amount: 1,
        price: 0.5,
        proxyAddress: VERIFY_PROXY_ADDRESS,
        slippage: 0,
        slippageMode: 'FIXED',
    });

    console.log('[Proxy] executeOrderWithProxy result:', result);
}

async function main() {
    console.log(`CHAIN_ID=${CHAIN_ID}`);
    console.log(`TOKEN_ID=${TOKEN_ID}`);
    console.log(`ENCRYPTION_KEY set? ${Boolean(process.env.ENCRYPTION_KEY)}`);

    await verifyEOAPath();
    await verifyProxyPath();
}

main().catch((err) => {
    console.error('Execution path verification failed:', err);
    process.exit(1);
});
