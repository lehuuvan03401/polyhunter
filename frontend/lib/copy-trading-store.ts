'use client';

/**
 * Copy Trading Store - Manages active copy trading subscriptions
 * 
 * Uses SDK's SmartMoneyService.startAutoCopyTrading() with dryRun mode for safety.
 * Stores active subscriptions in memory and persists configs to localStorage for recovery.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Copy trading configuration (what gets saved)
export interface CopyTradingConfig {
    id: string;
    traderAddress: string;
    traderName?: string;
    mode: 'percentage' | 'fixed_amount';
    sizeScale?: number;      // For percentage mode: 0.1 = 10%
    fixedAmount?: number;    // For fixed mode: $50
    maxSizePerTrade: number;
    sideFilter?: 'BUY' | 'SELL';
    dryRun: boolean;
    startedAt: number;
    isActive: boolean;
    strategyProfile?: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
}

// Trade log entry
export interface CopyTradeLog {
    id: string;
    configId: string;
    traderAddress: string;
    side: 'BUY' | 'SELL';
    originalSize: number;
    copySize: number;
    price: number;
    market?: string;
    status: 'executed' | 'skipped' | 'failed' | 'simulated';
    message?: string;
    timestamp: number;
}

// Store state
interface CopyTradingState {
    // Persisted configs
    configs: CopyTradingConfig[];
    tradeLogs: CopyTradeLog[];

    // Actions
    addConfig: (config: Omit<CopyTradingConfig, 'startedAt' | 'isActive'> & { id?: string }) => string;
    removeConfig: (id: string) => void;
    updateConfig: (id: string, updates: Partial<CopyTradingConfig>) => void;
    setActive: (id: string, isActive: boolean) => void;

    addTradeLog: (log: Omit<CopyTradeLog, 'id' | 'timestamp'>) => void;
    clearTradeLogs: (configId?: string) => void;

    // Getters
    getActiveConfigs: () => CopyTradingConfig[];
    getConfigsForTrader: (traderAddress: string) => CopyTradingConfig[];
    getLogsForConfig: (configId: string) => CopyTradeLog[];
}

export const useCopyTradingStore = create<CopyTradingState>()(
    persist(
        (set, get) => ({
            configs: [],
            tradeLogs: [],

            addConfig: (config) => {
                // Use provided ID (from DB) or generate temporary one
                const id = 'id' in config && config.id ? config.id : `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const newConfig: CopyTradingConfig = {
                    ...config,
                    id,
                    startedAt: Date.now(),
                    isActive: true,
                };

                set((state) => ({
                    configs: [...state.configs, newConfig],
                }));

                return id;
            },

            removeConfig: (id) => {
                set((state) => ({
                    configs: state.configs.filter((c) => c.id !== id),
                    tradeLogs: state.tradeLogs.filter((l) => l.configId !== id),
                }));
            },

            updateConfig: (id, updates) => {
                set((state) => ({
                    configs: state.configs.map((c) =>
                        c.id === id ? { ...c, ...updates } : c
                    ),
                }));
            },

            setActive: (id, isActive) => {
                set((state) => ({
                    configs: state.configs.map((c) =>
                        c.id === id ? { ...c, isActive } : c
                    ),
                }));
            },

            addTradeLog: (log) => {
                const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                set((state) => ({
                    tradeLogs: [
                        { ...log, id, timestamp: Date.now() },
                        ...state.tradeLogs.slice(0, 99), // Keep last 100 logs
                    ],
                }));
            },

            clearTradeLogs: (configId) => {
                set((state) => ({
                    tradeLogs: configId
                        ? state.tradeLogs.filter((l) => l.configId !== configId)
                        : [],
                }));
            },

            getActiveConfigs: () => get().configs.filter((c) => c.isActive),

            getConfigsForTrader: (traderAddress) =>
                get().configs.filter(
                    (c) => c.traderAddress.toLowerCase() === traderAddress.toLowerCase()
                ),

            getLogsForConfig: (configId) =>
                get().tradeLogs.filter((l) => l.configId === configId),
        }),
        {
            name: 'copy-trading-storage',
            partialize: (state) => ({
                configs: state.configs,
                tradeLogs: state.tradeLogs.slice(0, 50), // Persist only last 50 logs
            }),
        }
    )
);

// Helper to calculate copy size based on config
export function calculateCopySize(
    config: CopyTradingConfig,
    originalSize: number,
    price: number
): number {
    const originalValue = originalSize * price;

    if (config.mode === 'fixed_amount' && config.fixedAmount) {
        // Fixed dollar amount per trade
        return Math.min(config.fixedAmount, config.maxSizePerTrade);
    }

    if (config.mode === 'percentage' && config.sizeScale) {
        // Percentage of original trade
        const scaledValue = originalValue * config.sizeScale;
        return Math.min(scaledValue, config.maxSizePerTrade);
    }

    return 0;
}
