'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextLocale = e.target.value;
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    return (
        <div className="relative inline-block text-left">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <select
                    defaultValue={locale}
                    onChange={handleLanguageChange}
                    disabled={isPending}
                    className="bg-transparent border-none text-sm text-foreground focus:ring-0 cursor-pointer appearance-none pr-4 outline-none"
                >
                    <option value="en" className="bg-zinc-900 text-foreground">English</option>
                    <option value="zh-CN" className="bg-zinc-900 text-foreground">简体中文</option>
                    <option value="zh-TW" className="bg-zinc-900 text-foreground">繁體中文</option>
                </select>
            </div>
        </div>
    );
}
