'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import Link from 'next/link';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * 路由保护组件
 * 
 * 用法:
 * ```tsx
 * <ProtectedRoute>
 *   <YourProtectedPage />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();

  // 如果未准备好，显示加载状态
  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 如果未认证，显示登录引导
  if (!authenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen bg-background pt-24 pb-20 px-4">
        <div className="container max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[500px] text-center space-y-6">
          <div className="h-20 w-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
            <Wallet className="h-10 w-10 text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold">Connect Your Wallet</h2>
          <p className="text-muted-foreground max-w-md">
            Please connect your wallet to access this page. Your wallet is required to view your portfolio, manage settings, and access protected features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 rounded-lg bg-white/10 text-foreground font-medium border border-white/10 hover:bg-white/20 transition-colors"
            >
              Back to Home
            </button>
            <button
              onClick={() => {
                // 触发 Privy 登录
                const loginButton = document.querySelector('[data-privy-login]') as HTMLButtonElement;
                if (loginButton) {
                  loginButton.click();
                } else {
                  // 如果找不到登录按钮，使用全局登录方法
                  (window as any).privy?.login?.();
                }
              }}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
            >
              Connect Wallet
            </button>
          </div>
          <div className="text-sm text-muted-foreground pt-8">
            <p>Don't have a wallet? No problem! We support:</p>
            <div className="flex items-center justify-center gap-4 mt-2">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Email
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Google
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Twitter
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已认证，显示受保护的内容
  return <>{children}</>;
}