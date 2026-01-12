import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 需要登录才能访问的路由
 */
const PROTECTED_ROUTES = ['/portfolio', '/settings', '/dashboard'];

/**
 * 仅未登录用户可以访问的路由（如登录页）
 */
const GUEST_ROUTES: string[] = [];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 检查是否是受保护的路由
    const isProtectedRoute = PROTECTED_ROUTES.some(route =>
        pathname.startsWith(route)
    );

    // 检查是否是仅限访客的路由
    const isGuestRoute = GUEST_ROUTES.some(route =>
        pathname.startsWith(route)
    );

    // 获取认证状态
    // 注意：proxy 无法直接访问 Privy 的认证状态
    // 这里我们使用 cookie 作为简单的认证标记
    const isAuthenticated = request.cookies.get('privy-authenticated')?.value === 'true';

    // 注释掉重定向逻辑，让各个页面自己处理登录检查
    // if (isProtectedRoute && !isAuthenticated) {
    //     const url = new URL('/', request.url);
    //     url.searchParams.set('redirect', pathname);
    //     return NextResponse.redirect(url);
    // }

    // if (isGuestRoute && isAuthenticated) {
    //     return NextResponse.redirect(new URL('/', request.url));
    // }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * 匹配所有路径除了：
         * - api (API 路由)
         * - _next/static (静态文件)
         * - _next/image (图片优化文件)
         * - favicon.ico (favicon 文件)
         * - public 文件夹中的文件
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};