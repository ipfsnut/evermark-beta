# Technical Overview

Evermark Protocol v2.0 is built on modern blockchain infrastructure with ArDrive permanent storage to ensure true permanence, decentralization, and scalability.

## Core Infrastructure

### Blockchain Layer
- **Base Network**: Layer 2 solution built on Ethereum, Base, and the OP Stack
- **Low Fees**: Cost-effective transactions for all users
- **Fast Finality**: Quick confirmation times
- **Ethereum Security**: Inherits base layer security guarantees

### Storage Layer - ArDrive Primary Architecture
- **ArDrive (Arweave)**: Primary permanent storage for all new content
- **Supabase**: Performance caching layer for optimal user experience
- **Legacy IPFS**: Backward compatibility for existing content
- **Content Addressing**: Cryptographic hashes ensure data integrity
- **Gateway Access**: Multiple access points for redundancy

## Smart Contract System

### Core Contracts

**EvermarkNFT**
- Creates and manages Evermark NFT tokens representing preserved content
- Stores content hashes and metadata references to ArDrive permanent storage
- UUPS upgradeable with role-based access control
- Handles ownership, transfer, and minting functionality

**WEMARK** 
- Manages EMARK ↔ wEMARK token staking (1:1 ratio)
- Implements 7-day unbonding cooldown period for unstaking
- Provides voting power calculation (wEMARK balance = voting power)
- ERC20 compliant for ecosystem compatibility

**EvermarkVoting**
- Manages seasonal voting cycles controlled by admins
- Processes direct voting (no delegation) using wEMARK power
- Tracks votes per user per season with spending limits
- Integrates with WEMARK for voting power verification

**EvermarkRewards**
- Distributes dual-token rewards (EMARK + WETH) to wEMARK stakers
- Adaptive pool-based system with periodic rebalancing
- Synthetix-style reward tracking for gas efficiency
- Uses WEMARK as staking token for reward eligibility

**NFTStaking**
- Content creator verification through Evermark NFT staking
- Lock tiers for different commitment levels (no token rewards)
- Proves content ownership/creation for verified badges
- Repurposed from rewards to verification system

**FeeCollector**
- Converts incoming ETH platform fees to WEMARK tokens
- Provides ecosystem liquidity and token utility
- Admin-controlled conversion rates and emergency functions
- Entry point for ETH → WEMARK conversion flow

## Content Support

### Supported Content Types
- **Farcaster Casts**: Full text preservation with visual preview generation
  - Complete cast text stored in description field for searchability
  - Visual representation generated showing text, author, and engagement
  - Thread preservation for connected conversations
  - Media files up to 25MB preserved, larger files linked
- **Web URLs**: Any online content with custom metadata
- **Academic Papers**: DOI support for scholarly content
- **Books**: ISBN support for published works

### Content Size Limits
- **Maximum file size**: 25MB per media file
- **Coverage**: Handles 95%+ of Farcaster content
- **Oversized handling**: Files >25MB preserved via reference links
- **Economics**: Fixed $0.30 fee covers storage costs with healthy margins

### Metadata Structure
All Evermarks store comprehensive metadata including:
- Title and description (full text for casts)
- Author information  
- Source URL and content type
- Custom fields and tags
- Creation timestamp and creator address
- Preserved media references and sizes

## User Features

### Personal Bookshelf
- **Favorites**: Curate up to 3 favorite Evermarks
- **Reading List**: Maintain up to 10 current reading items
- **Personal Notes**: Add private notes to bookmarked content
- **Quick Access**: Easy browsing of your curated content

### Social Discovery
- **Leaderboards**: View weekly top-voted content
- **Browse Collections**: Explore other users' Evermarks
- **Community Trends**: Discover popular and trending content

## Integration Layers

### Farcaster Integration
- **Native Frames**: Works within Farcaster client apps
- **Cast Processing**: Automatic metadata extraction from Farcaster URLs
- **User Context**: Leverages Farcaster user profiles when available

### Web3 Wallet Support
- **Multiple Wallets**: Support for various wallet providers
- **Farcaster Wallets**: Native integration with Farcaster wallet functionality
- **Desktop Wallets**: Traditional Web3 wallet compatibility

## Frontend Technology

### Modern Web Stack
- **React 18**: Component-based user interface
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Vite**: Fast development and build tooling

### Web3 Integration
- **ThirdWeb v5**: Smart contract interaction layer
- **Wagmi**: Ethereum integration for React
- **Farcaster SDK**: Frame support and social features