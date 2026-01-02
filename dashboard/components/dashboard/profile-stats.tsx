"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Award, Wallet } from "lucide-react";

export function ProfileStats() {
    return (
        <Card className="h-full bg-[#1a1d24] border-slate-800 shadow-none">
            <CardContent className="p-6 flex flex-col items-center text-center h-full justify-center space-y-6">
                <div className="relative">
                    <Avatar className="size-24 border-2 border-slate-700">
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback className="text-2xl">VK</AvatarFallback>
                    </Avatar>
                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 bg-slate-800 text-slate-300 border-slate-700">
                        @VitalikButerin
                    </Badge>
                </div>

                <div className="grid grid-cols-3 gap-8 w-full">
                    <div className="flex flex-col items-center">
                        <span className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total PnL</span>
                        <span className="text-2xl font-bold text-emerald-500 tabular-nums">+$12.4k</span>
                        <div className="flex items-center text-xs text-emerald-500 mt-1">
                            <TrendingUp className="size-3 mr-1" /> 14.2%
                        </div>
                    </div>

                    <div className="flex flex-col items-center border-x border-slate-800/50 px-4">
                        <span className="text-slate-500 text-xs uppercase tracking-wider mb-1">Portfolio</span>
                        <span className="text-2xl font-bold text-white tabular-nums">$45.2k</span>
                        <div className="flex items-center text-xs text-slate-400 mt-1">
                            <Wallet className="size-3 mr-1" /> Value
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <span className="text-slate-500 text-xs uppercase tracking-wider mb-1">Volume</span>
                        <span className="text-2xl font-bold text-white tabular-nums">842</span>
                        <div className="flex items-center text-xs text-slate-400 mt-1">
                            <Award className="size-3 mr-1" /> Trades
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
