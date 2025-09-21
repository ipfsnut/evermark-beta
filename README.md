# Evermark Beta

> Decentralized content preservation with unified storage architecture - Built for permanence, optimized for performance.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server with Netlify Functions
npx netlify dev

# Start Vite only (limited functionality)
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

## 🏗️ Architecture

Evermark Beta follows a **feature-first architecture** for maximum maintainability:

```
src/
├── core/           # Pure business logic, types, utilities
├── features/       # Self-contained feature modules
├── components/     # Reusable UI components
├── providers/      # React Context providers
├── lib/           # External service integrations
└── pages/         # Route components
```

### Core Principles

- **Unified Storage**: Content preserved on ArDrive (Arweave) for permanence, IPFS for speed
- **Feature Isolation**: Each feature is independently testable and maintainable
- **Pure Functions**: All business logic as testable pure functions
- **Single State Hook**: One hook per feature for centralized state management
- **Type Safety**: Comprehensive TypeScript coverage with strict mode
- **Clean Separation**: UI components contain no business logic
- **SDK-Powered**: Core functionality provided by the evermark-sdk
- **Season Management**: Automated weekly seasons with smart contract coordination

## 🎯 Features

### Core Features
- **Evermarks**: Create and manage on-chain content preservation
- **Staking**: Lock $EMARK tokens to gain voting power
- **Voting**: Delegate voting power to quality content
- **Leaderboard**: Community-driven content rankings
- **Tokens**: Manage $EMARK balances and transactions
- **Marketplace**: Buy and sell Evermark NFTs with real-time listings
- **Points System**: Earn points for community participation and marketplace activity
- **Season Management**: Automated weekly progression with leaderboard finalization
- **Advanced Analytics**: Comprehensive data integrity and performance monitoring

### Technical Features
- **Unified Storage**: ArDrive (Arweave) for permanent preservation, IPFS for fast access
- **Hybrid Caching**: Supabase caching layer for optimal performance
- **Farcaster Integration**: Native Frame/Mini-app support
- **Blockchain**: Thirdweb SDK with Base network (Chain ID: 8453)
- **Real-time Data**: React Query with 30s stale time
- **Responsive Design**: Mobile-first with cyber theme
- **SDK Integration**: Powered by evermark-sdk for robust image/metadata handling
- **Error Handling**: Comprehensive error boundaries and validation
- **Dynamic Sharing**: Optimized social media integration with platform-specific meta tags

## 🏆 Points System

Evermark rewards community participation with a comprehensive points system designed to encourage quality content creation and marketplace activity.

### How to Earn Points

| Action | Points | Description |
|--------|--------|-------------|
| **Create Evermark** | 10 points | Mint a new Evermark NFT with quality content |
| **Vote on Content** | 1 point | Delegate voting power to help curate quality |
| **Stake $EMARK** | 1 point/1M tokens | Lock tokens to gain voting power (minimum 1M $EMARK) |
| **Buy NFT** | 1 point | Purchase an Evermark from the marketplace |
| **List NFT for Sale** | 1 point | Create a marketplace listing for your Evermark |

### Marketplace Integration

The marketplace system is fully integrated with the points reward structure:

- **Buying**: Every successful NFT purchase earns 1 point automatically
- **Selling**: Creating a marketplace listing earns 1 point when the listing is created
- **Real-time Updates**: Points are awarded immediately upon transaction confirmation
- **Cross-platform**: Works in both browser and Farcaster miniapp environments

### Points Strategy

**Content Creators**: Focus on creating high-quality Evermarks (10 points each) and engaging with the community through voting (1 point each).

**Collectors**: Participate in the marketplace by buying quality Evermarks (1 point each) and listing your own collection (1 point per listing).

**Stakeholders**: Stake large amounts of $EMARK tokens for consistent point accumulation and increased voting power.

### Leaderboard Competition

- View real-time rankings on the leaderboard
- Points are tracked permanently with full transaction history
- Top performers gain community recognition and influence
- Historical data preserved for long-term achievement tracking

The points system creates a sustainable economy that rewards both content creation and marketplace participation, driving organic growth and community engagement.

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom cyber theme
- **State Management**: React Query + React Context
- **Storage**: ArDrive (Arweave) + IPFS (Pinata) + Supabase caching
- **Blockchain**: Thirdweb SDK + Wagmi + Viem (Base Network)
- **Backend**: Netlify Functions + Supabase
- **Testing**: Vitest + React Testing Library

