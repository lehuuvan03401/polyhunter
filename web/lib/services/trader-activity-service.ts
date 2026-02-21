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
const DEFAULT_MAX_OFFSET = 3000;

type ApiLikeError = {
    code?: string;
    message?: string;
};

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

function resolveActivityMaxOffset(): number {
    const raw = process.env.TRADER_ACTIVITY_MAX_OFFSET;
    if (typeof raw === 'string' && raw.trim() !== '') {
        const configured = Number(raw);
        if (Number.isFinite(configured) && configured >= 0) {
            return Math.floor(configured);
        }
    }
    return DEFAULT_MAX_OFFSET;
}

function isInvalidResponseError(error: unknown): error is ApiLikeError {
    if (!error || typeof error !== 'object') return false;
    const code = 'code' in error ? String((error as ApiLikeError).code || '') : '';
    const message = 'message' in error ? String((error as ApiLikeError).message || '') : '';
    return code === 'INVALID_RESPONSE' || message.toLowerCase().includes('bad request');
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
    const maxOffset = resolveActivityMaxOffset();
    const maxItemsByOffset = maxOffset + ACTIVITY_PAGE_LIMIT;
    const effectiveMaxItems = Math.min(maxItems, maxItemsByOffset);
    const normalizedAddress = address.toLowerCase();

    const all: ActivityLike[] = [];
    let offset = 0;

    while (all.length < effectiveMaxItems && offset <= maxOffset) {
        try {
            const page = await polyClient.dataApi.getActivity(normalizedAddress, {
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
        } catch (error) {
            if (isInvalidResponseError(error)) {
                // Data API may reject deep offsets for hot wallets; keep collected pages.
                if (offset > 0 || all.length > 0) {
                    break;
                }
                return [];
            }
            throw error;
        }
    }

    return all.slice(0, effectiveMaxItems);
}
