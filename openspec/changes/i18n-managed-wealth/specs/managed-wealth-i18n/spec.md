# Managed Wealth I18n Spec

## ADDED Requirements

### Requirement: Localization Support
The Managed Wealth UI MUST support full internationalization, allowing users to view the interface in their preferred language (English, Simplified Chinese, Traditional Chinese). All static text MUST be extracted to localization files, and dynamic values MUST be formatted according to the active locale.

#### Scenario: User switches language
Given a user is on the Managed Wealth marketplace page
When they switch the application language to Chinese (Traditional)
Then all UI text (strategy names, labels, buttons) should be displayed in Chinese
And dynamic data (numbers, dates) should be formatted according to the locale

#### Scenario: Subscription Modal Translation
Given a user opens the subscription modal
When the modal appears
Then the form labels ("Select Term", "Investment Amount"), legal disclaimers, and buttons should be translated
And the strategy specific text (e.g. "Conservative Strategy") should be translated

#### Scenario: Dashboard translation
Given a user is on "My Dashboard"
When they view their active subscriptions
Then status badges ("Running", "Settled") and table headers should be translated
