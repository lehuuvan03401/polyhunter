
import { ethers } from 'ethers';

interface GasFeeResponse {
    safeLow: { maxPriorityFee: number; maxFee: number };
    standard: { maxPriorityFee: number; maxFee: number };
    fast: { maxPriorityFee: number; maxFee: number };
    estimatedBaseFee: number;
    blockTime: number;
    blockNumber: number;
}

export class GasStationService {
    private static GAS_STATION_URL = 'https://gasstation.polygon.technology/v2';
    private lastFetch: number = 0;
    private cache: GasFeeResponse | null = null;
    private readonly CACHE_TTL_MS = 3000; // 3 seconds cache

    async getGasFees(): Promise<ethers.Overrides> {
        try {
            const now = Date.now();
            if (this.cache && (now - this.lastFetch < this.CACHE_TTL_MS)) {
                return this.formatGas(this.cache.fast);
            }

            const response = await fetch(GasStationService.GAS_STATION_URL);
            if (!response.ok) {
                throw new Error(`Gas Station Error: ${response.statusText}`);
            }

            const data: GasFeeResponse = await response.json();
            this.cache = data;
            this.lastFetch = now;

            // Console log for visibility on highly active trading
            // console.log(`[Gas] Fast: ${data.fast.maxFee.toFixed(1)} Gwei`);

            return this.formatGas(data.fast);
        } catch (error) {
            console.warn('[GasStation] Failed to fetch gas fees, falling back to defaults:', error);
            // Fallback for Polygon (aggressive default to ensure mining)
            return {
                maxFeePerGas: ethers.utils.parseUnits('200', 'gwei'),
                maxPriorityFeePerGas: ethers.utils.parseUnits('50', 'gwei'),
            };
        }
    }

    private formatGas(level: { maxPriorityFee: number; maxFee: number }): ethers.Overrides {
        return {
            maxFeePerGas: ethers.utils.parseUnits(Math.ceil(level.maxFee).toString(), 'gwei'),
            maxPriorityFeePerGas: ethers.utils.parseUnits(Math.ceil(level.maxPriorityFee).toString(), 'gwei'),
        };
    }
}

export const gasStation = new GasStationService();
