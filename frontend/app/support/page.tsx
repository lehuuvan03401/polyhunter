'use client';

import * as React from 'react';
import { Search, HelpCircle, ChevronRight, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { HELP_CATEGORIES, HelpArticle } from '@/lib/help-data';

export default function HelpPage() {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [expandedCategories, setExpandedCategories] = React.useState<string[]>(HELP_CATEGORIES.map(c => c.title));

    const toggleCategory = (title: string) => {
        setExpandedCategories(prev =>
            prev.includes(title)
                ? prev.filter(t => t !== title)
                : [...prev, title]
        );
    };

    const filteredCategories = HELP_CATEGORIES.map(category => ({
        ...category,
        items: category.items.filter(item =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(category => category.items.length > 0);

    return (
        <div className="min-h-screen bg-[#0a0b0d] text-white pt-20 pb-20 px-4 md:px-0">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col items-center space-y-4 mb-8">
                    <div className="w-12 h-12 bg-[#1C2C24] rounded-full flex items-center justify-center">
                        <HelpCircle className="w-6 h-6 text-[#22C55E]" />
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight">How can we help?</h1>
                </div>

                {/* Search */}
                <div className="relative max-w-xl mx-auto w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search for answers..."
                        className="block w-full pl-10 pr-3 py-2.5 border border-[#2c2d33] rounded-lg leading-5 bg-[#1a1b1e] placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-[#22C55E] focus:border-[#22C55E] sm:text-sm transition-colors text-gray-200"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Categories */}
                <div className="space-y-4 mt-8">
                    {filteredCategories.map((category) => (
                        <div key={category.title} className="border border-[#2c2d33] rounded-xl overflow-hidden bg-[#1a1b1e]">
                            <button
                                onClick={() => toggleCategory(category.title)}
                                className="w-full flex items-center justify-between p-4 bg-[#1e1f24]/50 hover:bg-[#1e1f24] transition-colors text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-[#22C55E] text-xs">▼</span>
                                    <span className="font-medium text-sm text-gray-200">{category.title}</span>
                                </div>
                                {expandedCategories.includes(category.title) ? (
                                    <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                            </button>

                            {expandedCategories.includes(category.title) && (
                                <div className="divide-y divide-[#2c2d33]">
                                    {category.items.map((article) => (
                                        <Link
                                            key={article.slug}
                                            href={`/${article.slug}`}
                                            className="flex items-center justify-between p-4 hover:bg-[#25262b] transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-[#1C2C24] flex items-center justify-center flex-shrink-0 group-hover:bg-[#22C55E]/20 transition-colors">
                                                    <FileText className="w-3 h-3 text-[#22C55E]" />
                                                </div>
                                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                                                    {article.title}
                                                </span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {filteredCategories.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No articles found matching "{searchQuery}"
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
