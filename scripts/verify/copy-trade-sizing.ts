import assert from 'node:assert/strict';
import { normalizeTradeSizing, normalizeTradeSizingFromShares } from '../../src/utils/trade-sizing.js';

function run() {
    const price = 0.42;
    const rawShares = 100;
    const rawNotional = 42;

    const sharesMode = normalizeTradeSizing({ tradeSizeMode: 'SHARES' }, rawShares, price);
    assert.equal(sharesMode.tradeShares, rawShares);
    assert.equal(Number(sharesMode.tradeNotional.toFixed(6)), Number((rawShares * price).toFixed(6)));

    const notionalMode = normalizeTradeSizing({ tradeSizeMode: 'NOTIONAL' }, rawNotional, price);
    assert.equal(notionalMode.tradeNotional, rawNotional);
    assert.equal(Number(notionalMode.tradeShares.toFixed(6)), Number((rawNotional / price).toFixed(6)));

    const supervisorShares = normalizeTradeSizingFromShares({ tradeSizeMode: 'SHARES' }, rawShares, price);
    assert.equal(Number(supervisorShares.tradeShares.toFixed(6)), Number(rawShares.toFixed(6)));
    assert.equal(Number(supervisorShares.tradeNotional.toFixed(6)), Number((rawShares * price).toFixed(6)));

    const supervisorNotional = normalizeTradeSizingFromShares({ tradeSizeMode: 'NOTIONAL' }, rawShares, price);
    assert.equal(Number(supervisorNotional.tradeShares.toFixed(6)), Number((rawNotional / price).toFixed(6)));
    assert.equal(Number(supervisorNotional.tradeNotional.toFixed(6)), Number(rawNotional.toFixed(6)));

    console.log('✅ copy-trade-sizing verification passed');
}

run();
