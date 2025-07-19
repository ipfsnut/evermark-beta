# Evermark Beta

> Content curation on the blockchain - A complete rewrite focused on maintainability and clean architecture.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
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

- **Feature Isolation**: Each feature is independently testable and maintainable
- **Pure Functions**: All business logic as testable pure functions
- **Single State Hook**: One hook per feature for centralized state management
- **Type Safety**: Comprehensive TypeScript coverage with strict mode
- **Clean Separation**: UI components contain no business logic

## 🎯 Features

### Core Features
- **Evermarks**: Create and manage on-chain content preservation
- **Staking**: Lock $EMARK tokens to gain voting power
- **Voting**: Delegate voting power to quality content
- **Leaderboard**: Community-driven content rankings
- **Tokens**: Manage $EMARK balances and transactions

### Technical Features
- **Farcaster Integration**: Native Frame/Mini-app support
- **Blockchain**: Thirdweb SDK with Base network
- **Real-time Data**: React Query with smart caching
- **Responsive Design**: Mobile-first with cyber theme
- **Error Handling**: Comprehensive error boundaries

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom cyber theme
- **State Management**: React Query + React Context
- **Blockchain**: Thirdweb SDK + Wagmi + Viem
- **Backend**: Netlify Functions + Supabase
- **Testing**: Vitest + React Testing Library

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
# Blockchain
VITE_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
VITE_CHAIN_ID=8453  # Base mainnet

# Database
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Farcaster (optional)
VITE_FARCASTER_DEVELOPER_FID=your_developer_fid
```

## 📖 Documentation

- [Development Guide](./devguide) - Detailed architecture principles
- [Feature Guide](./docs/features.md) - How to build features
- [Deployment Guide](./docs/deployment.md) - Production setup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the development guide for architecture patterns
4. Ensure tests pass: `npm test`
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Evermark Beta** - Built for the future of content curation 🚀