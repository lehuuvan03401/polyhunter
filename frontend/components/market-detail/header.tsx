import { GammaMarket } from '@catalyst-team/poly-sdk';
import { Badge } from 'lucide-react'; // Placeholder icon if needed, but Badge is a component usually
import { cn } from '@/lib/utils';

interface MarketHeaderProps {
    market: GammaMarket;
}

export function MarketHeader({ market }: MarketHeaderProps) {
    const volume = market.volume24hr || market.volume;
    const yesPrice = market.outcomePrices[0] || 0.5;

    return (
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                    {market.icon && <img src={market.icon} alt="Icon" className="h-8 w-8 rounded-full" />}
                    {market.active ? (
                        <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">
                            Active
                        </span>
                    ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-500/10 px-2 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-500/20">
                            Closed
                        </span>
                    )}
                </div>

                <h1 className="text-3xl font-bold tracking-tight md:text-4xl text-foreground">
                    {market.question}
                </h1>

                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex flex-col">
                        <span className="text-xs">Volume (24h)</span>
                        <span className="font-mono font-medium text-foreground">${volume?.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs">Liquidity</span>
                        <span className="font-mono font-medium text-foreground">${market.liquidity?.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs">End Date</span>
                        <span className="font-medium text-foreground">{market.endDate ? new Date(market.endDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
                <div className="text-center">
                    <div className="text-sm font-medium text-muted-foreground">YES</div>
                    <div className="text-3xl font-bold text-green-500">{(yesPrice * 100).toFixed(1)}%</div>
                </div>
                <div className="h-10 w-px bg-border" />
                <div className="text-center">
                    <div className="text-sm font-medium text-muted-foreground">NO</div>
                    <div className="text-3xl font-bold text-red-500">{((1 - yesPrice) * 100).toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}
