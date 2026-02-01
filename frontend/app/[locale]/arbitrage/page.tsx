'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Zap, Shield, LineChart, Cpu, ArrowRight, Clock, X } from 'lucide-react';
import Link from 'next/link';

export default function ArbitragePage() {
    const t = useTranslations('Arbitrage');
    const [showModal, setShowModal] = useState(false);

    return (
        <div className="min-h-screen bg-background">
            {/* Background Gradients */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
            </div>

            {/* Coming Soon Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowModal(false)}
                    />
                    {/* Modal */}
                    <div className="relative bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        {/* Close Button */}
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        {/* Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                                <Clock className="h-8 w-8 text-blue-400" />
                            </div>
                        </div>
                        {/* Content */}
                        <h3 className="text-2xl font-bold text-white text-center mb-3">
                            Coming Soon
                        </h3>
                        <p className="text-muted-foreground text-center mb-8 leading-relaxed">
                            AI 套利机器人正在紧张开发中，敬请期待！
                        </p>
                        {/* Button */}
                        <button
                            onClick={() => setShowModal(false)}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] duration-200"
                        >
                            我知道了
                        </button>
                    </div>
                </div>
            )}

            {/* Hero Section */}
            <section className="relative pt-40 pb-24">
                <div className="container mx-auto px-4">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
                            <Bot className="h-4 w-4" />
                            <span>AI-Powered Trading</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
                            {t('hero.title')}
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
                            {t('hero.subtitle')}
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="group relative px-10 py-5 rounded-2xl font-bold text-lg text-white transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
                        >
                            {/* Animated gradient border */}
                            <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite]" />
                            {/* Inner background */}
                            <span className="absolute inset-[2px] rounded-[14px] bg-background/90 group-hover:bg-background/80 transition-colors" />
                            {/* Glow effect */}
                            <span className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-blue-500/50" />
                            {/* Text */}
                            <span className="relative z-10 flex items-center gap-2 text-white">
                                {t('hero.cta')}
                                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                            </span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="relative py-20">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {/* Low Latency */}
                        <div className="bg-card/50 backdrop-blur-sm border border-border p-8 rounded-2xl hover:border-blue-500/40 transition-all duration-300 group">
                            <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                                <Zap className="h-6 w-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('features.latency.title')}</h3>
                            <p className="text-muted-foreground leading-relaxed">{t('features.latency.desc')}</p>
                        </div>
                        {/* Risk Management */}
                        <div className="bg-card/50 backdrop-blur-sm border border-border p-8 rounded-2xl hover:border-purple-500/40 transition-all duration-300 group">
                            <div className="h-12 w-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                                <Shield className="h-6 w-6 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('features.risk.title')}</h3>
                            <p className="text-muted-foreground leading-relaxed">{t('features.risk.desc')}</p>
                        </div>
                        {/* Real-time Analytics */}
                        <div className="bg-card/50 backdrop-blur-sm border border-border p-8 rounded-2xl hover:border-green-500/40 transition-all duration-300 group">
                            <div className="h-12 w-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                                <LineChart className="h-6 w-6 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('features.analytics.title')}</h3>
                            <p className="text-muted-foreground leading-relaxed">{t('features.analytics.desc')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bot Strategies */}
            <section className="relative py-24">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">{t('bots.title')}</h2>
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Conservative Bot */}
                        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-2xl p-8 group hover:border-blue-500/30 transition-colors">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-11 w-11 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                                    <Shield className="h-5 w-5 text-blue-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white">{t('bots.conservative.title')}</h3>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-8">
                                {t('bots.conservative.desc')}
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Risk Level</span>
                                    <span className="text-blue-400 font-semibold">Low</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 w-[35%] rounded-full" />
                                </div>
                            </div>
                        </div>

                        {/* Aggressive Bot */}
                        <div className="bg-gradient-to-br from-card/40 to-red-500/5 backdrop-blur-sm border border-border rounded-2xl p-8 group hover:border-red-500/30 transition-colors">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-11 w-11 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                                    <Zap className="h-5 w-5 text-red-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white">{t('bots.aggressive.title')}</h3>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-8">
                                {t('bots.aggressive.desc')}
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Risk Level</span>
                                    <span className="text-red-400 font-semibold">High</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-red-600 to-red-400 w-[85%] rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="relative py-24 pb-32">
                <div className="container mx-auto px-4">
                    <div className="bg-card/30 border border-border rounded-3xl p-8 md:p-12 max-w-5xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            {/* Text Content */}
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{t('technical.title')}</h2>
                                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                                    {t('technical.desc')}
                                </p>
                                <Link
                                    href="/docs"
                                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors font-medium text-lg group"
                                >
                                    Read Documentation
                                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                            {/* Visual */}
                            <div className="flex justify-center items-center">
                                <div className="relative h-56 w-56 md:h-64 md:w-64 flex items-center justify-center">
                                    {/* Outer Ring */}
                                    <div className="absolute inset-0 rounded-full border border-blue-500/20 animate-[spin_20s_linear_infinite]" />
                                    {/* Middle Ring */}
                                    <div className="absolute inset-4 rounded-full border border-dashed border-blue-500/10" />
                                    {/* Inner Circle */}
                                    <div className="h-32 w-32 md:h-40 md:w-40 bg-blue-500/5 rounded-full flex items-center justify-center border border-blue-500/10">
                                        <Cpu className="h-16 w-16 md:h-20 md:w-20 text-blue-500/60" />
                                    </div>
                                    {/* Decorative Dots */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-2 w-2 bg-blue-500/40 rounded-full" />
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2 w-2 bg-blue-500/40 rounded-full" />
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 bg-blue-500/40 rounded-full" />
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2 w-2 bg-blue-500/40 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
