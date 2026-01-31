import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { Toaster } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import Providers from '../providers';
import { ReferralProvider } from '@/components/providers/referral-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Horus - Pro-level Polymarket Copy Trading',
    description: 'Automate your edge. Follow proven traders with verified win rates.',
};

export default async function LocaleLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // Ensure that the incoming `locale` is valid
    if (!routing.locales.includes(locale as any)) {
        notFound();
    }

    // Providing all messages to the client
    // side is the easiest way to get started
    const messages = await getMessages();

    return (
        <html lang={locale} className="dark">
            <body className={inter.className}>
                <NextIntlClientProvider messages={messages}>
                    <Providers>
                        <ReferralProvider>
                            <Navbar />
                            <main className="flex-1 min-h-screen">
                                {children}
                            </main>
                            <Footer />
                            <Toaster position="top-center" richColors theme="dark" />
                        </ReferralProvider>
                    </Providers>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
