import WalletDetailClient from './wallet-detail-client';

export default async function WalletDetailPage({
    params
}: {
    params: Promise<{ address: string }>
}) {
    const { address } = await params;
    return <WalletDetailClient address={address} />;
}
