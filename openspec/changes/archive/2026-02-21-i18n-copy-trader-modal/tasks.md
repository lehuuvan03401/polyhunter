# Tasks

1.  **Create Spec Delta** <!-- id: 0 -->
    - [x] Create `specs/frontend-i18n/spec.md` defining the multilingual requirement.

2.  **Update Translation Files** <!-- id: 1 -->
    - [x] Add `CopyTrader` namespace to `messages/en.json` with all strings derived from the modal.
    - [x] Add `CopyTrader` namespace to `messages/zh-TW.json` (can default to English or placeholder if translation unavailable).
    - [x] Add `CopyTrader` namespace to `messages/zh-CN.json`.

3.  **Refactor Component** <!-- id: 2 -->
    - [x] Import `useTranslations` in `copy-trader-modal.tsx`.
    - [x] Replace hardcoded strings with `t('...')` calls.
    - [x] Verify dynamic values (e.g. currency amounts) are handled correctly with variable interpolation.

4.  **Verification** <!-- id: 3 -->
    - [x] Verify modal text updates when switching languages via the global switcher.
    - [x] Ensure layout does not break with longer text (if any).
