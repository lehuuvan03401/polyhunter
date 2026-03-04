'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy participation page — redirects to the unified affiliate portal (Account tab).
 * This page previously hosted the Participation Dashboard. After the portal unification,
 * /participation is now redirected to /affiliate?tab=account.
 */
export default function ParticipationRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/affiliate?tab=account');
    }, [router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-muted-foreground text-sm animate-pulse">
                Redirecting…
            </div>
        </div>
    );
}
