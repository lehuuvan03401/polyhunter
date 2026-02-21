# Managed Wealth Internalization (i18n)

## Summary
Make the Managed Wealth feature fully translatable by extracting hardcoded strings into localization files (`en.json`, `zh-CN.json`, `zh-TW.json`) and using `next-intl` hooks.

## Motivation
The Managed Wealth feature is currently only available in English. To support our global user base, specifically Chinese-speaking users, we need to adapt the UI to support multiple languages.

## Proposed Changes
1.  Create grouped translation keys under `ManagedWealth` in localization files.
2.  Extract hardcoded strings from all Managed Wealth components and pages.
3.  Replace strings with `useTranslations('ManagedWealth')`.

## Alternatives Considered
-   **Client-side only translation**: Rejected as we use Next.js App Router and `next-intl` for server-side rendering support.
-   **Separate files for each component**: Rejected to maintain consistency with existing `en.json` structure (grouped by feature).
