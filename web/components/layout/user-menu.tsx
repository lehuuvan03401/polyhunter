'use client';

import * as React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { Settings, HelpCircle, LogOut, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';

export function UserMenu() {
    const { user, logout } = usePrivy();
    const router = useRouter();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    // Close on click outside
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        setIsOpen(false);
        
        try {
            await logout();
            toast.success('Logged out successfully');
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Failed to logout. Please try again.');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    const address = user?.wallet?.address || '';
    const displayAddress = address ? truncateAddress(address) : 'User';

    // Generates a gradient based on the address
    const getGradient = (addr: string) => {
        const hash = addr.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const hue = hash % 360;
        return `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 45) % 360}, 70%, 60%))`;
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 pl-1 pr-3 py-1 bg-[#1e1f24] hover:bg-[#25262b] border border-[#2c2d33] rounded-full transition-all duration-200",
                    isOpen && "bg-[#25262b] border-[#3a3b42]"
                )}
            >
                <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner"
                    style={{ background: getGradient(address) }}
                >
                    {address.slice(2, 4).toUpperCase()}
                </div>
                <div className="flex flex-col items-start mr-1">
                    <span className="text-sm font-medium text-white font-mono">{displayAddress}</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#2c2d33] bg-[#1a1b1e] shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-4 border-b border-white/5">
                        <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
                        <p className="font-medium text-white truncate max-w-full">
                            Wallet User
                        </p>
                    </div>

                    <div className="p-1">
                        <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            <Settings className="w-4 h-4" />
                            Settings
                        </Link>
                        <Link href="/support" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            <HelpCircle className="w-4 h-4" />
                            Help & Support
                        </Link>
                    </div>

                    <div className="p-1 border-t border-white/5">
                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors",
                                isLoggingOut
                                    ? "text-red-400/50 cursor-not-allowed"
                                    : "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            )}
                        >
                            {isLoggingOut ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Logging out...
                                </>
                            ) : (
                                <>
                                    <LogOut className="w-4 h-4" />
                                    Log Out
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
