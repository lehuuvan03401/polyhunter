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
                    logo: 'https://polymarket.com/logo.png', // We could use a PolyHunter logo here
                },
                embeddedWallets: {
                    ethereum: {
                        createOnLogin: 'users-without-wallets',
                    },
                },
            }}
        >
            {children}
        </PrivyProvider>
    );
}
