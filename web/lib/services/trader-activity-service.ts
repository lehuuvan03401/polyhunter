import { polyClient } from '@/lib/polymarket';

export type ActivityLike = {
    type?: string;
    side?: 'BUY' | 'SELL';
    size?: number;
    price?: number;
    usdcSize?: number;
    timestamp?: number;
    asset?: string;
    conditionId?: string;
    tokenId?: string;
};

type FetchTraderActivitiesOptions = {
    startSec: number;
    maxItems?: number;
    type?: 'TRADE' | 'SPLIT' | 'MERGE' | 'REDEEM' | 'REWARD' | 'CONVERSION';
};

const ACTIVITY_PAGE_LIMIT = 500;
const DEFAULT_ACTIVITY_MAX_ITEMS = 3000;
const MIN_ACTIVITY_MAX_ITEMS = 500;
const MAX_ACTIVITY_MAX_ITEMS = 10000;

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function normalizeTimestampSeconds(timestamp: number): number {
    if (!Number.isFinite(timestamp)) return 0;
    return timestamp > 1e12 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
}

export function resolveActivityMaxItems(periodDays: number): number {
    const configured = Number(process.env.TRADER_ACTIVITY_MAX_ITEMS || '');
    if (Number.isFinite(configured) && configured > 0) {
        return clamp(Math.floor(configured), MIN_ACTIVITY_MAX_ITEMS, MAX_ACTIVITY_MAX_ITEMS);
    }

    if (periodDays <= 7) return 1200;
    if (periodDays <= 15) return 2000;
    if (periodDays <= 30) return 3200;
    if (periodDays <= 90) return 5000;
    return DEFAULT_ACTIVITY_MAX_ITEMS;
}

export async function fetchTraderActivities(
    address: string,
    options: FetchTraderActivitiesOptions
): Promise<ActivityLike[]> {
    const maxItems = clamp(
        Math.floor(options.maxItems ?? DEFAULT_ACTIVITY_MAX_ITEMS),
        MIN_ACTIVITY_MAX_ITEMS,
        MAX_ACTIVITY_MAX_ITEMS
    );

    try {
        const activities = await polyClient.dataApi.getAllActivity(
            address,
            {
                start: options.startSec,
                type: options.type,
            },
            maxItems
        );
        return activities as ActivityLike[];
    } catch (error) {
        console.warn(
            `[TraderActivity] getAllActivity failed for ${address}, fallback to paginated getActivity`,
            error
        );
    }

    const all: ActivityLike[] = [];
    let offset = 0;

    while (all.length < maxItems) {
        const page = await polyClient.dataApi.getActivity(address, {
            start: options.startSec,
            type: options.type,
            limit: ACTIVITY_PAGE_LIMIT,
            offset,
        });

        all.push(...(page as ActivityLike[]));

        if (page.length < ACTIVITY_PAGE_LIMIT) {
            break;
        }
        offset += ACTIVITY_PAGE_LIMIT;
    }

    return all.slice(0, maxItems);
}
