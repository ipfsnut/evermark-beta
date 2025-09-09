# On-Chain Verification Guide for Evermark Protocol

## Transaction Analysis for 0xafe89ea153cf8d004cedef6788ad009ca3e7ade887dbcbef89c0f476813d0530

When reviewing this transaction on BaseScan, here's what to examine:

## Key Elements to Verify

### 1. Transaction Type
Check if this is:
- Contract deployment (creates new contract)
- Contract interaction (calls existing contract)
- Token transfer
- NFT mint

### 2. Contract Being Called
Based on our codebase, verify if it's calling one of these:
- **EvermarkNFT**: `0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2`
- **FeeCollector**: `0xaab93405679576ec743fDAA57AA603D949850604`
- **EvermarkVoting**: `0x5089FE55368E40c8990214Ca99bd2214b34A179D`
- **EvermarkRewards**: `0x88E5C57FFC8De966eD789ebd5A8E3B290Ed2B55C`
- **WEMARK**: `0xDf756488A3A27352ED1Be38A94f6621A6CE2Ce15`
- **EMARK Token**: `0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07`

### 3. Method Called
Common methods in Evermark protocol:
- `mintEvermark()` - Creates new Evermark NFT
- `mintEvermarkWithReferral()` - Mints with referral
- `voteForEvermark()` - Casts votes
- `stake()` - Stakes EMARK for wEMARK
- `claimRewards()` - Claims staking rewards
- `forwardToRewards()` - Forwards fees to reward pools

### 4. Value Sent
Check ETH value:
- **0.00007 ETH**: Standard minting fee
- **0 ETH**: Voting, staking, or view transaction
- **Other**: Could be reward distribution or special operation

### 5. Events Emitted
Key events to look for:
- `EvermarkMinted(tokenId, minter, referrer, title)`
- `ReferralEarned(referrer, referred, amount)`
- `VoteCast(voter, evermarkId, votes, season)`
- `Staked(user, amount)`
- `RewardsClaimed(user, amount)`
- `FeeCollectionSucceeded(amount)`

### 6. Input Data Decoding
The input data should decode to show:
- Function signature
- Parameters passed
- For minting: metadataURI, title, creator, referrer
- For voting: evermarkId, voteAmount
- For staking: amount

### 7. Gas Usage
Typical gas costs:
- Minting: 150,000-250,000 gas
- Voting: 50,000-100,000 gas
- Staking: 80,000-120,000 gas
- Claiming: 60,000-100,000 gas

## Fee Flow Verification

If this is a minting transaction, verify:

### Minting Fee Distribution
```
User sends 0.00007 ETH
├── If referrer exists:
│   ├── 0.000007 ETH (10%) → Referrer address
│   └── 0.000063 ETH (90%) → FeeCollector or stays in contract
└── If no referrer:
    └── 0.00007 ETH (100%) → FeeCollector or stays in contract
```

### Check Internal Transactions
Look for:
1. ETH transfer to referrer (if applicable)
2. Call to FeeCollector.collectNftCreationFees()
3. Any failed transactions or reverts

## State Changes to Verify

### For Minting:
- New token ID created
- Owner set to minter
- Metadata stored on-chain
- Referral recorded (if applicable)
- Total supply increased

### For Voting:
- Vote count increased for evermark
- User's voting power decreased
- Season vote tallies updated

### For Staking:
- EMARK transferred from user
- wEMARK minted to user
- Staking balance updated

## Contract Source Verification

Verify the contract source code on BaseScan matches our repository:

1. Click on the contract address
2. Go to "Contract" tab
3. Check if verified (green checkmark)
4. Click "Code" to view source
5. Compare with our `/contracts` folder

Key items to verify:
- MINTING_FEE = 0.00007 ether
- REFERRAL_PERCENTAGE = 10
- Contract version matches deployment
- Admin roles properly configured

## Security Checks

### Access Control
Verify only authorized addresses can:
- Call admin functions
- Pause contracts
- Update fee collectors
- Distribute rewards

### Fund Flow
Track where funds go:
1. From user wallet
2. To contract
3. To FeeCollector
4. To reward pools
5. To stakers

## Common Transaction Patterns

### Successful Mint
- Status: Success
- Value: 0.00007 ETH
- Events: EvermarkMinted, possibly ReferralEarned
- Token Transfer event from 0x0 to minter

### Failed Mint
- Status: Fail
- Common reasons:
  - Insufficient fee sent
  - Contract paused
  - Invalid metadata

### Vote Transaction
- Status: Success
- Value: 0 ETH
- Events: VoteCast
- State: Voting power reduced

## Tools for Analysis

### On BaseScan:
1. **Logs tab**: Shows all events emitted
2. **State tab**: Shows storage changes
3. **Internal Txns**: Shows contract-to-contract calls
4. **Trace**: Shows execution flow

### Using Tenderly:
1. Import transaction by hash
2. View visual execution trace
3. See gas consumption by operation
4. Debug reverted transactions

## What to Report

After analyzing the transaction, document:

1. **Transaction Purpose**: What was being done?
2. **Fee Compliance**: Did fees match documentation?
3. **Referral System**: Did referral payment work correctly?
4. **Event Accuracy**: Were correct events emitted?
5. **State Changes**: Were on-chain states updated properly?
6. **Gas Efficiency**: Was gas usage reasonable?
7. **Security**: Any unexpected behavior or vulnerabilities?

## Red Flags to Watch For

⚠️ **Warning Signs**:
- Fees not matching documented amounts
- Missing referral payments
- Events not matching actual state changes
- Unexpected contract calls
- Abnormally high gas usage
- Failed internal transactions
- Admin functions called by non-admin addresses

## Verification Checklist

- [ ] Transaction status is successful
- [ ] Correct contract address called
- [ ] Method matches intended action
- [ ] Fee amount is correct (0.00007 ETH for minting)
- [ ] Referral payment processed (if applicable)
- [ ] Events match expected behavior
- [ ] Gas usage is reasonable
- [ ] No security violations
- [ ] State changes are correct
- [ ] Internal transactions completed

This guide helps verify that the on-chain implementation matches the documented fee structure and protocol behavior.