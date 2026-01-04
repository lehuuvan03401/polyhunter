'use client';

import {
    Copy,
    ExternalLink,
    ShieldCheck,
    Mail,
    Bell,
    FileText,
    Megaphone,
    Zap,
    Crown,
    Fish,
    ChevronRight,
    Key,
    RefreshCw
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function SettingsPage() {
    const { user } = usePrivy();

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <div className="min-h-screen bg-background pt-24 pb-20">
            <div className="container max-w-7xl mx-auto px-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                    <p className="text-muted-foreground">Manage your account and preferences</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 1. Profile Card */}
                    <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 lg:p-8">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                            <h2 className="font-semibold text-lg">Profile</h2>
                        </div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white">
                                {user?.wallet?.address ? user.wallet.address.slice(2, 4).toUpperCase() : 'WA'}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold font-mono">
                                    {user?.wallet?.address ? truncateAddress(user.wallet.address) : '0x...'}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                        Starter Plan
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trading Wallet Address</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        readOnly
                                        value={user?.wallet?.address || ''}
                                        className="w-full bg-[#0a0a0a] border border-[#2c2d33] rounded-lg pl-4 pr-12 py-3 text-sm font-mono text-muted-foreground focus:outline-none"
                                    />
                                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User ID</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={user?.id || ''}
                                    className="w-full bg-[#0a0a0a] border border-[#2c2d33] rounded-lg px-4 py-3 text-sm font-mono text-muted-foreground focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Your Plan Card */}
                    <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 lg:p-8">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-1.5 h-4 bg-yellow-500 rounded-full" />
                            <h2 className="font-semibold text-lg">Your Plan</h2>
                        </div>

                        <div className="text-center mb-10">
                            <div className="inline-flex items-center justify-center h-16 w-16 mb-4 rounded-2xl bg-white/5 mx-auto">
                                <Zap className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-2xl font-bold mb-1">Starter</h3>
                            <p className="text-muted-foreground text-sm">10% profit fee</p>
                        </div>

                        <div className="flex items-center justify-between gap-4 mb-8 px-4">
                            {[
                                { name: "Starter", fee: "10%", icon: Zap, active: true },
                                { name: "Pro", fee: "5%", icon: Crown, active: false },
                                { name: "Whale", fee: "2%", icon: Fish, active: false },
                            ].map((tier, i) => (
                                <div key={i} className={cn("flex flex-col items-center gap-2", !tier.active && "opacity-40")}>
                                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center border", tier.active ? "bg-white/10 border-white/20" : "border-transparent")}>
                                        <tier.icon className="h-5 w-5" />
                                    </div>
                                    <div className="text-xs font-medium">{tier.name}</div>
                                    <div className="text-[10px] text-muted-foreground">{tier.fee}</div>
                                </div>
                            ))}
                        </div>

                        {/* Progress Bar */}
                        <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#2c2d33] mb-6">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="font-medium text-blue-400">Progress to Pro</span>
                                <span className="text-muted-foreground">$0 / $25k</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-0" />
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-2">
                                $25k more to unlock
                            </div>
                        </div>

                        <div className="text-center">
                            <Link href="/pricing" className="text-sm text-green-500 hover:text-green-400 transition-colors inline-flex items-center gap-1">
                                View tier details <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>

                    {/* 3. Security Card */}
                    <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 lg:p-8">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-1.5 h-4 bg-green-500 rounded-full" />
                            <h2 className="font-semibold text-lg">Security</h2>
                        </div>

                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-start gap-4">
                            <ShieldCheck className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-green-500 text-sm mb-1">Non-Custodial</h4>
                                <p className="text-xs text-green-400/80 leading-relaxed">
                                    You always control your funds. We never have access to your private keys.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <button className="w-full flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#2c2d33] hover:border-white/20 transition-colors group">
                                <span className="text-sm font-medium">View on Polygonscan</span>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                            </button>
                            <button className="w-full flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#2c2d33] hover:border-white/20 transition-colors group">
                                <span className="text-sm font-medium">Export Private Key</span>
                                <Key className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                            </button>
                            <button className="w-full flex items-center justify-between p-4 rounded-xl bg-red-950/10 border border-red-900/20 hover:border-red-500/30 transition-colors group">
                                <span className="text-sm font-medium text-red-400">Regenerate Wallet</span>
                                <RefreshCw className="h-4 w-4 text-red-500 group-hover:rotate-180 transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* 4. Notifications Card */}
                    <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-2xl p-6 lg:p-8">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                            <h2 className="font-semibold text-lg">Email Notifications</h2>
                        </div>

                        <div className="space-y-6">
                            {[
                                { icon: Mail, title: "Receive email notifications", desc: "Toggle off to unsubscribe from all" },
                                { icon: Bell, title: "Trading Alerts", desc: "Trade updates, account alerts, tier changes" },
                                { icon: FileText, title: "Weekly Reports", desc: "Weekly performance digest summary" },
                                { icon: Megaphone, title: "Marketing & Referrals", desc: "Product updates, referral earnings, tips" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white mb-0.5">{item.title}</h3>
                                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked={true} />
                                        <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                    </label>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5 text-center">
                            <p className="text-[10px] text-muted-foreground">
                                Note: Critical account and security emails are always sent.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
