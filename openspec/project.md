# Project Context

## Purpose
Poly Hunter is a comprehensive toolkit and dashboard for Polymarket traders. It includes a TypeScript SDK (`@catalyst-team/poly-sdk`) for programmatic trading and analysis, and a Next.js frontend for "Smart Money" tracking, copy trading, and portfolio management. The goal is to provide advanced tools for identifying and acting on prediction market opportunities.

## Tech Stack
### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Lucide React, Framer Motion, Sonner
- **Charts**: Recharts
- **Auth**: Privy (`@privy-io/react-auth`)
- **State/Data**: React Hooks, SWR (implied)

### SDK / Backend
- **Runtime**: Node.js
- **Language**: TypeScript
- **Core Libraries**: `@polymarket/clob-client`, `ethers` (v5), `bottleneck` (rate limiting)
- **Database**: Prisma ORM with LibSQL
- **Testing**: Vitest

### Smart Contracts
- **Framework**: Hardhat
- **Network**: Polygon (Mainnet & Amoy Testnet), Localhost (Hardhat Network)
- **Language**: Solidity

## Project Conventions

### Code Style
- **TypeScript**: Strict mode enabled.
- **Formatting**: likely Prettier (implied by standard setups).
- **Naming**: camelCase for functions/vars, PascalCase for components/classes.
- **Imports**: Usage of `@/*` aliases in frontend.

### Architecture Patterns
- **Monorepo-style**:
    - Root: SDK logic (`src/`), Scripts (`scripts/`), Examples (`examples/`).
    - `frontend/`: Next.js application consuming the SDK.
    - `contracts/`: Solidity smart contracts (Proxy wallets, etc.).
- **SDK Design**: Modular services (`TradingService`, `CopyTradingService`).
- **Frontend Design**:
    - `app/`: Routes and pages.
    - `components/`: Reusable UI components.
    - `lib/`: Utilities and hooks.

### Testing Strategy
- **Unit/Integration**: Vitest for SDK logic and integration tests.
- **Manual**: Localhost fork testing with Hardhat for contract interactions.

### Git Workflow
- Standard feature directory/branch workflow.

## Domain Context
- **Polymarket**: Prediction market platform on Polygon.
- **CTF (Conditional Tokens Framework)**: Underlying standard for outcome tokens.
- **CLOB**: Central Limit Order Book for off-chain matching.
- **Proxy Wallets**: Smart contract wallets used for advanced features (batching, copy trading).
- **"Smart Money"**: Tracking profitable or high-volume traders to copy their moves.

## Important Constraints
- **Chain ID Sensitivity**: Localhost uses `31337`, Mainnet `137`. Frontend must match.
- **RPC Limits**: Heavy reliance on RPCs for data; rate limiting is crucial `bottleneck`.
- **Ethers Version**: Project uses Ethers v5 explicitly (likely for compatibility with older Polymarket libs).

## External Dependencies
- **Polymarket API**: CLOB API, Gamma (GraphQL) API.
- **Polygon RPCs**: Alchemy, Infura, or public RPCs.
- **Privy**: Wallet infrastructure and authentication.
