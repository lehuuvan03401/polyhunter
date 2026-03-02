/**
 * Resolve a numeric environment variable with clamped bounds.
 * Falls back to `fallback` when the env var is missing or not a valid finite number.
 */
export function resolveNumberEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}
