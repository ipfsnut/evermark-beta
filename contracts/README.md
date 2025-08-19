# Evermark-Beta Smart Contracts

This directory contains the complete Evermark smart contract system designed for on-chain content preservation, token staking, voting, and rewards distribution.

## Contract Overview

### FeeCollector.sol
**Purpose:** Converts incoming ETH fees to WEMARK tokens for ecosystem liquidity

**Core Functions:**
- `convertEthToWemark()` - Converts ETH to WEMARK at current rates
- `setConversionRate(uint256 rate)` - Admin function to update conversion rates
- Emergency withdrawal functions for admin recovery

**Integration:** Entry point for ETH → WEMARK conversion

### WEMARK.sol  
**Purpose:** Stake EMARK tokens to receive wEMARK voting power with unbonding periods

**Core Functions:**
- `stake(uint256 amount)` - Stake EMARK to receive 1:1 wEMARK
- `initiateUnstake(uint256 amount)` - Begin 7-day unbonding process
- `completeUnstake()` - Complete unstaking after cooldown
- `getVotingPower(address user)` - Get voting power (wEMARK balance)
- `canUnstake(address user)` - Check if unstaking is available

**Key Features:**
- 1:1 EMARK ↔ wEMARK staking ratio
- 7-day unbonding cooldown period
- Automatic voting power calculation
- ERC20 compliance for compatibility

### EvermarkNFT.sol
**Purpose:** Mint and manage Evermark NFTs representing preserved content

**Core Functions:**
- `mint(address to, string memory contentHash, string memory metadataURI)` - Mint new Evermark
- `tokenURI(uint256 tokenId)` - Get NFT metadata URI
- `getContentHash(uint256 tokenId)` - Get preserved content hash
- `totalSupply()` - Get total minted NFTs

**Key Features:**
- UUPS upgradeable pattern
- Pausable for emergency stops
- Role-based access control
- Content hash preservation

### EvermarkVoting.sol
**Purpose:** Seasonal voting system using wEMARK voting power

**Core Functions:**
- `startNewSeason()` - Begin new voting season
- `voteForEvermark(uint256 evermarkId, uint256 votes)` - Cast votes using wEMARK power
- `getCurrentSeason()` - Get active season number
- `getEvermarkVotes(uint256 seasonId, uint256 evermarkId)` - Get vote counts
- `getRemainingVotingPower(address user)` - Check available votes for season

**Key Features:**
- Seasonal voting cycles
- Voting power based on wEMARK balance
- Vote tracking per user per season
- Integration with WEMARK for power calculation

### NFTStaking.sol
**Purpose:** Content creator verification through NFT staking (repurposed for verification badges)

**Core Functions:**
- `stakeNFT(uint256 tokenId, uint8 lockTier)` - Stake Evermark NFT for verification
- `unstakeNFT(uint256 tokenId)` - Return staked NFT
- `isNFTStaked(uint256 tokenId)` - Check if NFT is staked
- `getStakedNFTs(address user)` - Get user's staked NFTs

**Key Features:**
- Content creator verification system
- Lock tiers for different commitment levels
- No token rewards (verification badge only)
- Proves content ownership/creation

### EvermarkRewards.sol
**Purpose:** Dual-token rewards system (EMARK + WETH) with adaptive pool-based distribution

**Core Functions:**
- `claimRewards()` - Claim both EMARK and WETH rewards
- `fundWethRewards(uint256 amount)` - Fund WETH reward pool
- `fundEmarkRewards(uint256 amount)` - Fund EMARK reward pool
- `getPeriodStatus()` - Get current reward period information
- `getUserRewardInfo(address user)` - Get user's pending rewards

**Key Features:**
- Adaptive rate calculation based on pool balances
- Stable reward periods with automatic rebalancing
- Synthetix-style reward tracking for gas efficiency
- Uses WEMARK as staking token for reward eligibility

## Contract Relationships

```
User Flow A (Voting):
EMARK → stake() → WEMARK → getVotingPower() → EvermarkVoting

User Flow B (Rewards):  
WEMARK → balanceOf() → EvermarkRewards → earn EMARK+WETH

User Flow C (Verification):
Creator → mint EvermarkNFT → stake in NFTStaking → get Verified badge

User Flow D (Fee Collection):
ETH fees → FeeCollector → convertEthToWemark() → WEMARK liquidity
```

## Integration Architecture

### Provider Hierarchy (Frontend)
1. QueryClientProvider (React Query)
2. ThirdwebProvider (blockchain SDK)
3. FarcasterProvider (Frame/auth context)
4. WalletProvider (wallet connection)
5. BlockchainProvider (contract interactions)
6. IntegratedUserProvider (unified user management)
7. AppContextProvider (app-level state)

### Contract Dependencies
- **EvermarkRewards** uses WEMARK as stakingToken (ICardCatalog interface)
- **EvermarkVoting** reads voting power from WEMARK contract
- **NFTStaking** manages EvermarkNFT tokens for verification
- **FeeCollector** converts ETH to WEMARK for ecosystem liquidity

## Technical Implementation

### Interface Compatibility
✅ **WEMARK ↔ EvermarkRewards**: Compatible (ERC20 provides required interface)
✅ **EvermarkVoting ↔ WEMARK**: Perfect interface match
✅ **All contracts**: Properly implement expected interfaces

### Security Features
- All contracts use OpenZeppelin upgradeable patterns
- Role-based access control (ADMIN_ROLE, DISTRIBUTOR_ROLE, etc.)
- Reentrancy guards on critical functions
- Pausable functionality for emergency stops
- UUPS proxy pattern for upgrades

### Deployment Considerations
- All contracts tagged with "Evermark-Beta" for version identification
- UUPS upgradeable pattern allows for future improvements
- Proper initialization functions for proxy deployment
- Compatible with Base network (chain ID 8453)

## Environment Variables Required

```
VITE_EMARK_TOKEN_ADDRESS=           # EMARK token contract
VITE_WEMARK_ADDRESS=                # WEMARK staking contract  
VITE_EVERMARK_NFT_ADDRESS=          # EvermarkNFT contract
VITE_EVERMARK_VOTING_ADDRESS=       # EvermarkVoting contract
VITE_NFT_STAKING_ADDRESS=           # NFTStaking contract
VITE_EVERMARK_REWARDS_ADDRESS=      # EvermarkRewards contract
VITE_FEE_COLLECTOR_ADDRESS=         # FeeCollector contract
```

## Gas Optimization Features

- Efficient batch operations where applicable
- Optimized storage layouts
- Minimal external contract calls
- Event-driven state updates for off-chain tracking

## Strategic Design Decisions

1. **On-chain Rewards**: Trustless distribution with automatic enforcement
2. **Dual Token System**: EMARK utility + WETH value rewards
3. **Verification Badges**: NFT staking for creator verification (off-chain badges)
4. **Seasonal Voting**: Time-bound cycles for fair participation
5. **Adaptive Rates**: Pool-based reward calculation for sustainability

This architecture balances on-chain functionality with off-chain flexibility, ensuring core financial operations remain trustless while allowing UI/UX iteration.