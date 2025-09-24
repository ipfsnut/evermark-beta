# Evermark Protocol

## What is Evermark?

Evermark Protocol v2.0 is a decentralized system for creating permanent, verifiable references to online content. Built on the Base blockchain with ArDrive storage, it allows users to mark any digital content and ensure it remains accessible and attributable forever.

## Key Features

### Permanent References
- Create immutable links to any online content
- Store metadata on ArDrive (Arweave) for true permanent decentralized access
- Blockchain-verified ownership and timestamps

### Social Discovery
- Discover content through community curation
- Build personal collections of valuable references
- Share and explore evermarked content in Farcaster or via PWA or webapp

### Farcaster Integration
- Native support for Farcaster casts 
- Seamless wallet integration in Farcaster frames
- Social sharing and discovery features

## How It Works

1. **Create**: Submit a DOI, ISBN, URL, Farcaster cast, or Custom Object to create an Evermark
   - Maximum file size: 25MB per media file
   - Farcaster casts: Full text preserved for searchability
   - Large files: Reference links preserved when content exceeds limits

2. **Store**: Metadata is permanently stored on ArDrive (Arweave), reference recorded on-chain, and cached via Supabase for optimal performance with true permanence

3. **Share**: Your Evermark becomes part of the permanent web

4. **Discover**: Browse and collect Evermarks from the community

## Smart Contracts

The protocol consists of several interconnected smart contracts:

- **Evermark NFT**: Core NFT contract for minting and managing Evermarks
- **Voting System**: Community governance and content curation
- **Rewards**: Token distribution and incentive mechanisms
- **Leaderboard**: Ranking and reputation system

## Getting Started

1. Connect your wallet (MetaMask, Coinbase Wallet, or Farcaster)
2. Create your first Evermark by submitting a URL, DOI, or ISBN to share something meaningful on the network
3. Build your collection and discover content from others to earn rewards
4. Participate in the skin-in-the-game curation community through staking and voting

## Technical Details

- **Blockchain**: Base (Ethereum L2)
- **Storage**: IPFS for metadata and images
- **Standards**: ERC-721 for NFTs, ERC-20 for tokens
- **Frontend**: React with ThirdWeb and Wagmi integration
