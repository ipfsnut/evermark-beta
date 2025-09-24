# Evermark Protocol Fee Structure

## Overview
The Evermark Protocol implements a sustainable fee model with clear separation between development funding and community rewards. All fees are transparent and on-chain.

## Content Storage Economics

### File Size Limits
**Maximum:** 25MB per file  
**Coverage:** 95%+ of Farcaster content  
**Fixed Fee:** $0.30 (0.00007 ETH)  

### Cost Analysis
- **ArDrive Storage:** ~$0.46 per GB
- **25MB Cost:** ~$0.0115 to ArDrive  
- **User Pays:** $0.30 fixed fee
- **Profit Margin:** ~26x on maximum file size
- **Oversized Files:** >25MB preserved via reference links only

## Fee Sources

### 1. NFT Minting Fees (Anti-Spam Development Fee)
**Amount:** 0.00007 ETH per Evermark NFT  
**Purpose:** Anti-spam mechanism and development cost funding  
**Contract:** EvermarkNFT.sol  
**Collection:** Direct payment when minting

#### Fee Distribution:
- **90% (0.000063 ETH):** Development Wallet (`emark.base.eth` / `0x3427b4716B90C11F9971e43999a48A47Cf5B571E`)
- **10% (0.000007 ETH):** Referral reward (if applicable)

#### Flow:
```
User pays 0.00007 ETH → EvermarkNFT Contract
├── 10% to Referrer (if exists)
└── 90% → FeeCollector → Development Wallet (0x3427b4716B90C11F9971e43999a48A47Cf5B571E)
```

**Important:** This fee is completely separate from the staking rewards system and funds ongoing development costs.

### 2. Trading Fee Revenue (Future)
**Amount:** 0.4% of EMARK/WETH trading volume  
**Source:** Clanker liquidity pool (0.8% total fee, split 50/50)  
**Collection:** FeeCollector contract

#### Distribution:
- 0.4% to FeeCollector (Protocol)
- 0.4% to Clanker/Dev wallet

#### Flow:
```
EMARK/WETH trades on Clanker
└── 0.8% total fee
    ├── 0.4% to FeeCollector
    │   └── Converted to rewards (WETH/EMARK)
    └── 0.4% to Clanker/Dev
```

## Fee Collection Architecture

### Development Wallet
**Address:** `emark.base.eth` (`0x3427b4716B90C11F9971e43999a48A47Cf5B571E`)  
**Purpose:** Receives 100% of minting fees (minus referrals) for development costs  
**Function:** Operational funding, completely separate from staking rewards

### Fee Collector Contract
**Address:** `0xaab93405679576ec743fDAA57AA603D949850604`  
**Purpose:** Immediate forwarding of minting fees to development wallet

### Functions:
- Receives NFT minting fees from EvermarkNFT
- Immediately forwards fees to development wallet via `feeRecipient`
- Future: May handle trading fees for reward distribution
- **Not used for**: Staking reward accumulation or distribution

## Two-System Architecture

### System 1: Development Funding (Active)
```
Minting Fees → FeeCollector → Development Wallet
Purpose: Fund development, operations, anti-spam
Status: Active and working
```

### System 2: Community Rewards (Future/Separate)
```
Trading Fees → Reward Pools → Stakers
Purpose: Community incentives and rewards
Status: Separate system, not connected to minting fees
```

## Referral System

### Structure:
- **Referral Percentage:** 10% of minting fee
- **Referral Amount:** 0.000007 ETH per successful referral
- **Payment:** Direct transfer to referrer address

### Features:
- Automatic payment on successful mint
- Pending payment system for failed transfers
- Claimable pending payments
- On-chain referral tracking

## Smart Contract Addresses

| Contract | Address | Purpose |
|----------|---------|---------|
| **Development Wallet** | `0x3427b4716B90C11F9971e43999a48A47Cf5B571E` | **Final destination for all minting fees** |
| FeeCollector | `0xaab93405679576ec743fDAA57AA603D949850604` | Fee forwarding to development wallet |
| EvermarkNFT | `0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2` | NFT minting & referrals |
| EvermarkRewards | `0x88E5C57FFC8De966eD789ebd5A8E3B290Ed2B55C` | Future reward distribution (separate system) |
| EMARK Token | `0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07` | Ecosystem token |
| WEMARK | `0xDf756488A3A27352ED1Be38A94f6621A6CE2Ce15` | Staked EMARK wrapper |

## Administrative Controls

### Fee Management:
- Admin can update FeeCollector address
- Development wallet controlled independently
- Emergency withdrawal mechanisms
- Pause functionality for security

### Transparency:
- All fees visible on-chain
- Public view functions for balances
- Event emissions for tracking
- No hidden or variable fees

## Economic Model

### Development Sustainability:
1. **Fixed Anti-Spam Fee:** 0.00007 ETH prevents spam, funds development
2. **Direct Funding:** No intermediary storage, immediate development funding
3. **Referral Incentives:** 10% commission drives organic growth
4. **Predictable Costs:** Fixed fee structure for users

### Value Flow:
```
User Mints Evermark (0.00007 ETH)
         ↓
If referrer exists: 0.000007 ETH → Referrer
         ↓
Remaining 0.000063 ETH → FeeCollector → Development Wallet
         ↓
Funds development costs, server maintenance, improvements
```

## Fee Calculations

### Minting an Evermark:
- **Base Cost:** 0.00007 ETH
- **With Referral:** User pays same, referrer earns 0.000007 ETH
- **Development Receives:** 0.000063 ETH (or 0.00007 ETH if no referral)

### Real-Time Balance Tracking:
- Development wallet balance visible on BaseScan
- Fee collection events trackable on-chain
- Referral payments transparent and immediate

## Key Distinctions

### What Minting Fees Are:
✅ Anti-spam mechanism  
✅ Development cost funding  
✅ Operational expense coverage  
✅ Infrastructure maintenance  

### What Minting Fees Are NOT:
❌ Part of staking rewards system  
❌ Community reward pool funding  
❌ Token holder dividends  
❌ DAO treasury accumulation  

## Future Considerations

### Potential Additional Revenue:
- Trading fees for community rewards (separate system)
- Premium features
- API access fees
- Enterprise services

### Governance:
- Development wallet remains controlled for operational needs
- Future community reward systems may have DAO governance
- Clear separation maintained between operational and community funds

## Summary

The Evermark fee structure implements a clear two-system approach:

1. **Development System**: 0.00007 ETH minting fees → Development wallet (`0x3427b4716B90C11F9971e43999a48A47Cf5B571E`)
   - Purpose: Anti-spam + operational funding
   - Status: Active and working
   - Separation: Completely independent from rewards

2. **Future Rewards System**: Trading fees → Community rewards
   - Purpose: Staker incentives and community growth
   - Status: Separate architecture, not connected to minting fees
   - Governance: Future DAO control potential

This architecture ensures sustainable development funding while maintaining clear boundaries between operational costs and community incentives.