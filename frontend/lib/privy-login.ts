'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect } from 'react';

let loginInFlight: Promise<void> | null = null;

export function usePrivyLogin() {
    const privy = usePrivy();

    const guardedLogin = useCallback(async () => {
        if (!privy.ready || privy.authenticated) return;
        if (loginInFlight) return loginInFlight;

        const loginPromise = Promise.resolve(privy.login()).finally(() => {
            loginInFlight = null;
        });

        loginInFlight = loginPromise;
        return loginPromise;
    }, [privy.authenticated, privy.ready, privy.login]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        (window as any).privy = {
            ...(window as any).privy,
            login: guardedLogin,
        };
    }, [guardedLogin]);

    return { ...privy, login: guardedLogin };
}
