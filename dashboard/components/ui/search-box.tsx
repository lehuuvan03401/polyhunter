'use client';

import { useState } from 'react';

interface SearchBoxProps {
    placeholder?: string;
    onSearch: (query: string) => void;
    className?: string;
}

export function SearchBox({ placeholder = 'Search...', onSearch, className = '' }: SearchBoxProps) {
    const [query, setQuery] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        onSearch(value);
    };

    const handleClear = () => {
        setQuery('');
        onSearch('');
    };

    return (
        <div className={`relative ${className}`}>
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-silver-500">
                🔍
            </span>
            <input
                type="text"
                value={query}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full pl-12 pr-10 py-3 bg-dark-800 border border-silver-600/30 rounded-lg text-silver-100 placeholder-silver-500 focus:outline-none focus:border-emerald-500/50 transition"
            />
            {query && (
                <button
                    onClick={handleClear}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-silver-500 hover:text-silver-300 transition"
                >
                    ✕
                </button>
            )}
        </div>
    );
}
