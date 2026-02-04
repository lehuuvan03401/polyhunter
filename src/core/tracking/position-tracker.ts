/**
 * Position Tracker with Average Cost Basis
 * 
 * Ported from Polymarket-Copy-Trading-Bot.
 * Handles:
 * - Weighted Average Price (WAP) calculation for Entry Checks
 * - FIFO/Pro-rata usage for realized PnL
 * - Unrealized PnL based on Mark Price (Last Price)
 */

export interface TokenState {
    shares: number;        // open shares
    costUSDC: number;      // cost basis for open shares
    realizedUSDC: number;  // realized pnl from sells
    lastPrice: number;     // last seen price
}

export type PositionsSnapshot = Record<string, TokenState>;

export interface PositionMetrics {
    shares: number;
    lastPrice: number;
    avgPrice: number;
    costUSDC: number;
    mtmValue: number;
    unrealized: number;
    realized: number;
}

export class PositionTracker {
    private m = new Map<string, TokenState>();

    private getOrInit(tokenID: string): TokenState {
        const cur = this.m.get(tokenID);
        if (cur) return cur;
        const init: TokenState = { shares: 0, costUSDC: 0, realizedUSDC: 0, lastPrice: 0 };
        this.m.set(tokenID, init);
        return init;
    }

    /**
     * Updates the last seen price for a token without changing shares/cost.
     * Useful for Mark-to-Market updates from orderbook data.
     */
    markPrice(tokenID: string, price: number) {
        const st = this.getOrInit(tokenID);
        st.lastPrice = price;
    }

    /**
     * Record a BUY trade
     * Increases shares and updates Weighted Average Cost
     */
    onBuy(tokenID: string, shares: number, price: number) {
        const st = this.getOrInit(tokenID);
        st.lastPrice = price;
        st.shares += shares;
        st.costUSDC += shares * price;
    }

    /**
     * Record a SELL trade
     * Reduces shares and realizes PnL
     */
    onSell(tokenID: string, shares: number, price: number): number {
        const st = this.getOrInit(tokenID);
        st.lastPrice = price;

        const sellShares = Math.min(shares, st.shares);
        if (sellShares <= 0) return 0;

        const avgPrice = st.shares > 0 ? st.costUSDC / st.shares : 0;

        const proceeds = price * sellShares;
        const costRemoved = avgPrice * sellShares;
        const realized = proceeds - costRemoved;

        st.realizedUSDC += realized;

        st.shares -= sellShares;
        st.costUSDC -= costRemoved;

        // Safety clamps
        if (st.shares < 0.000001) { // Floating point epsilon
            st.shares = 0;
            st.costUSDC = 0;
        }
        if (st.costUSDC < 0) st.costUSDC = 0;

        return realized;
    }

    /**
     * Get current metrics for a token
     */
    metrics(tokenID: string): PositionMetrics {
        const st = this.getOrInit(tokenID);
        const avgPrice = st.shares > 0 ? st.costUSDC / st.shares : 0;
        const mtmValue = st.shares * st.lastPrice;
        const unrealized = mtmValue - st.costUSDC;

        return {
            shares: st.shares,
            lastPrice: st.lastPrice,
            avgPrice,
            costUSDC: st.costUSDC,
            mtmValue,
            unrealized,
            realized: st.realizedUSDC,
        };
    }

    toJSON(): PositionsSnapshot {
        const obj: PositionsSnapshot = {};
        for (const [k, v] of this.m.entries()) obj[k] = v;
        return obj;
    }

    loadFromJSON(obj: PositionsSnapshot) {
        this.m.clear();
        for (const [k, v] of Object.entries(obj)) {
            if (!v || typeof v !== "object") continue;

            const shares = Number((v as any).shares);
            const costUSDC = Number((v as any).costUSDC);
            const realizedUSDC = Number((v as any).realizedUSDC);
            const lastPrice = Number((v as any).lastPrice);

            this.m.set(k, {
                shares: Number.isFinite(shares) && shares >= 0 ? shares : 0,
                costUSDC: Number.isFinite(costUSDC) && costUSDC >= 0 ? costUSDC : 0,
                realizedUSDC: Number.isFinite(realizedUSDC) ? realizedUSDC : 0,
                lastPrice: Number.isFinite(lastPrice) && lastPrice >= 0 ? lastPrice : 0,
            });
        }
    }

    /**
     * Get all active positions (shares > 0)
     */
    getAllPositions(): Array<{ tokenId: string } & PositionMetrics> {
        return Array.from(this.m.keys())
            .map(id => ({ tokenId: id, ...this.metrics(id) }))
            .filter(p => p.shares > 0);
    }

    /**
     * Remove a position entirely (e.g. after full settlement)
     */
    remove(tokenID: string) {
        this.m.delete(tokenID);
    }
}
