'use client';

import { PrivyProvider } from '@privy-io/react-auth';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <PrivyProvider
            appId="cmjzxbryw02i6lg0c64wd6052"
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#22c55e',
                },
                loginMethods: ['wallet', 'email', 'google', 'twitter'],
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                } as any,
            }}
        >
            <div style={{ display: 'contents' }}>{children}</div>
        </PrivyProvider>
    );
}
