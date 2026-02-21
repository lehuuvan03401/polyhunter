# Frontend Internationalization Specification

## ADDED Requirements

### Requirement: Multilingual UI Support
The Copy Trader Modal SHALL display all text content in the user's selected language. The application SHALL support switching between English, Traditional Chinese (`zh-TW`), and Simplified Chinese (`zh-CN`) without requiring a page reload (or with a seamless reload).

#### Scenario: Displaying localized labels
- GIVEN the user's locale is set to "zh-TW"
- WHEN the Copy Trader Modal is opened
- THEN the title "Copy {address}" is displayed in Trad Chinese (e.g., "跟單 {address}")
- AND buttons like "Simple" / "Pro" are displayed in Trad Chinese

#### Scenario: Fallback for missing keys (Implicit)
- GIVEN a translation key is missing in the current locale
- WHEN the UI renders
- THEN the English fallback string or the key itself is displayed (standard next-intl behavior) to prevent crashes.
