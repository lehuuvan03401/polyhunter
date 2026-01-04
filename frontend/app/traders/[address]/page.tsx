'use client';

import Link from 'next/link';
import {
    ChevronLeft,
    Copy,
    ExternalLink,
    Share2,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';

// Mock Data
const PROFILE = {
    username: "bizyugo",
    address: "0xba66...24f5",
    copiers: 142,
    activePositions: 4,
    avatarColor: "bg-blue-500"
};

const POSITIONS = [
    {
        question: "Will Bitcoin hit $100k in 2024?",
        outcome: "No",
        pnl: "-$4,736.40",
        pnlPositive: false,
        size: "$0.00"
    },
    {
        question: "Will Base launch a token in 2025?",
        outcome: "No",
        pnl: "+$161.25",
        pnlPositive: true,
        size: "$10,928.78"
    },
    {
        question: "Will FC Barcelona win on 2025-11-06?",
        outcome: "Yes",
        pnl: "-$3,299.95",
        pnlPositive: false,
        size: "$0.00"
    },
    {
        question: "Will Hyperliquid launch a token in December?",
        outcome: "Yes",
        pnl: "-$215.40",
        pnlPositive: false,
        size: "$0.00"
    }
];

const TRADES = [
    {
        action: "Bought",
        market: "Will Base launch a token in 2025?",
        date: "Dec 5, 04:32 AM",
        amount: "$7,625.53",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Will Base launch a token in 2025?",
        date: "Dec 5, 04:31 AM",
        amount: "$3,088.46",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Fed decreases interest rates by 25 bps after December 2025 meeting?",
        date: "Nov 25, 08:26 PM",
        amount: "$2,957.81",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Fed decreases interest rates by 25 bps after December 2025 meeting?",
        date: "Nov 25, 08:24 PM",
        amount: "$8.83",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Fed decreases interest rates by 25 bps after December 2025 meeting?",
        date: "Nov 25, 08:23 PM",
        amount: "$1.86",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Fed decreases interest rates by 25 bps after December 2025 meeting?",
        date: "Nov 25, 08:20 PM",
        amount: "$82.76",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Fed decreases interest rates by 25 bps after December 2025 meeting?",
        date: "Nov 25, 08:16 PM",
        amount: "$23.72",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Fed decreases interest rates by 25 bps after December 2025 meeting?",
        date: "Nov 25, 08:10 PM",
        amount: "$45.65",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Fed decreases interest rates by 25 bps after December 2025 meeting?",
        date: "Nov 25, 08:10 PM",
        amount: "$9,107.74",
        type: "buy"
    },
    {
        action: "Bought",
        market: "Fed decreases interest rates by 25 bps after December 2025 meeting?",
        date: "Nov 25, 07:58 PM",
        amount: "$8.95",
        type: "buy"
    }
];

export default function TraderProfilePage({ params }: { params: { address: string } }) {
    // In a real app, uses params.address to fetch data.
    // using React.use to unwrap params if needed in newer Next.js versions, 
    // but standard props access works for basic setups. For strict Next.js 15+ we might await it.

    return (
        <div className="min-h-screen bg-background pt-24 pb-20">
            <div className="container max-w-5xl mx-auto px-4">

                {/* Back Navigation */}
                <Link href="/smart-money" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white mb-8 transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Back to Discovery
                </Link>

                {/* Profile Header */}
                <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 lg:p-8 mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div className="flex items-center gap-5">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg">
                                <Wallet className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-1">{PROFILE.username}</h1>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1 hover:text-blue-400 cursor-pointer">
                                        <ExternalLink className="h-3 w-3" /> View real username on Polymarket
                                    </span>
                                    <span className="text-blue-500">{PROFILE.address}</span>
                                </div>
                            </div>
                        </div>
                        <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20">
                            <Copy className="h-4 w-4" /> Copy Trader
                        </button>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-6">
                        <div className="flex items-center gap-8">
                            <div>
                                <div className="text-2xl font-bold text-white mb-0.5">{PROFILE.copiers}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Copiers</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white mb-0.5">{PROFILE.activePositions}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Active Positions</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <a href="#" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                                <ExternalLink className="h-3.5 w-3.5" /> Polymarket
                            </a>
                            <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                                <Share2 className="h-3.5 w-3.5" /> Share & Earn
                            </button>
                        </div>
                    </div>
                </div>

                {/* Active Positions */}
                <div className="mb-10">
                    <h2 className="text-lg font-bold text-muted-foreground mb-4">Active Positions</h2>
                    <div className="space-y-4">
                        {POSITIONS.map((pos, i) => (
                            <div key={i} className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-5 flex items-center justify-between hover:bg-[#25262b] transition-colors cursor-default">
                                <div>
                                    <h3 className="font-bold text-white text-sm mb-1">{pos.question}</h3>
                                    <div className="text-xs text-muted-foreground">
                                        <span className={cn("font-medium", pos.outcome === "Yes" ? "text-green-500" : "text-red-500")}>{pos.outcome}</span> • {pos.size}
                                    </div>
                                </div>
                                <div className={cn("text-sm font-bold font-mono", pos.pnlPositive ? "text-green-500" : "text-red-500")}>
                                    {pos.pnl}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Trades */}
                <div>
                    <h2 className="text-lg font-bold text-muted-foreground mb-4">Recent Trades</h2>
                    <div className="space-y-3">
                        {TRADES.map((trade, i) => (
                            <div key={i} className="group bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-4 flex items-center justify-between hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">
                                            <span className="text-green-500 font-bold">{trade.action}</span> {trade.market}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {trade.date}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-white font-mono">
                                    {trade.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
