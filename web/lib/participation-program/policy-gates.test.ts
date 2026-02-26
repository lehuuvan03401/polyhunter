import { describe, expect, it } from 'vitest';
import {
    resolveManagedPolicyGate,
    resolveSameLevelBonusPolicy,
} from './policy-gates';

describe('participation policy gates', () => {
    describe('resolveManagedPolicyGate', () => {
        it('enforces gate in production by default', () => {
            expect(resolveManagedPolicyGate(undefined, 'production')).toBe(true);
        });

        it('keeps gate enforced in production even when env is false', () => {
            expect(resolveManagedPolicyGate('false', 'production')).toBe(true);
        });

        it('allows opt-in outside production', () => {
            expect(resolveManagedPolicyGate('true', 'test')).toBe(true);
        });

        it('defaults to disabled outside production', () => {
            expect(resolveManagedPolicyGate(undefined, 'test')).toBe(false);
            expect(resolveManagedPolicyGate('false', 'development')).toBe(false);
        });
    });

    describe('resolveSameLevelBonusPolicy', () => {
        it('defaults to enabled in production', () => {
            expect(resolveSameLevelBonusPolicy(undefined, 'production')).toEqual({
                enabled: true,
                auditMessage: null,
            });
        });

        it('supports break-glass disablement in production with audit message', () => {
            const result = resolveSameLevelBonusPolicy('false', 'production');
            expect(result.enabled).toBe(false);
            expect(result.auditMessage).toContain('AUDIT');
        });

        it('is opt-in outside production', () => {
            expect(resolveSameLevelBonusPolicy(undefined, 'test')).toEqual({
                enabled: false,
                auditMessage: null,
            });
            expect(resolveSameLevelBonusPolicy('true', 'test')).toEqual({
                enabled: true,
                auditMessage: null,
            });
        });
    });
});
