import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatUSD(value: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

/**
 * Parse market slug into human-readable title
 * e.g., "btc-updown-15m-1768895100" -> "BTC 15min Up/Down (3:45 PM)"
 */
export function parseMarketSlug(slug: string | null | undefined, tokenId?: string | null): string {
    if (!slug) {
        // Fallback: show truncated tokenId if available
        if (tokenId) {
            return `Market ${tokenId.slice(0, 8)}...`;
        }
        return 'Unknown Market';
    }

    // Known patterns for time-based markets
    const timePatterns: Record<string, string> = {
        '15m': '15min',
        '1h': '1 Hour',
        '4h': '4 Hour',
        '1d': '1 Day',
    };

    // Try to parse common formats
    // Pattern: {asset}-updown-{timeframe}-{timestamp}
    const upDownMatch = slug.match(/^([a-z]+)-updown-(\d+[mhd])-(\d+)$/i);
    if (upDownMatch) {
        const [, asset, timeframe, timestamp] = upDownMatch;
        const tf = timePatterns[timeframe] || timeframe;
        const date = new Date(parseInt(timestamp) * 1000);
        const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${asset.toUpperCase()} ${tf} Up/Down (${time})`;
    }

    // Pattern: {asset}-price-{target}-{timestamp}
    const priceMatch = slug.match(/^([a-z]+)-price-(\d+)-(\d+)$/i);
    if (priceMatch) {
        const [, asset, target] = priceMatch;
        return `${asset.toUpperCase()} > $${parseInt(target).toLocaleString()}`;
    }

    // Fallback: capitalize and clean up slug
    const cleaned = slug
        .replace(/-\d{10,}$/, '') // Remove trailing timestamp (10+ digits)
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    return cleaned || slug;
}

/**
 * Normalize outcome display
 */
export function parseOutcome(outcome: string | null | undefined): string {
    if (!outcome) return 'N/A';

    // Normalize case and trim whitespace
    const lower = outcome.trim().toLowerCase();

    if (lower === 'yes') return 'Up'; // For up/down markets, Yes usually means Up
    if (lower === 'no') return 'Down';

    // Capitalize first letter
    return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}
