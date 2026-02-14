'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';

let loginInFlight: Promise<void> | null = null;
const loginListeners = new Set<(value: boolean) => void>();
type PrivyWindow = Window & {
    privy?: {
        login?: () => Promise<void>;
        [key: string]: unknown;
    };
};

function notifyLoginListeners(value: boolean) {
    for (const listener of loginListeners) {
        listener(value);
    }
}

export function usePrivyLogin() {
    const privy = usePrivy();
    const [isLoggingIn, setIsLoggingIn] = useState<boolean>(Boolean(loginInFlight));
    const mockAuthEnabled = process.env.NEXT_PUBLIC_E2E_MOCK_AUTH === 'true';
    const mockWalletAddress = (process.env.NEXT_PUBLIC_E2E_MOCK_WALLET || '').toLowerCase();

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
    }, [privy]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const globalWindow = window as PrivyWindow;
        globalWindow.privy = {
            ...(globalWindow.privy ?? {}),
            login: guardedLogin,
        };
    }, [guardedLogin]);

    if (mockAuthEnabled && mockWalletAddress) {
        const mockUser = {
            ...((privy.user as Record<string, unknown> | null) ?? {}),
            wallet: {
                ...((privy.user as { wallet?: Record<string, unknown> } | null)?.wallet ?? {}),
                address: mockWalletAddress,
            },
        } as typeof privy.user;

        return {
            ...privy,
            ready: true,
            authenticated: true,
            user: mockUser,
            login: async () => {},
            isLoggingIn: false,
        };
    }

    return { ...privy, login: guardedLogin, isLoggingIn };
}
