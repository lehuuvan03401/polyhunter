# Proposal: Internationalize Copy Trader Modal

## Context
The `CopyTraderModal` component currently uses hardcoded English strings, making it inaccessible to non-English users. The application already supports i18n via `next-intl` and has existing translation files (`en.json`, `zh-TW.json`, `zh-CN.json`).

## Goal
Enable full internationalization for the `CopyTraderModal` component by extracting all user-facing strings into translation files and using the `useTranslations` hook. This ensures the modal adapts to the user's selected language.

## Changes
- **Translation Files**: Update `messages/en.json`, `messages/zh-TW.json`, and `messages/zh-CN.json` with new keys under the `CopyTrader` namespace.
- **Frontend Component**: Refactor `copy-trader-modal.tsx` to use `useTranslations('CopyTrader')` and replace hardcoded strings with dynamic keys.
- **Spec**: Add a new `frontend-i18n` spec demonstrating the requirement for multilingual support in the copy trading UI.
