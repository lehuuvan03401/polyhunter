'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useTransition, useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LanguageOption {
    code: string;
    label: string;
    flag: string;
}

const LANGUAGES: LanguageOption[] = [
    { code: 'zh-TW', label: '繁體中文', flag: '🇭🇰' },
    { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
];

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLanguageChange = (nextLocale: string) => {
        if (nextLocale === locale) {
            setIsOpen(false);
            return;
        }

        setIsOpen(false);
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    const currentLanguage = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isPending}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200",
                    "bg-white/5 border border-white/10 hover:bg-white/10",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20",
                    isOpen && "bg-white/10 border-white/20"
                )}
            >
                <span className="text-base leading-none">{currentLanguage.flag}</span>
                <span className="text-sm font-medium hidden sm:inline-block">
                    {currentLanguage.label}
                </span>
                <ChevronDown
                    className={cn(
                        "h-3 w-3 text-muted-foreground transition-transform duration-200",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden"
                    >
                        <div className="p-1">
                            {LANGUAGES.map((language) => (
                                <button
                                    key={language.code}
                                    onClick={() => handleLanguageChange(language.code)}
                                    className={cn(
                                        "flex w-full items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors group",
                                        language.code === locale
                                            ? "bg-white/10 text-white"
                                            : "text-muted-foreground hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-base leading-none">{language.flag}</span>
                                        <span className="font-medium">{language.label}</span>
                                    </div>
                                    {language.code === locale && (
                                        <Check className="h-3.5 w-3.5 text-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
