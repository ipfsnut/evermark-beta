# [DRAFT] Dual Rewards System: Staking + Leaderboard

> **⚠️ DRAFT DOCUMENT**: This document describes a proposed feature that is under development and subject to change.

## System Overview

The Evermark ecosystem now features a **dual rewards architecture** that incentivizes both token holders (stakers) and content creators (leaderboard winners):

1. **EvermarkRewards Contract**: Rewards $WEMARK stakers with continuous distributions
2. **LeaderboardRewards Contract**: Rewards top content creators with periodic prizes

Both contracts use the same adaptive pool-based mechanics but with different distribution strategies.

## Architecture Comparison

| Feature | EvermarkRewards (Staking) | LeaderboardRewards (Winners) |
|---------|---------------------------|------------------------------|
| **Recipients** | All $WEMARK stakers | Top 10 leaderboard winners |
| **Distribution** | Continuous (per second) | Periodic (end of season) |
| **Calculation** | Pro-rata by stake size | Fixed percentages by rank |
| **Claiming** | Anytime | After period finalization |
| **Fee Source** | Clanker trading fees | Marketplace trading fees |
| **Tokens** | WETH + $EMARK | WETH + $EMARK |
| **Period** | 7 days (rebalancing) | 7 days (voting seasons) |

## Fee Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│                   TRADING ACTIVITY                   │
└─────────────────┬───────────────┬───────────────────┘
                  │               │
         Clanker Pool         Marketplace
         (0.8% fee)           (1% fee planned)
                  │               │
         ┌────────┴────┐   ┌─────┴─────┐
         │ 0.4% Dev    │   │ 0.5% Dev  │
         │ 0.4% Fees   │   │ 0.5% Fees │
         └────────┬────┘   └─────┬─────┘
                  │               │
           FeeCollector    MarketplaceFees
                  │               │
      (Manual Forwarding)  (Manual Forwarding)
                  │               │
         ┌────────▼────┐   ┌─────▼──────────┐
         │EvermarkRewards│ │LeaderboardRewards│
         │  (Stakers)    │ │   (Winners)      │
         └───────────────┘ └──────────────────┘
                  │               │
           All stakers      Top 10 creators
           (continuous)     (weekly prizes)
```

## LeaderboardRewards Contract Features

### Winner Distribution Model

Default prize distribution for top 10:
```
1st place:  40% of period pool
2nd place:  25% of period pool
3rd place:  15% of period pool
4th place:  10% of period pool
5th place:   5% of period pool
6th place:   2% of period pool
7th place:   1% of period pool
8th place:   1% of period pool
9th place:   0.5% of period pool
10th place:  0.5% of period pool
─────────────────────────────
Total:      100% of allocated funds
```

### Period Mechanics

1. **Period Start**: Contract takes snapshot of pool balances
2. **Period Duration**: 7 days of marketplace activity
3. **Winner Submission**: Oracle submits top 10 from voting results
4. **Reward Calculation**: Pool snapshot × distribution rate ÷ 52 weeks
5. **Individual Allocation**: Total rewards × rank percentage
6. **Claiming**: Winners can claim anytime after finalization

### Smart Contract Functions

#### Core Functions
```solidity
// Submit winners (Oracle only)
submitPeriodWinners(
    uint256 periodNumber,
    address[] winners,
    uint256[] evermarkIds
)

// Claim rewards
claimRewards(uint256 periodNumber)
claimAllRewards() // Claims all unclaimed periods

// View functions
getPeriodWinners(uint256 periodNumber)
getUserRewardsForPeriod(address user, uint256 period)
getUnclaimedRewards(address user)
getCurrentPoolStatus()
```

## Economic Dynamics

### Scenario: Marketplace Launch Impact

Assumptions:
- Marketplace fee: 1% (0.5% to LeaderboardRewards)
- Weekly marketplace volume: $500,000
- LeaderboardRewards distribution: 30% APR
- Initial pool: 50,000 $EMARK

```
Week 1 Analysis:
- Marketplace fees collected: $500,000 × 0.5% = $2,500
- Pool distribution: 50,000 × (30% ÷ 52) = 288 $EMARK
- Net pool growth: +$2,212 worth

Winner Rewards (Week 1):
- 1st place: 288 × 40% = 115 $EMARK
- 2nd place: 288 × 25% = 72 $EMARK
- 3rd place: 288 × 15% = 43 $EMARK
- ...
- 10th place: 288 × 0.5% = 1.4 $EMARK
```

### Compounding Growth

Just like EvermarkRewards, the LeaderboardRewards pool can grow exponentially:

```python
# Simulation over 52 weeks
week_1_pool = 50000
week_1_distribution = 288
week_1_inflow = 2500

