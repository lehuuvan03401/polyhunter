# Optimize Managed Wealth UI

## Summary
Deeply optimize the aesthetics and user experience of the Managed Wealth product pages (`/managed-wealth`, `/managed-wealth/[id]`, `/managed-wealth/my`).

## Motivation
The current implementation of the Managed Wealth pages is functional but lacks visual polish and optimal user experience. The design is basic, using raw Tailwind classes without a cohesive design system, and the UX for data visualization and interaction is minimal. Users need a more premium, trustworthy, and engaging interface for managing their wealth.

## Proposed Solution
Refactor the Managed Wealth pages to use a modernized UI architecture with:
1.  **Visual Polish**: Implement a premium "dark mode" aesthetic with gradients, glassmorphism, and refined typography.
2.  **Component Architecture**: Extract reusable, polished components for Product Cards, Stat Cards, and Subscription Items.
3.  **Data Visualization**: Replace tabular data with interactive charts using `recharts` for NAV and performance tracking.
4.  **Interaction Design**: Add smooth transitions and micro-interactions using `framer-motion`.
5.  **UX Improvements**: Enhance empty states, loading states (skeletons), and navigation flows.

## Scope
-   `frontend/app/[locale]/managed-wealth/page.tsx`
-   `frontend/app/[locale]/managed-wealth/[id]/page.tsx`
-   `frontend/app/[locale]/managed-wealth/my/page.tsx`
-   New components in `frontend/components/managed-wealth/`
