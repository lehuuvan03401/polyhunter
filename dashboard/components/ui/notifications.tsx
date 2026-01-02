'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    timestamp: Date;
    read: boolean;
}

interface NotificationContextType {
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    clearAll: () => void;
    unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: Notification = {
            ...notification,
            id: Math.random().toString(36).slice(2),
            timestamp: new Date(),
            read: false,
        };
        setNotifications(prev => [newNotification, ...prev].slice(0, 50));
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, markAsRead, clearAll, unreadCount }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, markAsRead, clearAll, unreadCount } = useNotifications();

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-white/5 transition"
            >
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-crimson-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-12 w-80 z-50 glass rounded-xl shadow-glow-elegant border border-silver-600/20 overflow-hidden">
                        <div className="p-4 border-b border-silver-600/20 flex items-center justify-between">
                            <h3 className="font-bold text-silver-100">Notifications</h3>
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearAll}
                                    className="text-xs text-silver-400 hover:text-silver-200 transition"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="text-3xl mb-2">🔕</div>
                                    <p className="text-silver-400 text-sm">No notifications</p>
                                </div>
                            ) : (
                                notifications.slice(0, 10).map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        onRead={() => markAsRead(notification.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function NotificationItem({
    notification,
    onRead
}: {
    notification: Notification;
    onRead: () => void;
}) {
    const getIcon = () => {
        switch (notification.type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
        }
    };

    const timeAgo = getTimeAgo(notification.timestamp);

    return (
        <button
            onClick={onRead}
            className={`w-full p-4 text-left border-b border-silver-600/10 hover:bg-white/5 transition ${!notification.read ? 'bg-emerald-500/5' : ''
                }`}
        >
            <div className="flex gap-3">
                <span className="text-lg flex-shrink-0">{getIcon()}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-medium text-silver-200 truncate">{notification.title}</p>
                        {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                    </div>
                    {notification.message && (
                        <p className="text-sm text-silver-400 truncate mt-0.5">{notification.message}</p>
                    )}
                    <p className="text-xs text-silver-500 mt-1">{timeAgo}</p>
                </div>
            </div>
        </button>
    );
}

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// Toast notification component
export function Toast({
    notification,
    onClose
}: {
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>;
    onClose: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const getIcon = () => {
        switch (notification.type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
        }
    };

    const getBorderColor = () => {
        switch (notification.type) {
            case 'success': return 'border-emerald-500/50';
            case 'error': return 'border-crimson-500/50';
            case 'warning': return 'border-amber-500/50';
            case 'info': return 'border-silver-500/50';
        }
    };

    return (
        <div className={`glass rounded-xl p-4 shadow-glow-elegant border ${getBorderColor()} animate-slide-in`}>
            <div className="flex items-start gap-3">
                <span className="text-lg">{getIcon()}</span>
                <div className="flex-1">
                    <p className="font-medium text-silver-200">{notification.title}</p>
                    {notification.message && (
                        <p className="text-sm text-silver-400 mt-0.5">{notification.message}</p>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="text-silver-500 hover:text-silver-300 transition"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
