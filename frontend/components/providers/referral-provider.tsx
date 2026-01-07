'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { affiliateApi } from '@/lib/affiliate-api';
import { toast } from 'sonner';

/**
 * ReferralProvider
 * 
 * 1. Captures 'ref' param from URL and stores in localStorage
 * 2. Listens for user wallet authentication
 * 3. Calls tracking API to bind user to referrer
 */
export function ReferralProvider({ children }: { children: React.ReactNode }) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const { authenticated, user, ready } = usePrivy();
    const trackedRef = useRef<boolean>(false);

    // 1. Capture Ref Code
    useEffect(() => {
        const refCode = searchParams.get('ref');
        if (refCode) {
            console.log('[Referral] Found code:', refCode);
            localStorage.setItem('poly_referral_code', refCode);

            // Optional: Clean URL
            // const params = new URLSearchParams(searchParams.toString());
            // params.delete('ref');
            // router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, pathname, router]);

    // 2. Track on Auth
    useEffect(() => {
        const trackUser = async () => {
            if (!ready || !authenticated || !user?.wallet?.address) return;
            if (trackedRef.current) return;

            const storedRefCode = localStorage.getItem('poly_referral_code');
            if (!storedRefCode) return;

            // Avoid re-tracking if we already know this user is tracked locally in this session
            // Realistically, backend prevents duplicates, so we can just fire and forget.
            trackedRef.current = true;

            try {
                console.log('[Referral] Tracking user:', user.wallet.address, 'with code:', storedRefCode);
                const result = await affiliateApi.trackReferral(storedRefCode, user.wallet.address);

                if (result.success) {
                    console.log('[Referral] Success');
                    // Clear storage to prevent future calls
                    localStorage.removeItem('poly_referral_code');
                } else if (result.error === 'Already tracked' || result.error === 'Cannot refer yourself') {
                    // Also clear if already tracked or invalid to stop retrying
                    localStorage.removeItem('poly_referral_code');
                }
            } catch (error) {
                console.error('[Referral] Tracking failed', error);
            }
        };

        trackUser();
    }, [ready, authenticated, user]);

    return <>{children}</>;
}
