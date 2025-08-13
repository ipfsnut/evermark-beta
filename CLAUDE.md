# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npx netlify dev` - Start full development environment with Netlify Functions on localhost:8888
  - Runs Vite dev server on port 3000
  - Runs Netlify Functions on port 9999
  - Proxies everything through port 8888
- `npm run dev` - Start Vite only (without Netlify Functions) on localhost:3000
- `npm run build` - Build production bundle with TypeScript checking
- `npm run build:force` - Force build even with TypeScript errors
- `npm run preview` - Preview production build locally

**Important**: Always use `npx netlify dev` for full functionality including authentication and API endpoints.

### Code Quality
- `npm run lint` - Run ESLint with max warnings 0
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run type-check` - Check TypeScript types without emitting
- `npm run type-check:watch` - Watch mode for TypeScript checking
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Testing
- `npm run test` - Run tests with Vitest
- `npm run test:coverage` - Run tests with coverage report

### Data Migration
- `npm run migrate:legacy` - Migrate legacy evermarks
- `npm run migrate:dry` - Dry run migration without making changes

## Architecture Overview

### Feature-First Organization
The codebase follows a feature-first architecture where each major feature is self-contained:

```
src/features/[feature-name]/
├── components/     # Feature-specific UI components
├── hooks/         # State management (single main hook per feature)
├── services/      # Business logic & API calls (pure functions)
├── types/         # TypeScript interfaces
├── abis/          # Smart contract ABIs
└── index.ts       # Public API exports
```

### Core Features
1. **Evermarks** - On-chain content preservation system
2. **Staking** - $EMARK token locking for voting power
3. **Voting** - Delegation system for content curation
4. **Leaderboard** - Community-driven content rankings
5. **Tokens** - $EMARK balance and transaction management

### Provider Hierarchy
Providers wrap the app in this specific order:
1. QueryClientProvider (React Query)
2. ThirdwebProvider (blockchain SDK)
3. FarcasterProvider (Frame/auth context)
4. WalletProvider (wallet connection)
5. BlockchainProvider (contract interactions)
6. IntegratedUserProvider (unified user management)
7. AppContextProvider (app-level state)

### State Management Pattern
- **Global State**: Auth, wallet, UI state via React Context
- **Server State**: API/blockchain data via React Query (30s stale time)
- **Feature State**: Each feature exports ONE main state hook
- **Local State**: Component-specific UI state via useState

### Backend Architecture
- **Netlify Functions** in `/netlify/functions/`:
  - `evermarks.ts` - CRUD operations for evermarks
  - `auth-wallet.ts` & `auth-nonce.ts` - Wallet authentication
  - `frame.ts` - Farcaster Frame support
  - `shares.ts` - Social sharing features
  - `webhook.ts` - External integrations
  - `dev-dashboard.ts` - Development utilities
- **Database**: Supabase for metadata and caching
- **Blockchain**: Base network (chain ID 8453) via Thirdweb SDK

### Smart Contract Integration
Contracts are accessed via getters in `/src/lib/contracts.ts`:
- `getEmarkTokenContract()` - $EMARK token
- `getCardCatalogContract()` - NFT staking catalog
- `getEvermarkNFTContract()` - Evermark NFT minting
- `getEvermarkVotingContract()` - Voting mechanism
- `getEvermarkLeaderboardContract()` - Ranking system

Each feature imports its own ABI from `features/[name]/abis/`.

### Key Libraries
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Blockchain**: Thirdweb v5, Wagmi v2, Viem
- **Farcaster**: @farcaster/frame-sdk, Frame Wagmi Connector
- **State**: @tanstack/react-query, React Context
- **Backend**: Netlify Functions, Supabase client

### Development Principles
1. **Pure Functions**: Business logic in services as pure functions
2. **Single State Hook**: One main hook per feature managing all state
3. **Type Safety**: Strict TypeScript with no implicit `any`
4. **Clean Separation**: UI components contain no business logic
5. **Feature Isolation**: Features are independently testable

### Environment Variables Required
```
VITE_THIRDWEB_CLIENT_ID=
VITE_CHAIN_ID=8453
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FARCASTER_DEVELOPER_FID=
VITE_EMARK_TOKEN_ADDRESS=
VITE_CARD_CATALOG_ADDRESS=
VITE_EVERMARK_NFT_ADDRESS=
VITE_EVERMARK_VOTING_ADDRESS=
VITE_EVERMARK_LEADERBOARD_ADDRESS=
```

### Common Workflows

#### Adding a New Feature
1. Create folder structure under `/src/features/[name]/`
2. Define types in `types/index.ts`
3. Build service layer with pure functions
4. Create single state hook in `hooks/use[Name]State.ts`
5. Build UI components using the hook
6. Export public API in `index.ts`

#### Working with Smart Contracts
1. Place ABI in `features/[name]/abis/[Contract].json`
2. Import ABI in feature service
3. Use contract getter from `/src/lib/contracts.ts`
4. Handle transactions with proper error handling

#### Testing Blockchain Interactions
1. Check wallet connection via `useWallet()` hook
2. Test on Base network (chain ID 8453)
3. Monitor transactions in BaseScan
4. Use React Query for caching blockchain data