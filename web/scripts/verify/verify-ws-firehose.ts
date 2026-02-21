import { RealtimeServiceV2 } from '../../../sdk/src/services/realtime-service-v2';

const realtimeService = new RealtimeServiceV2({
    autoReconnect: true,
    debug: true
});

console.log("🔌 Connecting to Activity (Specific Market + Configured)...");

realtimeService.connect();

const marketSlug = "lol-we-nip-2026-01-22-most-drake";
console.log(`Subscribing to ${marketSlug}`);

realtimeService.subscribeActivity(
    { marketSlug: marketSlug },
    {
        onTrade: (trade) => {
            console.log(`[MARKET] ⚡ ${trade.side} ${trade.size} ${trade.asset} @ ${trade.price}`);
        }
    }
);

// Keep alive
setTimeout(() => {
    console.log("Done.");
    process.exit(0);
}, 20000);
