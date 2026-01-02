"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

// Mock Data
const positions = [
    { id: 1, title: "Will Bitcoin hit $100k in 2024?", outcome: "YES", side: "Buy", price: 0.32, value: 5420.00, pnl: 12.5, pnlAmount: 650, icon: "₿" },
    { id: 2, title: "Fed Interest Rate Cut in March?", outcome: "NO", side: "Sell", price: 0.85, value: 3200.50, pnl: -2.4, pnlAmount: -85, icon: "🏦" },
    { id: 3, title: "Elections: Democrat Win?", outcome: "YES", side: "Buy", price: 0.45, value: 12500.00, pnl: 45.2, pnlAmount: 3800, icon: "🗳️" },
    { id: 4, title: "SpaceX Starship Launch Success?", outcome: "YES", side: "Buy", price: 0.92, value: 850.00, pnl: 5.1, pnlAmount: 42, icon: "🚀" },
    { id: 5, title: "GTA VI Release Date 2025?", outcome: "NO", side: "Sell", price: 0.12, value: 150.00, pnl: -15.0, pnlAmount: -25, icon: "🎮" }
];

export function PositionsList() {
    const [filter, setFilter] = useState("");

    const filteredPositions = positions.filter(p =>
        p.title.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <Card className="bg-[#1a1d24] border-slate-800 shadow-none flex flex-col">
            <CardHeader className="pb-0 pt-6 px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                    <Tabs defaultValue="active" className="w-full sm:w-auto">
                        <TabsList className="bg-slate-900 border border-slate-800">
                            <TabsTrigger value="active" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">Active</TabsTrigger>
                            <TabsTrigger value="closed" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">Closed</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                        <Input
                            placeholder="Filter positions..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-9 h-9 bg-slate-900 border-slate-800 text-slate-200 text-sm"
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left">
                        <thead className="[&_tr]:border-b [&_tr]:border-slate-800/50">
                            <tr className="border-b transition-colors hover:bg-slate-800/20 data-[state=selected]:bg-muted">
                                <th className="h-10 px-6 text-left align-middle font-medium text-slate-500 w-[50%]">Market</th>
                                <th className="h-10 px-6 text-right align-middle font-medium text-slate-500">Price</th>
                                <th className="h-10 px-6 text-right align-middle font-medium text-slate-500">Value</th>
                                <th className="h-10 px-6 text-right align-middle font-medium text-slate-500">Unrealized PnL</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {filteredPositions.map((pos) => (
                                <tr key={pos.id} className="border-b border-slate-800/30 transition-colors hover:bg-slate-800/30">
                                    <td className="p-6 align-middle py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-full bg-slate-800 flex items-center justify-center text-lg shrink-0">
                                                {pos.icon}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-medium text-slate-200 line-clamp-1">{pos.title}</span>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={pos.outcome === 'YES' ? 'success' : 'danger'} className="text-[10px] h-5 px-1.5 rounded-md">
                                                        {pos.outcome}
                                                    </Badge>
                                                    <span className="text-xs text-slate-500">{pos.side}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6 align-middle text-right py-3 tabular-nums">
                                        <div className="font-medium text-slate-200">{(pos.price * 100).toFixed(1)}¢</div>
                                    </td>
                                    <td className="p-6 align-middle text-right py-3 tabular-nums">
                                        <div className="font-medium text-slate-200">${pos.value.toLocaleString()}</div>
                                        <div className="text-xs text-slate-500">{(pos.value / pos.price).toFixed(0)} shares</div>
                                    </td>
                                    <td className="p-6 align-middle text-right py-3 tabular-nums">
                                        <div className={`font-medium ${pos.pnlAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {pos.pnlAmount >= 0 ? '+' : ''}${pos.pnlAmount}
                                        </div>
                                        <div className={`text-xs ${pos.pnl >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
