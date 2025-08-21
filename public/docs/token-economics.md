# Token Economics

Evermark Protocol operates with a dual-token system designed to separate utility from governance while providing sustainable rewards.

## Token Overview

### $EMARK Token
- **Purpose**: Utility token for platform operations and staking
- **Use Cases**: Staking to receive wEMARK voting power and reward eligibility
- **Supply**: Existing supply with potential emission through rewards
- **Transferability**: Fully liquid and tradeable ERC20 token

### wEMARK Token  
- **Purpose**: Governance and reward token with voting power
- **Mechanism**: 1:1 wrapped version of staked EMARK tokens
- **Voting Power**: 1 wEMARK = 1 vote in seasonal governance cycles
- **Unbonding**: 7-day cooldown period required to unstake back to EMARK
- **Reward Eligibility**: Holding wEMARK makes users eligible for dual-token rewards

## Staking Process

Users stake their EMARK tokens to participate in governance and earn rewards:

1. **Stake EMARK**: Convert liquid EMARK to wEMARK (1:1 ratio)
2. **Gain Voting Power**: Use wEMARK balance for direct voting on Evermarks
3. **Earn Rewards**: Automatically eligible for EMARK + WETH rewards
4. **Unstake**: Initiate 7-day unbonding period to return to liquid EMARK

## Dual-Token Reward System

wEMARK holders earn rewards from two different token pools:

### WETH Rewards
- **Source**: Platform revenue and ecosystem funding converted to WETH
- **Distribution**: Proportional to wEMARK stake (no multipliers)
- **Value**: Real economic value in wrapped ETH
- **Funding**: Admin-controlled through EvermarkRewards funding functions

### EMARK Rewards
- **Source**: Token emission and ecosystem reward pools
- **Distribution**: Proportional to wEMARK stake alongside WETH
- **Utility**: Can be restaked to compound future rewards
- **Sustainability**: Pool-based distribution prevents excessive inflation

## Adaptive Pool Economics

### Pool-Based Distribution
- **Dynamic Rates**: Reward rates adjust based on actual pool balances
- **Sustainable**: No infinite emission, rewards come from funded pools
- **Predictable**: Fixed rates for period duration (typically 7 days)
- **Transparent**: Pool balances and rates visible on-chain

### Rate Calculation
```
Annual Rate = (Pool Balance × Configured %) / Total wEMARK Supply
Period Rate = Annual Rate × (Period Duration / 365 days)
```

### Economic Incentives
- **Staking Rewards**: Direct financial incentive to stake EMARK
- **Voting Participation**: Voting power tied to economic stake  
- **Creator Verification**: NFT staking proves content ownership
- **Fee Conversion**: Platform fees converted to ecosystem tokens

## Value Flows

### Platform Revenue → Ecosystem
1. **User Fees**: Platform generates ETH from user activity
2. **Fee Collection**: FeeCollector converts ETH to WEMARK tokens
3. **Reward Funding**: Clanker trading fees fund reward pools with WETH and EMARK
4. **Distribution**: Rewards flow to wEMARK stakers proportionally

### Token Utility Cycle
1. **EMARK Acquisition**: Users acquire EMARK tokens
2. **Staking**: Convert to wEMARK for voting power and rewards
3. **Governance**: Use wEMARK to vote in seasonal cycles
4. **Rewards**: Earn WETH (value) + EMARK (utility)
5. **Compounding**: Restake earned EMARK to increase future rewards

## Economic Design Principles

### Simplicity
- **No Multipliers**: Rewards based purely on proportional stake
- **Direct Staking**: Simple 1:1 EMARK ↔ wEMARK conversion
- **Pool-Based**: Predictable rewards from funded pools, not infinite emission

### Sustainability  
- **Funded Pools**: Rewards come from real funding, not endless inflation
- **Admin Control**: Flexible pool funding based on platform success
- **Value Alignment**: Reward tokens (WETH) have inherent value

### Participation Incentives
- **Immediate Eligibility**: Simply staking EMARK provides reward access
- **Compound Growth**: Earned EMARK can be restaked for larger future rewards
- **Governance Rights**: Voting power directly tied to economic commitment