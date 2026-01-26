import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { walletAddress: rawWallet, tokenId: rawToken, conditionId, outcome, marketSlug } = body;

        if (!rawWallet || !rawToken) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Normalize keys for DB (DB stores lowercase)
        const walletAddress = rawWallet.toLowerCase();
        const tokenId = rawToken.toLowerCase();

        console.log(`[MockRedeem] Request for ${walletAddress} on token ${tokenId}`);

        // 1. Find UserPosition
        const position = await prisma.userPosition.findUnique({
            where: {
                walletAddress_tokenId: {
                    walletAddress,
                    tokenId
                }
            }
        });

        if (!position) {
            return NextResponse.json({ error: "Position not found" }, { status: 404 });
        }

        if (position.balance <= 0) {
            return NextResponse.json({ error: "Position balance is zero" }, { status: 400 });
        }

        // 2. Find Config (to link CopyTrade)
        const config = await prisma.copyTradingConfig.findFirst({
            where: { walletAddress, isActive: true }
        });

        if (!config) {
            return NextResponse.json({ error: "No active configuration found for user" }, { status: 400 });
        }

        // 3. Calculate Profit (Mock Price = 1.0)
        const redemptionPrice = 1.0;
        const redemptionValue = position.balance * redemptionPrice;
        const profit = redemptionValue - position.totalCost;

        // 4. Create CopyTrade (Redeem)
        const trade = await prisma.copyTrade.create({
            data: {
                configId: config.id,
                marketSlug: marketSlug || "sim-market",
                tokenId: tokenId,
                conditionId: conditionId,
                outcome: outcome,
                originalTrader: "PROTOCOL",
                originalSide: "REDEEM",
                originalSize: 0,
                originalPrice: 1.0,
                copySize: redemptionValue,
                copyPrice: redemptionPrice,
                status: "EXECUTED",
                executedAt: new Date(),
                txHash: "sim-mock-redeem", // Identify as Mock
                realizedPnL: profit,
                errorMessage: `Mock Redeemed Profit: $${profit.toFixed(4)}`
            }
        });

        // 5. Delete Position (or reduce balance to 0)
        await prisma.userPosition.delete({
            where: { id: position.id }
        });

        return NextResponse.json({ success: true, tradeId: trade.id, profit });

    } catch (error: any) {
        console.error("[MockRedeem] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
