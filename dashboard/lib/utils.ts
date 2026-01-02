import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toFixed(0);
}

export function formatCurrency(amount: number, decimals: number = 2): string {
    return `$${amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

export function shortenAddress(address: string, chars: number = 4): string {
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
