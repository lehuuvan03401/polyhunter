'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LogEntry {
    id: string;
    timestamp: Date;
    type: 'DETECTED' | 'EXECUTING' | 'SUCCESS' | 'FAILED';
    message: string;
    details?: string;
}

interface ExecutionLogProps {
    isActive: boolean;
    maxEntries?: number;
}

export function ExecutionLog({ isActive, maxEntries = 20 }: ExecutionLogProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        if (!isActive) return;

        // Simulate log entries
        const interval = setInterval(() => {
            const types: LogEntry['type'][] = ['DETECTED', 'EXECUTING', 'SUCCESS', 'FAILED'];
            const type = types[Math.floor(Math.random() * types.length)];

            const messages: Record<LogEntry['type'], string[]> = {
                DETECTED: ['Trade detected from Whale #1', 'New position opened by SmartMoney', 'Trade signal received'],
                EXECUTING: ['Placing order...', 'Executing copy trade...', 'Processing transaction...'],
                SUCCESS: ['Trade executed successfully', 'Order filled at 55.2¢', 'Position opened'],
                FAILED: ['Slippage exceeded', 'Insufficient balance', 'Order rejected'],
            };

            const newLog: LogEntry = {
                id: Math.random().toString(36).slice(2),
                timestamp: new Date(),
                type,
                message: messages[type][Math.floor(Math.random() * messages[type].length)],
                details: type === 'SUCCESS' ? `+$${(Math.random() * 100).toFixed(2)}` : undefined,
            };

            setLogs(prev => [newLog, ...prev].slice(0, maxEntries));
        }, 2000 + Math.random() * 3000);

        return () => clearInterval(interval);
    }, [isActive, maxEntries]);

    const getTypeColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'DETECTED': return 'info';
            case 'EXECUTING': return 'warning';
            case 'SUCCESS': return 'success';
            case 'FAILED': return 'danger';
        }
    };

    const getTypeIcon = (type: LogEntry['type']) => {
        switch (type) {
            case 'DETECTED': return '👁️';
            case 'EXECUTING': return '⚡';
            case 'SUCCESS': return '✅';
            case 'FAILED': return '❌';
        }
    };

    return (
        <Card className="card-elegant">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-silver-100">Execution Log</CardTitle>
                    <Badge variant={isActive ? 'success' : 'default'}>
                        {isActive ? '🔴 Recording' : 'Idle'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {logs.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-4">📋</div>
                        <p className="text-silver-400">
                            {isActive
                                ? 'Waiting for activity...'
                                : 'Start copy trading to see logs'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {logs.map((log, index) => (
                            <div
                                key={log.id}
                                className="flex items-center gap-3 p-3 bg-dark-900/50 rounded-lg border border-silver-600/10 animate-slide-in"
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <span className="text-lg">{getTypeIcon(log.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={getTypeColor(log.type)} className="text-xs">
                                            {log.type}
                                        </Badge>
                                        <span className="text-sm text-silver-200 truncate">{log.message}</span>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    {log.details && (
                                        <p className="text-sm font-semibold text-emerald-400">{log.details}</p>
                                    )}
                                    <p className="text-xs text-silver-500">
                                        {log.timestamp.toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
