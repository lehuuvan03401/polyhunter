'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy rules page — redirects to the unified affiliate portal (Rules tab).
 * After portal unification, /affiliate/rules → /affiliate?tab=rules.
 */
export default function AffiliateRulesRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/affiliate?tab=rules');
    }, [router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-muted-foreground text-sm animate-pulse">
                Redirecting…
            </div>
        </div>
    );
}
