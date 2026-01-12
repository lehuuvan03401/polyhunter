export interface HelpArticle {
    title: string;
    slug: string;
    category: string;
    content?: string; // HTML or Markdown content
}

export interface HelpCategory {
    title: string;
    items: HelpArticle[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
    {
        title: 'Getting Started',
        items: [
            { title: 'A Beginner’s Guide', slug: 'beginners-guide', category: 'Getting Started' },
            { title: 'Making your first trade', slug: 'your-first-trade', category: 'Getting Started' },
            { title: 'The Polymarket check', slug: 'polymarket-check', category: 'Getting Started' },
            { title: 'Intro to markets', slug: 'intro-to-markets', category: 'Getting Started' },
            { title: 'How to deposit funds', slug: 'how-to-deposit', category: 'Getting Started' },
            { title: 'Create a username', slug: 'create-username', category: 'Getting Started' },
            { title: 'Registration restrictions', slug: 'registration-restrictions', category: 'Getting Started' },
            { title: 'Twitter profile linking', slug: 'twitter-linking', category: 'Getting Started' },
            { title: 'Share your positions', slug: 'share-positions', category: 'Getting Started' },
            { title: 'Using a VPN', slug: 'using-vpn', category: 'Getting Started' },
            { title: 'How trading on Polymarket works', slug: 'how-trading-works', category: 'Getting Started' },
            { title: 'Account funding methods', slug: 'funding-methods', category: 'Getting Started' },
            { title: 'The "Yes" or "No" Shares', slug: 'yes-no-shares', category: 'Getting Started' },
        ]
    },
    {
        title: 'Deposit Funds',
        items: [
            { title: 'Deposit from Coinbase', slug: 'deposit-coinbase', category: 'Deposit Funds' },
            { title: 'Deposit from Other Exchanges', slug: 'deposit-other-exchanges', category: 'Deposit Funds' },
            { title: 'Buy USDC on Polymarket', slug: 'buy-usdc', category: 'Deposit Funds' },
            { title: 'Deposit via Polygon Bridge', slug: 'polygon-bridge', category: 'Deposit Funds' },
            { title: 'Deposit with MetaMask', slug: 'deposit-metamask', category: 'Deposit Funds' },
            { title: 'Cross-Chain Deposits', slug: 'cross-chain-deposits', category: 'Deposit Funds' },
            { title: 'The minimal deposit amount', slug: 'min-deposit', category: 'Deposit Funds' },
            { title: 'How to check my deposit address', slug: 'check-deposit-address', category: 'Deposit Funds' },
            { title: 'Withdrawal guide', slug: 'withdrawal-guide', category: 'Deposit Funds' },
            { title: 'My deposit hasn’t arrived', slug: 'deposit-delay', category: 'Deposit Funds' },
            { title: 'Wrong network deposit', slug: 'wrong-network', category: 'Deposit Funds' },
            { title: 'Lowering deposit fees', slug: 'lower-fees', category: 'Deposit Funds' },
            { title: 'Adding USDC to MetaMask', slug: 'add-usdc-metamask', category: 'Deposit Funds' },
            { title: 'Recovering sent funds', slug: 'recover-funds', category: 'Deposit Funds' },
            { title: 'Transferring between wallets', slug: 'transfer-wallets', category: 'Deposit Funds' },
            { title: 'Safe transfers', slug: 'safe-transfers', category: 'Deposit Funds' },
            { title: 'Address book management', slug: 'address-book', category: 'Deposit Funds' },
            { title: 'Token recovery', slug: 'token-recovery', category: 'Deposit Funds' },
            { title: 'Transaction delays', slug: 'transaction-delays', category: 'Deposit Funds' },
            { title: 'Gas fees explained', slug: 'gas-fees', category: 'Deposit Funds' },
            { title: 'Network congestion', slug: 'network-congestion', category: 'Deposit Funds' },
            { title: 'Using Layer 2', slug: 'layer-2', category: 'Deposit Funds' },
            { title: 'Bridging assets', slug: 'bridging-assets', category: 'Deposit Funds' },
            { title: 'Wallet compatibility', slug: 'wallet-compatibility', category: 'Deposit Funds' },
            { title: 'Exchange withdrawals', slug: 'exchange-withdrawals', category: 'Deposit Funds' },
        ]
    },
    {
        title: 'Markets',
        items: [
            { title: 'How market resolution works', slug: 'market-resolution', category: 'Markets' },
            { title: 'Market disputes', slug: 'market-disputes', category: 'Markets' },
            { title: 'UMA Oracle', slug: 'uma-oracle', category: 'Markets' },
            { title: "What is 'Liquidity'?", slug: 'liquidity', category: 'Markets' },
            { title: 'The Order Book', slug: 'order-book', category: 'Markets' },
            { title: 'Creating a market', slug: 'create-market', category: 'Markets' },
            { title: 'Fees', slug: 'fees', category: 'Markets' },
            { title: 'AMMs vs Order Books', slug: 'amm-vs-orderbook', category: 'Markets' },
            { title: 'Limit Orders', slug: 'limit-orders', category: 'Markets' },
            { title: 'Market categories', slug: 'market-categories', category: 'Markets' },
            { title: 'The "Top" markets', slug: 'top-markets', category: 'Markets' },
        ]
    },
    {
        title: 'Profile & Settings',
        items: [
            { title: 'Change username', slug: 'change-username', category: 'Profile & Settings' },
            { title: 'Email preferences', slug: 'email-preferences', category: 'Profile & Settings' },
            { title: 'Privacy settings', slug: 'privacy-settings', category: 'Profile & Settings' },
            { title: 'Export trade history', slug: 'export-history', category: 'Profile & Settings' },
            { title: 'API Keys', slug: 'api-keys', category: 'Profile & Settings' },
            { title: 'Referral program', slug: 'referral-program', category: 'Profile & Settings' },
            { title: 'Two-Factor Authentication', slug: '2fa', category: 'Profile & Settings' },
            { title: 'Recover account', slug: 'recover-account', category: 'Profile & Settings' },
            { title: 'Close account', slug: 'close-account', category: 'Profile & Settings' },
        ]
    }
];

export const ALL_ARTICLES = HELP_CATEGORIES.flatMap(cat => cat.items);

export function getArticleBySlug(slug: string) {
    return ALL_ARTICLES.find(article => article.slug === slug);
}
