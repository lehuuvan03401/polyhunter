# Managed Wealth UI Optimization

## MODIFIED Requirements

### Requirement: Enhanced Product Listing Page
The main managed wealth page MUST present products in a visually engaging grid layout with high-quality product cards.

#### Scenario: Viewing the product list
Given a user visits `/managed-wealth`
Then the page displays a header with a refined title and description
And the strategy filters are presented as distinct, interactive pills
And the product list is displayed as a responsive grid of `ManagedProductCard` components
And each card includes a "Guaranteed" badge if applicable, the strategy profile, and key terms in a compact, readable format
And hovering over a card triggers a subtle lift and glow effect

#### Scenario: Empty state for filtering
Given the user selects a filter combination that matches no products
Then a visually distinct empty state component is displayed
And it provides a clear message and a button to clear filters

### Requirement: Enhanced Product Detail Page
The product detail page MUST provide in-depth information with rich data visualization.

#### Scenario: Viewing product details
Given a user views a specific product at `/managed-wealth/[id]`
Then the header shows the product name, strategy, and disclosure policy with a premium layout
And a `ManagedNavChart` displays the historical performance (NAV) of the product
And the "Term Matrix" is presented as a clean, styled table or list with clear action buttons
And the "Subscribe" section is prominent and easy to access

### Requirement: Enhanced My Positions Page
The user's portfolio page MUST provide a clear dashboard of their managed wealth.

#### Scenario: Viewing active subscriptions
Given an authenticated user visits `/managed-wealth/my`
Then a summary dashboard shows Total Principal, Current Equity, and Total Returns
And the subscription list use `ManagedSubscriptionItem` components
And each item displays a progress bar indicating the term completion
And expanding an item reveals a mini-chart of the NAV performance for that specific subscription

## NEW Requirements

### Requirement: Managed Product Card Component
The application MUST include a standardized card component for displaying managed product summaries.

#### Scenario: Using ManagedProductCard
Given a developer imports `ManagedProductCard`
When provided with a valid `ManagedProduct` object
Then it renders a standardized card with consistent padding, typography, and interactive behaviors

### Requirement: Managed NAV Chart Component
The application MUST include a charting component for visualizing NAV history.

#### Scenario: Using ManagedNavChart
Given a developer imports `ManagedNavChart`
When provided with an array of NAV data points
Then it renders a responsive area chart with a tooltip on hover
And handles loading states with a skeleton animation
