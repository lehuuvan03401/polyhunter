import Image from 'next/image';
import Link from 'next/link';

export function Footer() {
    return (
        <footer className="bg-background py-16 text-sm text-muted-foreground border-t border-white/5">
            <div className="container max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-16">
                    {/* Brand Column (Width: 2/12 or 3/12 depending on spacing) */}
                    <div className="md:col-span-3 pr-4">
                        <Link href="/" className="flex items-center space-x-2 mb-4">
                            <div className="relative h-8 w-8 overflow-hidden rounded-full">
                                <img
                                    src="/horus.png"
                                    alt="Horus Logo"
                                    className="object-cover w-full h-full"
                                />
                            </div>
                            <span className="font-bold text-lg text-white tracking-tight">
                                Horus
                            </span>
                        </Link>
                        <p className="leading-relaxed max-w-xs text-muted-foreground">
                            Pro-level Polymarket copy trading, simplified for everyone.
                        </p>
                    </div>

                    {/* Links Columns (Remaining 9/12 split into 5 columns? No, usually 5 cols take up rest. 
              Let's utilize the remaining space evenly.) */}

                    <div className="md:col-span-9 grid grid-cols-2 md:grid-cols-5 gap-8">
                        <div className="col-span-1">
                            <h3 className="font-bold text-white mb-6">Copy Trading</h3>
                            <ul className="space-y-4">
                                <li><Link href="#" className="hover:text-white transition-colors">Top Traders</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Best Traders to Follow</Link></li>
                                <li><Link href="/smart-money" className="hover:text-white transition-colors">Best Traders Leaderboard</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">How to Copy Trade</Link></li>
                                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing & Plans</Link></li>
                            </ul>
                        </div>

                        <div className="col-span-1">
                            <h3 className="font-bold text-white mb-6">Guides</h3>
                            <ul className="space-y-4">
                                <li><Link href="#" className="hover:text-white transition-colors">Ultimate Guide</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Wallet Setup Guide</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">For Beginners</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">How to Make Money</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">How to Withdraw</Link></li>
                            </ul>
                        </div>

                        <div className="col-span-1">
                            <h3 className="font-bold text-white mb-6">Markets</h3>
                            <ul className="space-y-4">
                                <li><Link href="#" className="hover:text-white transition-colors">Crypto Markets</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Election Markets</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Sports Betting</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Trading Tips</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">vs Kalshi</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">vs Metaculus</Link></li>
                            </ul>
                        </div>

                        <div className="col-span-1">
                            <h3 className="font-bold text-white mb-6">Tools</h3>
                            <ul className="space-y-4">
                                <li><Link href="#" className="hover:text-white transition-colors">Profit Calculator</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">ROI Calculator</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Odds Converter</Link></li>
                            </ul>
                        </div>

                        <div className="col-span-1">
                            <h3 className="font-bold text-white mb-6">Help & Support</h3>
                            <ul className="space-y-4">
                                <li><Link href="#" className="hover:text-white transition-colors">How to Fund Wallet</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Understanding Fees</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Trade Not Executing?</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Pending Payouts</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Non-Custodial Wallet</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Copy Trading Settings</Link></li>
                                <li><Link href="#" className="hover:text-white transition-colors">Choosing Traders</Link></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
                    <div>© 2026 Horus. All rights reserved.</div>
                    <div className="flex gap-6">
                        <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
                        <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