### Storage Architecture

```
User Upload → ArDrive (Permanent) → Blockchain (Metadata URI)
                ↓            ↓
           IPFS (Fast)   Supabase (Cache) ← Background Sync
```

**Unified Storage Approach**: Content stored on ArDrive (Arweave) for permanent preservation, IPFS for fast access, with Supabase providing optimized caching for the best user experience.

## 📚 Development

### Project Structure

Each feature follows this pattern:
```
features/[feature-name]/
├── components/     # Feature-specific UI components
├── hooks/         # State management hooks
├── services/      # Pure business logic functions
├── types/         # TypeScript interfaces
└── index.ts       # Public API exports
```

### Adding a New Feature

1. **Define Types**: Create clear TypeScript interfaces
2. **Build Services**: Pure functions for business logic
3. **Create Hook**: Single state management hook
4. **Build Components**: UI components that use the hook
5. **Export API**: Clean public interface

### Code Quality

- TypeScript strict mode with no `any` types
- ESLint + Prettier for consistent formatting
- Comprehensive error handling
- Unit tests for business logic
- Integration tests for hooks

## 🚀 Deployment

Built for Netlify with:
- Automatic deployments from main branch
- Netlify Functions for backend API
- Environment variable management
- Edge caching for optimal performance

## 🔧 Environment Variables

```bash
# Blockchain (Required)
VITE_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
VITE_CHAIN_ID=8453  # Base mainnet

# Database (Required)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_service_key  # Backend only

# Storage Systems (Required)
# ArDrive (Arweave) - Primary permanent storage
VITE_ARDRIVE_API_KEY=your_ardrive_api_key
VITE_ARDRIVE_WALLET_KEY=your_ardrive_wallet_key

# IPFS - Fast access layer
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET_KEY=your_pinata_secret
VITE_PINATA_JWT=your_pinata_jwt
VITE_PINATA_GATEWAY=your_gateway_url

# Smart Contracts (Required)
VITE_EMARK_TOKEN_ADDRESS=0x...
VITE_CARD_CATALOG_ADDRESS=0x...
VITE_EVERMARK_NFT_ADDRESS=0x...
VITE_EVERMARK_VOTING_ADDRESS=0x...
VITE_EVERMARK_LEADERBOARD_ADDRESS=0x...
VITE_EVERMARK_REWARDS_ADDRESS=0x...
VITE_FEE_COLLECTOR_ADDRESS=0x...
VITE_MARKETPLACE_ADDRESS=0x...

# Farcaster Integration (Optional)
VITE_FARCASTER_DEVELOPER_FID=your_developer_fid
VITE_NEYNAR_API_KEY=your_neynar_key
VITE_FARCASTER_MINI_APP_ID=your_mini_app_id
```

### Local Development Setup

1. Copy environment variables from `.env.local.example`
2. Configure ArDrive for permanent storage
3. Configure Pinata for IPFS uploads
4. Set up Supabase database and storage
5. Deploy smart contracts to Base network
6. Run `npx netlify dev` for full functionality

## 📖 Key Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Complete development guide for Claude Code
- **[SEASON_MANAGEMENT_SYSTEM.md](./SEASON_MANAGEMENT_SYSTEM.md)** - Season orchestration and ArDrive integration
- **[Architecture Overview](#-architecture)** - Feature-first design principles
- **[Storage Architecture](#storage-architecture)** - Unified storage approach
- **[Environment Setup](#local-development-setup)** - Local development guide

### SDK Integration

The project uses **evermark-sdk** for core functionality:

- **IPFS Uploads**: `IPFSClient.uploadFile()` for direct IPFS storage
- **Image Resolution**: Smart fallback between IPFS gateways and Supabase cache
- **Validation**: URL, IPFS hash, and metadata validation utilities
- **Storage Orchestration**: Intelligent content delivery optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`  
3. Follow the feature-first architecture patterns
4. Ensure type safety: `npm run type-check`
5. Test locally: `npx netlify dev`
6. Submit a pull request

### Development Workflow

- **Feature Development**: Each feature is self-contained in `src/features/[name]/`
- **Code Quality**: ESLint + Prettier with strict TypeScript
- **Testing**: Vitest for business logic, React Testing Library for components
- **Documentation**: Update CLAUDE.md for architectural changes

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Evermark Beta v2.0** - Decentralized content preservation, built for permanence 🚀

*Powered by ArDrive + IPFS, secured by blockchain, optimized for performance.*