'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { affiliateApi } from '@/lib/affiliate-api';
import { toast } from 'sonner';

/**
 * ReferralCapture - Handles URL param capture
 * Separated to allow Suspense wrapping for useSearchParams
 */
function ReferralCapture() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const refCode = searchParams.get('ref');
        if (refCode) {
            console.log('[Referral] Found code:', refCode);
            localStorage.setItem('poly_referral_code', refCode);
        }
    }, [searchParams, pathname, router]);

    return null;
}

/**
 * ReferralTracker - Handles user tracking on authentication
 */
function ReferralTracker() {
    const { authenticated, user, ready } = usePrivy();
    const trackedRef = useRef<boolean>(false);

    useEffect(() => {
        const trackUser = async () => {
            if (!ready || !authenticated || !user?.wallet?.address) return;
            if (trackedRef.current) return;

            const storedRefCode = localStorage.getItem('poly_referral_code');
            if (!storedRefCode) return;

            trackedRef.current = true;

            try {
                console.log('[Referral] Tracking user:', user.wallet.address, 'with code:', storedRefCode);
                const result = await affiliateApi.trackReferral(storedRefCode, '', user.wallet.address);

                if (result.success) {
                    console.log('[Referral] Success');
                    localStorage.removeItem('poly_referral_code');
                } else if (result.error === 'Already tracked' || result.error === 'Cannot refer yourself') {
                    localStorage.removeItem('poly_referral_code');
                }
            } catch (error) {
                console.error('[Referral] Tracking failed', error);
            }
        };

        trackUser();
    }, [ready, authenticated, user]);

    return null;
}

/**
 * ReferralProvider
 * 
 * 1. Captures 'ref' param from URL and stores in localStorage
 * 2. Listens for user wallet authentication
 * 3. Calls tracking API to bind user to referrer
 */
export function ReferralProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Suspense fallback={null}>
                <ReferralCapture />
            </Suspense>
            <ReferralTracker />
            {children}
        </>
    );
}
