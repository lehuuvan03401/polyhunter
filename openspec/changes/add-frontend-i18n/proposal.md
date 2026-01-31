# Change: Add Frontend Internationalization (i18n)

## Why
The application currently only supports English. To accommodate a global user base, specifically targeting Chinese-speaking users (Simplified and Traditional), we need to implement internationalization support.

## What Changes
- Integrate `next-intl` for Next.js App Router i18n.
- Re-structure `frontend/app/` to use dynamic `[locale]` routes.
- Add a Language Switcher component to the Navbar/Homepage.
- Translate the Homepage content into English (en), Simplified Chinese (zh-CN), and Traditional Chinese (zh-TW).
- Set up middleware for locale detection.

## Impact
- **Affected specs**: `frontend-i18n` (New)
- **Affected code**: `frontend/app/`, `frontend/middleware.ts`, `frontend/next.config.ts`
