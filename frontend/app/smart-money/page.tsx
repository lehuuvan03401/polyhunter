import { Suspense } from 'react';
import { ProxyWalletCard } from '@/components/proxy/proxy-wallet-card';
import { SmartMoneyTable } from '@/components/smart-money/smart-money-table';
import { TableSkeleton } from '@/components/smart-money/table-skeleton';

export const revalidate = 60;

interface SmartMoneyPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SmartMoneyPage({ searchParams }: SmartMoneyPageProps) {
    const resolvedParams = await searchParams;
    const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
    const currentPage = isNaN(page) || page < 1 ? 1 : page;

    return (
        <div className="container py-10">
            <div className="mb-8 space-y-4 text-center">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Automate Your Edge
                </h1>
                <p className="text-muted-foreground text-lg">
                    Discover and follow the most profitable traders on Polymarket.
                </p>
                <div className="flex justify-center gap-4">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500"></span> Live Updates</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Verified Data</span>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Sidebar: Proxy Wallet */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    <ProxyWalletCard />

                    {/* Additional Sidebar Content (optional) */}
                    <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                        <h3 className="font-semibold text-foreground mb-2">How it works</h3>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Create your Smart Wallet proxy.</li>
                            <li>Deposit USDC funds.</li>
                            <li>Select a trader to copy.</li>
                            <li>The bot executes trades for you.</li>
                            <li>Withdraw profits anytime.</li>
                        </ul>
                    </div>
                </div>

                {/* Main Content: Leaderboard */}
                <div className="col-span-12 lg:col-span-9">
                    <div className="rounded-xl border bg-card shadow-sm">
                        <div className="border-b p-6 flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Top Performers</h2>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                Page {currentPage}
                            </span>
                        </div>
                        <div className="p-0">
                            <Suspense key={currentPage} fallback={<TableSkeleton />}>
                                <SmartMoneyTable currentPage={currentPage} />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