week_52_pool = 178000  # 3.5x growth
week_52_distribution = 1027  # 3.5x rewards
week_52_1st_prize = 411 $EMARK  # Worth ~$400+
```

## Strategic Benefits

### 1. Creator Incentives
- **Direct Monetization**: Top creators earn from their content
- **Predictable Rewards**: Know exactly what each rank earns
- **Cumulative Earnings**: Can win multiple periods
- **No Staking Required**: Don't need capital to participate

### 2. Content Quality
- **Competition**: Creators compete for top spots
- **Innovation**: Encourages unique, high-quality content
- **Engagement**: Users vote for best content
- **Discovery**: Highlights best creators each week

### 3. Marketplace Growth
- **Trading Incentive**: Creators want their NFTs traded
- **Price Support**: Winners may buy their own NFTs
- **Marketing**: Winners promote their success
- **Network Effects**: More creators → more content → more trading

### 4. Token Economics
- **Dual Lock**: Both contracts can lock tokens
- **Diverse Demand**: Stakers AND creators want $EMARK
- **Revenue Diversification**: Multiple fee sources
- **Sustainable Rewards**: Real revenue, not inflation

## Integration with Existing System

### 1. Voting Integration
```solidity
// LeaderboardRewards reads from EvermarkVoting
IEvermarkVoting.getCurrentSeason()
// Oracle reads voting results
// Submits to LeaderboardRewards
```

### 2. Marketplace Integration
```solidity
// Marketplace contract sends fees
MarketplaceFees.collectTradingFees(token, amount)
// Admin forwards to LeaderboardRewards
MarketplaceFees.forwardToLeaderboard(amount)
```

### 3. Frontend Display
```typescript
// Show both reward types
interface UserRewards {
  stakingRewards: {
    pending: bigint;
    apr: number;
    poolShare: number;
  };
  leaderboardRewards: {
    unclaimedPeriods: number[];
    totalUnclaimed: bigint;
    historicalRank: number[];
  };
}
```

## Risk Analysis

### 1. Oracle Dependency
- **Risk**: Oracle could submit wrong winners
- **Mitigation**: Multi-sig oracle, time delays, dispute period

### 2. Rank Manipulation
- **Risk**: Creators could manipulate votes
- **Mitigation**: Sybil resistance via $WEMARK stake requirement

### 3. Pool Drainage
- **Risk**: High distribution rate empties pool
- **Mitigation**: Max 100% APR, governance controlled

### 4. Concentration Risk
- **Risk**: Same creators win repeatedly
- **Mitigation**: Community governance can adjust rules

## Future Enhancements

### 1. Dynamic Rank Rewards
```solidity
// Adjust percentages based on participation
if (totalVotes > threshold) {
    increaseTopPrizes();
} else {
    flattenDistribution();
}
```

### 2. Category Winners
```solidity
// Multiple winner categories
submitCategoryWinners(
    "art",     // Top art NFT
    "memes",   // Top meme
    "news",    // Top news preservation
    "historic" // Top historical content
)
```

### 3. Bonus Multipliers
```solidity
// Streak bonuses
if (consecutiveWins[creator] > 3) {
    rewardMultiplier = 1.5x;
}

// First-time winner bonus
if (firstWin[creator]) {
    bonusReward = 100 $EMARK;
}
```

### 4. Revenue Sharing Tiers
```solidity
// Different pool allocations
struct PoolAllocation {
    uint256 toWinners;      // 60%
    uint256 toVoters;       // 20%
    uint256 toStakers;      // 10%
    uint256 toTreasury;     // 10%
}
```

## Implementation Timeline

### Phase 1: Deploy LeaderboardRewards (Week 1)
- Deploy contract
- Set initial parameters
- Fund initial pool
- Test claiming mechanism

### Phase 2: Oracle Integration (Week 2)
- Build oracle service
- Connect to voting contract
- Implement winner calculation
- Test submission flow

### Phase 3: Marketplace Integration (Week 3-4)
- Update marketplace to send fees
- Create forwarding mechanism
- Test fee flow
- Monitor pool growth

### Phase 4: Frontend Integration (Week 5)
- Build leaderboard UI
- Show pending rewards
- Implement claim buttons
- Add analytics dashboard

## Conclusion

The dual rewards system creates a **complete economic ecosystem**:

1. **Stakers** earn from holding and governance participation
2. **Creators** earn from producing quality content
3. **Traders** benefit from better content discovery
4. **Protocol** benefits from increased activity

Both reward pools can experience the **dynamic locking effect**, potentially removing significant supply from circulation while rewarding the most valuable participants in the ecosystem.

This architecture is:
- **Scalable**: Can handle thousands of winners
- **Flexible**: Parameters adjustable by governance
- **Sustainable**: Funded by real economic activity
- **Fair**: Transparent on-chain distribution
- **Innovative**: Combines DeFi mechanics with creator economy

The synergy between the two contracts creates powerful network effects that should drive long-term value accrual to the $EMARK token.