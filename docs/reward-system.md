# Reward System

Evermark Protocol rewards community members with dual-token distributions based on their wEMARK stake through an adaptive pool-based system.

## Dual-Token Rewards

### WETH Rewards
**Source**: Platform revenue and ecosystem funding
- Distributed as wrapped ETH (WETH) for easier handling
- Funded by admins through the reward pool system
- Distributed proportionally to wEMARK stakers

### EMARK Rewards
**Source**: Token emission and ecosystem funding
- Distributed to incentivize platform participation
- Funded through the reward pool system
- Can be restaked by wrapping to wEMARK for compound growth

## Adaptive Pool System

### How It Works
- **Pool-Based**: Rewards come from funded WETH and EMARK pools
- **Adaptive Rates**: Reward rates adjust based on current pool balances
- **Stable Periods**: Rates are fixed for configurable periods (e.g., 7 days)
- **Automatic Rebalancing**: System recalculates rates at period end

### Rate Calculation
```
Reward Rate = (Pool Balance × Annual Percentage × Period Duration) / (365 days × Period Duration)
```

Example: If WETH pool has 100 WETH, 10% annual rate, 7-day period:
- Period allocation = (100 × 0.10 × 7) / 365 = ~0.19 WETH
- Per-second rate = 0.19 WETH / (7 × 24 × 3600) seconds

## Earning Rewards

### Eligibility
- **Hold wEMARK**: Must have staked EMARK tokens for wEMARK
- **Proportional Distribution**: Rewards based on your wEMARK balance vs total supply
- **No Activity Required**: Simply holding wEMARK makes you eligible

### Distribution Mechanics
- **Real-time Accrual**: Rewards accumulate continuously based on stake
- **Synthetix-Style**: Gas-efficient tracking of rewards per token
- **Claim Anytime**: Users can claim accumulated rewards at any time
- **Dual Claiming**: Claim both EMARK and WETH rewards together

### Reward Formula
```
User Rewards = (User wEMARK Balance / Total wEMARK Supply) × Period Reward Rate × Time Elapsed
```

## Pool Management

### Funding System
- **Admin Controlled**: DISTRIBUTOR_ROLE can fund reward pools
- **Separate Pools**: WETH and EMARK pools managed independently
- **Pool Snapshots**: System tracks pool balances at each rebalance

### Rebalancing Process
1. **Period End**: Current reward period expires
2. **Pool Snapshot**: System records current pool balances
3. **Rate Calculation**: New rates calculated based on pool sizes and annual percentages
4. **New Period**: Fresh period starts with updated rates

## Optimization Strategies

### Maximize Rewards
- **Increase Stake**: More wEMARK = larger share of reward pools
- **Hold Long-term**: Rewards accrue continuously while staked
- **Compound Growth**: Restake earned EMARK to grow future rewards
- **Timing**: Consider pool funding cycles for optimal entry

### Understanding Pool Dynamics
- **Pool Size Impact**: Larger pools = higher reward rates for that period
- **Annual Percentages**: Admin-configurable rates (default up to 50% annually)
- **Period Length**: Typically 7 days, but configurable by admins
- **Rebalancing**: Rates auto-adjust based on actual pool balances

## Current Implementation Features

### No Complexity
- **No Multipliers**: Simple proportional distribution based on stake
- **No Delegation**: Direct staking model without delegation complexity  
- **No Voting Requirements**: Rewards independent of voting activity
- **Automatic**: Set-and-forget earning once you stake EMARK

### Gas Efficiency
- **Batch Updates**: Reward calculations optimized for gas efficiency
- **Claim Flexibility**: Users choose when to pay gas for claiming
- **Storage Optimization**: Minimal on-chain storage for reward tracking