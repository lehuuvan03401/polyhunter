"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search } from "lucide-react";

export function DashboardHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-[#0e1116]/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center px-4 gap-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 mr-4">
                    <div className="size-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                        P
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent hidden md:block">
                        Polymarket Pro
                    </span>
                </Link>

                {/* Search */}
                <div className="flex-1 max-w-md mx-auto hidden md:block relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                    <Input
                        placeholder="Search markets, users, or tags..."
                        className="pl-9 bg-[#1a1d24] border-slate-800 text-slate-200 focus-visible:ring-blue-500/50"
                    />
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4 ml-auto">
                    <Button variant="ghost" className="text-slate-400 hover:text-white hidden sm:flex">
                        Portfolio
                    </Button>
                    <Button variant="ghost" className="text-slate-400 hover:text-white hidden sm:flex">
                        Cash
                    </Button>
                    <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-400">0x12...4567</p>
                            <p className="text-xs font-bold text-emerald-500">$24,502.10</p>
                        </div>
                        <Avatar className="size-9 border border-slate-700">
                            <AvatarImage src="https://github.com/shadcn.png" />
                            <AvatarFallback>CN</AvatarFallback>
                        </Avatar>
                    </div>
                </div>
            </div>
        </header>
    );
}
