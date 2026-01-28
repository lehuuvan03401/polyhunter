'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';

let loginInFlight: Promise<void> | null = null;
const loginListeners = new Set<(value: boolean) => void>();

function notifyLoginListeners(value: boolean) {
    for (const listener of loginListeners) {
        listener(value);
    }
}

export function usePrivyLogin() {
    const privy = usePrivy();
    const [isLoggingIn, setIsLoggingIn] = useState<boolean>(Boolean(loginInFlight));

    useEffect(() => {
        loginListeners.add(setIsLoggingIn);
        return () => {
            loginListeners.delete(setIsLoggingIn);
        };
    }, []);

    const guardedLogin = useCallback(async () => {
        if (!privy.ready || privy.authenticated) return;
        if (loginInFlight) return loginInFlight;

        notifyLoginListeners(true);
        const loginPromise = Promise.resolve(privy.login()).finally(() => {
            loginInFlight = null;
            notifyLoginListeners(false);
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

    return { ...privy, login: guardedLogin, isLoggingIn };
}
