export type SpeedProfile = {
    name: 'standard' | 'speed';
    maxSpreadBps: number;
    minDepthUsd: number;
    minDepthRatio: number;
    depthLevels: number;
};

const STANDARD_PROFILE: SpeedProfile = {
    name: 'standard',
    maxSpreadBps: 150, // 1.5%
    minDepthUsd: 2,
    minDepthRatio: 1.0,
    depthLevels: 5,
};

const SPEED_PROFILE: SpeedProfile = {
    name: 'speed',
    maxSpreadBps: 80, // 0.8%
    minDepthUsd: 10,
    minDepthRatio: 1.2,
    depthLevels: 5,
};

const readNumber = (value: string | undefined, fallback: number): number => {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export function getSpeedProfile(): SpeedProfile {
    const envProfile = (process.env.COPY_TRADING_SPEED_PROFILE || '').toLowerCase();
    const speedMode = process.env.COPY_TRADING_SPEED_MODE === 'true';
    const base = (envProfile === 'speed' || speedMode) ? SPEED_PROFILE : STANDARD_PROFILE;

    return {
        name: base.name,
        maxSpreadBps: readNumber(process.env.COPY_TRADING_MAX_SPREAD_BPS, base.maxSpreadBps),
        minDepthUsd: readNumber(process.env.COPY_TRADING_MIN_DEPTH_USD, base.minDepthUsd),
        minDepthRatio: readNumber(process.env.COPY_TRADING_MIN_DEPTH_RATIO, base.minDepthRatio),
        depthLevels: Math.max(1, Math.floor(readNumber(process.env.COPY_TRADING_DEPTH_LEVELS, base.depthLevels))),
    };
}
