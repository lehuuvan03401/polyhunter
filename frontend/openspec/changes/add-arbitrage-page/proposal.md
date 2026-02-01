# Arbitrage Showcase Page

## Goal
Add a new "Arbitrage" page to the platform to showcase the upcoming AI arbitrage bot features. This page will be a static display of the capabilities and technical implementation of the arbitrage bots, accessible via the main navigation bar.

## Rationale
The user wants to expand the platform's offering to include AI arbitrage trading in addition to copy trading. This landing page serves as an introduction and educational resource for users to understand the new feature before full backend implementation.

## Proposed Changes
### Navigation
- Add "Arbitrage" (or "Arbitrage Bots" depending on space/translation) to the main navigation bar.

### New Page: `/arbitrage`
- Create a new static page at `app/[locale]/arbitrage/page.tsx`.
- Content will include:
    - Introduction to AI Arbitrage Bots.
    - Comparison of different bot types (e.g., based on risk/asset size).
    - Technical implementation details.
- detailed aesthetic consistent with the current "dark/premium" theme.

### Internationalization
- Add `Arbitrage` namespace to translation files (`en.json`, `zh-CN.json`, `zh-TW.json`) to support the new page content.
