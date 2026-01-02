"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Repeat, Settings, Wallet, ArrowRightLeft, Shield, ChevronRight } from "lucide-react";

const actions = [
    { label: "Analytics", icon: BarChart3, href: "/analytics", color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Arbitrage", icon: Repeat, href: "/arbitrage", color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Copy Trade", icon: ArrowRightLeft, href: "/smart-money/copy-trading", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "On-Chain", icon: Shield, href: "/onchain", color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Deposits", icon: Wallet, href: "/wallet", color: "text-pink-500", bg: "bg-pink-500/10" },
    { label: "Settings", icon: Settings, href: "/settings", color: "text-slate-400", bg: "bg-slate-500/10" },
];

export function QuickActions() {
    return (
        <Card className="h-full bg-card border-border shadow-none">
            <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-medium text-foreground">Percentage Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
                <div className="grid grid-cols-1 gap-2">
                    {actions.map((action) => (
                        <Link key={action.label} href={action.href}>
                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer border border-transparent hover:border-border/50">
                                <div className={`p-2 rounded-md ${action.bg} ${action.color}`}>
                                    <action.icon className="size-4" />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                                    {action.label}
                                </span>
                                <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground" />
                            </div>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
