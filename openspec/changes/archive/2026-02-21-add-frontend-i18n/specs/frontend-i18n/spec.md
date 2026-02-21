## ADDED Requirements
### Requirement: Internationalization Support
The system MUST support multiple languages and allow users to switch between them.

#### Scenario: Default language
- **WHEN** a user visits the site without a preferred locale cookie
- **AND** their browser language is not supported or detection fails
- **THEN** they are redirected to the default locale (English)

#### Scenario: Language Switching
- **WHEN** a user selects "简体中文" from the language switcher
- **THEN** the URL changes to `/zh-CN/...`
- **AND** the page content updates to Simplified Chinese
- **AND** a cookie is set to persist the preference

#### Scenario: Supported Languages
- **WHEN** configuring the system
- **THEN** the following locales MUST be supported: English (`en`), Simplified Chinese (`zh-CN`), Traditional Chinese (`zh-TW`)
