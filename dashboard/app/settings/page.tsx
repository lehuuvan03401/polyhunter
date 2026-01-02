'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Settings {
    theme: 'dark' | 'light';
    notifications: boolean;
    soundAlerts: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    defaultSlippage: number;
    testMode: boolean;
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({
        theme: 'dark',
        notifications: true,
        soundAlerts: false,
        autoRefresh: true,
        refreshInterval: 30,
        defaultSlippage: 1,
        testMode: true,
    });

    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        // Save settings to localStorage or API
        localStorage.setItem('dashboard-settings', JSON.stringify(settings));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-3xl mx-auto spacious">
                {/* Page Header */}
                <div className="animate-fade-in mb-8">
                    <h1 className="text-4xl font-bold gradient-text mb-2">Settings</h1>
                    <p className="text-silver-400">Configure your dashboard preferences</p>
                </div>

                <div className="space-y-6">
                    {/* Appearance */}
                    <Card className="card-elegant">
                        <CardHeader>
                            <CardTitle className="text-silver-100">Appearance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <SettingRow
                                title="Theme"
                                description="Choose your preferred color theme"
                            >
                                <div className="flex gap-2">
                                    <Badge
                                        variant={settings.theme === 'dark' ? 'success' : 'default'}
                                        className="cursor-pointer px-4 py-2"
                                        onClick={() => setSettings(s => ({ ...s, theme: 'dark' }))}
                                    >
                                        🌙 Dark
                                    </Badge>
                                    <Badge
                                        variant={settings.theme === 'light' ? 'success' : 'default'}
                                        className="cursor-pointer px-4 py-2"
                                        onClick={() => setSettings(s => ({ ...s, theme: 'light' }))}
                                    >
                                        ☀️ Light
                                    </Badge>
                                </div>
                            </SettingRow>
                        </CardContent>
                    </Card>

                    {/* Notifications */}
                    <Card className="card-elegant">
                        <CardHeader>
                            <CardTitle className="text-silver-100">Notifications</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <SettingRow
                                title="Push Notifications"
                                description="Receive browser notifications for important events"
                            >
                                <Toggle
                                    checked={settings.notifications}
                                    onChange={(checked) => setSettings(s => ({ ...s, notifications: checked }))}
                                />
                            </SettingRow>

                            <SettingRow
                                title="Sound Alerts"
                                description="Play sound when trade is executed"
                            >
                                <Toggle
                                    checked={settings.soundAlerts}
                                    onChange={(checked) => setSettings(s => ({ ...s, soundAlerts: checked }))}
                                />
                            </SettingRow>
                        </CardContent>
                    </Card>

                    {/* Data & Sync */}
                    <Card className="card-elegant">
                        <CardHeader>
                            <CardTitle className="text-silver-100">Data & Sync</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <SettingRow
                                title="Auto Refresh"
                                description="Automatically refresh data in the background"
                            >
                                <Toggle
                                    checked={settings.autoRefresh}
                                    onChange={(checked) => setSettings(s => ({ ...s, autoRefresh: checked }))}
                                />
                            </SettingRow>

                            <SettingRow
                                title="Refresh Interval"
                                description="How often to refresh data (seconds)"
                            >
                                <select
                                    value={settings.refreshInterval}
                                    onChange={(e) => setSettings(s => ({ ...s, refreshInterval: parseInt(e.target.value) }))}
                                    className="px-3 py-2 bg-dark-800 border border-silver-600/30 rounded-lg text-silver-200 focus:outline-none focus:border-emerald-500/50"
                                >
                                    <option value={10}>10s</option>
                                    <option value={30}>30s</option>
                                    <option value={60}>60s</option>
                                    <option value={300}>5m</option>
                                </select>
                            </SettingRow>
                        </CardContent>
                    </Card>

                    {/* Trading */}
                    <Card className="card-elegant">
                        <CardHeader>
                            <CardTitle className="text-silver-100">Trading</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <SettingRow
                                title="Default Slippage"
                                description="Default slippage tolerance for orders"
                            >
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        value={settings.defaultSlippage}
                                        onChange={(e) => setSettings(s => ({ ...s, defaultSlippage: parseFloat(e.target.value) }))}
                                        className="w-32 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        min="0.1"
                                        max="5"
                                        step="0.1"
                                    />
                                    <span className="text-silver-300 w-12">{settings.defaultSlippage}%</span>
                                </div>
                            </SettingRow>

                            <SettingRow
                                title="Test Mode"
                                description="Simulate trades without real execution"
                            >
                                <Toggle
                                    checked={settings.testMode}
                                    onChange={(checked) => setSettings(s => ({ ...s, testMode: checked }))}
                                />
                            </SettingRow>
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    <div className="flex items-center justify-between pt-4">
                        <div>
                            {saved && (
                                <span className="text-emerald-400 animate-fade-in">✓ Settings saved</span>
                            )}
                        </div>
                        <Button variant="primary" onClick={handleSave}>
                            Save Settings
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SettingRow({
    title,
    description,
    children
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-silver-600/10 last:border-0">
            <div>
                <p className="text-silver-200 font-medium">{title}</p>
                <p className="text-sm text-silver-500">{description}</p>
            </div>
            {children}
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`w-12 h-6 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-dark-600'
                }`}
        >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
        </button>
    );
}
