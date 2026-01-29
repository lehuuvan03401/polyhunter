import './env-setup';
import { Wallet } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { SignatureType } from '@polymarket/order-utils';

const HOST = 'https://clob.polymarket.com';
const PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || 137);
const signatureType = Number(process.env.POLY_SIGNATURE_TYPE || 0) as SignatureType;
const funderAddress = process.env.POLY_FUNDER_ADDRESS || undefined;

async function main() {
    if (!PRIVATE_KEY) {
        console.error('Missing TRADING_PRIVATE_KEY in environment.');
        process.exit(1);
    }

    const wallet = new Wallet(PRIVATE_KEY);
    console.log(`[CLOB] Wallet: ${wallet.address}`);
    console.log(`[CLOB] Chain ID: ${CHAIN_ID}`);

    const client = new ClobClient(HOST, CHAIN_ID, wallet, undefined, signatureType, funderAddress);
    const creds = await client.createOrDeriveApiKey();

    console.log('\n# Paste into frontend/.env');
    console.log(`POLY_API_KEY=${creds.key}`);
    console.log(`POLY_API_SECRET=${creds.secret}`);
    console.log(`POLY_API_PASSPHRASE=${creds.passphrase}`);
}

main().catch((error) => {
    console.error('[CLOB] Failed to create/derive API key:', error);
    process.exit(1);
});
