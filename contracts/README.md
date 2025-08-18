# Optimized Evermark Contracts

This directory contains streamlined versions of the core Evermark contracts designed to stay under the 24KB deployment limit while maintaining the essential user flow: **stake → vote → leaderboard**.

## Contract Overview

### WEMARK.sol (~7-9KB estimated)
**Purpose:** Stake EMARK tokens to receive wEMARK voting power

**Core Functions:**
- `stake(uint256 amount)` - Stake EMARK to receive wEMARK
- `unstake(uint256 amount)` - Unstake wEMARK after 7-day cooldown
- `wEMARKBalance(address user)` - Get user's wEMARK balance
- `getVotingPower(address user)` - Get voting power (same as wEMARK balance)
- `canUnstake(address user)` - Check if cooldown period met

**Removed Features:**
- Complex reward calculations
- Batch operations
- Emergency functions
- Advanced staking mechanics

### EvermarkVoting.sol (~12-15KB estimated)
**Purpose:** Simple voting mechanism with weekly cycles

**Core Functions:**
- `startNewCycle()` - Begin new 7-day voting period
- `voteForEvermark(uint256 evermarkId, uint256 votes)` - Cast votes
- `getCurrentCycle()` - Get active cycle number
- `getEvermarkVotesInCycle(uint256 cycle, uint256 evermarkId)` - Get vote counts
- `getRemainingVotingPower(address user)` - Check available votes

**Removed Features:**
- Reward distribution system
- Batch voting operations
- Complex voting algorithms (quadratic, etc.)
- Emergency functions

### Existing Contracts (Keep as-is)
- **EvermarkNFT** - Working properly for NFT minting
- **EvermarkLeaderboard** - Working properly for rankings

## User Flow

1. **Stake:** User calls `CardCatalogCore.stake()` with EMARK tokens
2. **Vote:** User calls `EvermarkVotingCore.voteForEvermark()` during active cycle
3. **Results:** Leaderboard processes voting results via `finalizeLeaderboard()`

## Deployment Strategy

### Phase 1: Upgrade Existing Contracts
1. Upgrade existing CardCatalog proxy to new optimized implementation
2. Upgrade existing EvermarkVoting proxy to new optimized implementation  
3. Keep existing EvermarkNFT and EvermarkLeaderboard (already working)

### Phase 2: Re-initialize System
1. Re-initialize CardCatalog if needed (should retain existing state)
2. Re-initialize EvermarkVoting with proper contract addresses
3. Update EvermarkLeaderboard to work with upgraded voting contract
4. Start first voting cycle with new system

### Phase 3: Update Frontend
1. Update contract addresses in environment variables
2. Update ABIs in feature directories
3. Test complete user flow

## Interface Compatibility

The streamlined contracts maintain the same function signatures used by the frontend:

**CardCatalog (Original → Optimized):**
- ✅ `getVotingPower(address)` - Same interface
- ✅ `getStakedBalance(address)` - Same interface
- ✅ `stake(uint256)` - Same interface
- ✅ `unstake(uint256)` - Same interface

**EvermarkVoting (Original → Optimized):**
- ✅ `getCurrentCycle()` - Same interface
- ✅ `getEvermarkVotesInCycle(uint256, uint256)` - Same interface
- ✅ `voteForEvermark()` - Simplified parameters
- ✅ `getCycleInfo(uint256)` - Same interface

## Size Optimization Techniques Used

1. **Removed Complex Features:** Eliminated reward systems, batch operations
2. **Simplified Data Structures:** Basic mappings instead of complex structs
3. **Reduced External Dependencies:** Minimal imports
4. **Streamlined Logic:** Direct implementations without helper functions
5. **Essential Functions Only:** Focused on core user journey

## Future Enhancements

Advanced features can be added later as separate contracts:
- **EvermarkRewards** - Complex reward distribution
- **BatchOperations** - Multi-transaction operations  
- **AdvancedVoting** - Quadratic voting, delegation
- **EmergencyManager** - Pause/recovery mechanisms

This modular approach allows the core system to function immediately while enabling future expansion without deployment size constraints.

## Gas Optimization

The streamlined contracts also optimize for gas usage:
- Simple voting mechanism reduces transaction costs
- Direct storage access without complex calculations
- Minimal external contract calls
- Efficient data structures for common operations

## Security Features Retained

Core security features are maintained:
- Access control with admin roles
- Reentrancy guards
- Input validation
- Upgradeable proxy pattern
- Proper event emissions