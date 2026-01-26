import { PolymarketSDK } from '../src';

const sdk = new PolymarketSDK({});

async function main() {
    const address = '0x63ce342161250d705dc0b16df89036c8e5f9ba9a';
    console.log(`Fetching profile for ${address}...`);
    try {
        const profile = await sdk.wallets.getWalletProfile(address);
        console.log('Profile keys:', Object.keys(profile));
        console.log('Profile:', JSON.stringify(profile, null, 2));

        const activity = await sdk.wallets.getWalletActivity(address, 20);
        console.log('Activity count:', activity.activities?.length);
    } catch (e) {
        console.error(e);
    }
}

main();
