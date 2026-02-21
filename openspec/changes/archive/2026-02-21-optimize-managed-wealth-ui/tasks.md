# Tasks: Optimize Managed Wealth UI

1.  **Refactor Layout & Styling**
    -   Update `/managed-wealth/page.tsx` to use new grid layout and `ManagedProductCard`.
    -   Update text styles to use refined typography and colors (zinc-400/500 for secondary, white for primary).
    -   Add global background gradients or mesh effects for "premium" feel.

2.  **Create Components**
    -   `ManagedProductCard`: Implement with `framer-motion` hover effects and clean typography.
    -   `ManagedPolicyPill`: Polish existing implementation with better distinct colors/badges.
    -   `ManagedSubscriptionItem`: Implement collapsible row with progress bar.

3.  **Implement Data Visualization**
    -   Install `recharts` (if not already properly configured).
    -   Create `ManagedNavChart` component using `AreaChart` or `LineChart`.
    -   Integrate chart into `/managed-wealth/[id]/page.tsx` and `/managed-wealth/my/page.tsx`.

4.  **Polish Interactions**
    -   Add `AnimatePresence` to list filtering on the main page.
    -   Enhance button states (hover, active, disabled) with better visual feedback.
    -   Add skeletons for loading states in `ManagedProductCard` and `ManagedNavChart`.

5.  **Verify & Test**
    -   Verify responsiveness on mobile, tablet, and desktop.
    -   Test dark mode consistency (ensure no white backgrounds/borders leak).
    -   Check accessibility (contrast ratios, focus states).
