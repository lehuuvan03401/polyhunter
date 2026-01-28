import assert from 'node:assert/strict';

function normalizeTradeSizing(
    tradeSizeMode: 'SHARES' | 'NOTIONAL',
    rawSize: number,
    price: number
): { tradeShares: number; tradeNotional: number } {
    if (tradeSizeMode === 'NOTIONAL') {
        const tradeNotional = rawSize;
        const tradeShares = price > 0 ? tradeNotional / price : 0;
        return { tradeShares, tradeNotional };
    }

    const tradeShares = rawSize;
    const tradeNotional = tradeShares * price;
    return { tradeShares, tradeNotional };
}

function run() {
    const price = 0.42;
    const rawShares = 100;
    const rawNotional = 42;

    const sharesMode = normalizeTradeSizing('SHARES', rawShares, price);
    assert.equal(sharesMode.tradeShares, rawShares);
    assert.equal(Number(sharesMode.tradeNotional.toFixed(6)), Number((rawShares * price).toFixed(6)));

    const notionalMode = normalizeTradeSizing('NOTIONAL', rawNotional, price);
    assert.equal(notionalMode.tradeNotional, rawNotional);
    assert.equal(Number(notionalMode.tradeShares.toFixed(6)), Number((rawNotional / price).toFixed(6)));

    console.log('✅ copy-trade-sizing verification passed');
}

run();
