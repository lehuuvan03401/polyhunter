# Design: Optimize Managed Wealth UI

## Goals
1.  **Aesthetics**: Elevate the visual quality to a "premium fintech" standard using dark mode, gradients, and glassmorphism.
2.  **UX**: Improve data readability, interaction feedback, and navigation flow.
3.  **Performance**: Ensure smooth animations and instant visual feedback.

## Architecture
The page structure will remain similar but the component tree will be refactored for better modularity.

### Components
-   `components/managed-wealth/product-card.tsx`:
    -   Displays product name, strategy profile, badges (Guaranteed), and key metrics.
    -   Uses `framer-motion` for hover lift and border glow.
-   `components/managed-wealth/nav-chart.tsx`:
    -   Uses `recharts` to render a sparkline or detailed area chart of NAV history.
    -   Handles loading state with a skeleton loader.
-   `components/managed-wealth/subscription-item.tsx`:
    -   Displays subscription details with a progress bar for term duration.
    -   Collapsible section for detailed stats and NAV history.
-   `components/managed-wealth/stats-grid.tsx`:
    -   Responsive grid for displaying key metrics (Total Principal, Current Equity, etc.).

### Visual Style
-   **Colors**:
    -   Background: `#0A0B0E` (Base), `#121417` (Card).
    -   Accents: Blue/Cyan for growth, detailed gradients for premium feel.
    -   Text: `text-white` (Primary), `text-white/60` (Secondary).
-   **Typography**: System font (Inter equivalent), emphasizing weights for hierarchy.
-   **Effects**:
    -   Glassmorphism: `bg-white/5 backdrop-blur-md border border-white/10`.
    -   Glow: Box shadows with colored accents on hover.

## User Flows
1.  **Marketplace**:
    -   User sees a grid of products with clear "Guaranteed" markers.
    -   Filtering updates the grid with a layout animation (`AnimatePresence`).
2.  **Product Detail**:
    -   Hero section with product performance chart.
    -   Clear "Subscribe" call-to-action with term selection.
3.  **My Positions**:
    -   Dashboard view of total wealth.
    -   List of active subscriptions with live status updates.
