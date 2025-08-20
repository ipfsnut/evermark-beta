# Evermark-Beta Deployment Checklist

## Pre-Deployment Requirements

### Environment Setup
- [ ] Base network RPC configured
- [ ] Deployer wallet funded with ETH on Base
- [ ] Hardhat config set for Base network (chain ID: 8453)
- [ ] Contract verification API keys ready (Basescan)

### Existing Contract Addresses (Base Network)
- [ ] EMARK Token: `[EXISTING_ADDRESS]`
- [ ] WETH Token: `0x4200000000000000000000000000000000000006` (Base WETH)

## Contract Deployment Order

### Phase 1: Non-Upgradeable Contracts

#### 1. FeeCollector
```solidity
constructor(address _feeRecipient, uint256 _conversionRate)
```
- [ ] Deploy with initial fee recipient (treasury/admin)
- [ ] Set initial conversion rate (e.g., 1000 = 1 ETH = 1000 WEMARK)
- [ ] Verify contract on Basescan
- [ ] Record address: `___________________________`

#### 2. WEMARK
```solidity
constructor(address _emarkToken)
```
- [ ] Deploy with EMARK token address
- [ ] Verify contract on Basescan
- [ ] Record address: `___________________________`

### Phase 2: Upgradeable Contracts (Deploy Implementations)

#### 3. EvermarkNFT
```solidity
initialize()
```
- [ ] Deploy implementation contract
- [ ] Deploy proxy with initialize()
- [ ] Set fee collector address via `setFeeCollector()`
- [ ] Set mint fee via `setMintingFee()` (e.g., 0.001 ETH)
- [ ] Grant MINTER_ROLE to authorized addresses
- [ ] Verify both implementation and proxy
- [ ] Record proxy address: `___________________________`
- [ ] Record implementation: `___________________________`

#### 4. NFTStaking
```solidity
initialize(address _evermarkNFT, address _rewardToken)
```
- [ ] Deploy implementation contract
- [ ] Deploy proxy with initialize(EvermarkNFT, EMARK)
- [ ] Note: evermarkVoting can be set later if needed
- [ ] Configure base reward rate if different from default
- [ ] Verify both implementation and proxy
- [ ] Record proxy address: `___________________________`
- [ ] Record implementation: `___________________________`

#### 5. EvermarkVoting
```solidity
constructor(address _wemark, address _evermarkNFT)
```
- [ ] Deploy with WEMARK and EvermarkNFT addresses
- [ ] Start first season via `startNewSeason()`
- [ ] Verify contract on Basescan
- [ ] Record address: `___________________________`

#### 6. EvermarkRewards
```solidity
initialize(
    address _emarkToken,
    address _stakingToken,  // WEMARK address
    address _wethToken,
    uint256 _wethDistributionRate,  // e.g., 1000 = 10% annually
    uint256 _emarkDistributionRate, // e.g., 1000 = 10% annually
    uint256 _rebalancePeriod        // e.g., 604800 = 7 days
)
```
- [ ] Deploy implementation contract
- [ ] Deploy proxy with initialize parameters
- [ ] Fund initial reward pools via `fundWethRewards()` and `fundEmarkRewards()`
- [ ] Verify both implementation and proxy
- [ ] Record proxy address: `___________________________`
- [ ] Record implementation: `___________________________`

## Post-Deployment Configuration

### Access Control Setup
- [ ] EvermarkNFT: Ensure admin has DEFAULT_ADMIN_ROLE
- [ ] NFTStaking: Ensure admin has ADMIN_ROLE
- [ ] EvermarkRewards: Ensure admin has DISTRIBUTOR_ROLE
- [ ] FeeCollector: Ensure owner is set correctly
- [ ] WEMARK: Ensure owner is set correctly

### Integration Configuration
- [ ] Update FeeCollector to point to deployed WEMARK (if needed)
- [ ] Configure NFTStaking reward rates if needed
- [ ] Fund EvermarkRewards pools with initial WETH and EMARK

### Frontend Updates
- [ ] Update .env with all contract addresses:
  ```
  VITE_EMARK_TOKEN_ADDRESS=
  VITE_WEMARK_ADDRESS=
  VITE_EVERMARK_NFT_ADDRESS=
  VITE_EVERMARK_VOTING_ADDRESS=
  VITE_NFT_STAKING_ADDRESS=
  VITE_EVERMARK_REWARDS_ADDRESS=
  VITE_FEE_COLLECTOR_ADDRESS=
  ```
- [ ] Copy ABIs to frontend feature directories
- [ ] Update contract addresses in frontend configs

## Verification Steps

### Contract Functionality
- [ ] Test EMARK → WEMARK staking flow
- [ ] Test WEMARK voting power in EvermarkVoting
- [ ] Test EvermarkNFT minting with fee collection
- [ ] Test NFTStaking for creator verification
- [ ] Test EvermarkRewards claim functionality
- [ ] Test FeeCollector ETH → WEMARK conversion

### Security Checks
- [ ] All contracts verified on Basescan
- [ ] Admin roles properly assigned
- [ ] Upgrade permissions restricted to admin only
- [ ] Emergency pause functions tested
- [ ] No unauthorized mint/transfer capabilities

### Integration Tests
- [ ] WEMARK provides voting power to EvermarkVoting
- [ ] WEMARK balance enables EvermarkRewards eligibility
- [ ] FeeCollector successfully converts ETH to WEMARK
- [ ] NFTStaking accepts and returns EvermarkNFTs

## Critical Warnings

⚠️ **Before Deployment:**
1. Ensure EvermarkRewards ICardCatalog interface accepts WEMARK
2. Consider removing unused evermarkVoting from NFTStaking
3. Double-check all initialization parameters
4. Have multiple team members review deployment script

⚠️ **During Deployment:**
1. Deploy to testnet first for full integration test
2. Keep private keys secure and use hardware wallet
3. Verify each contract immediately after deployment
4. Document all transaction hashes

⚠️ **After Deployment:**
1. Transfer ownership to multisig if applicable
2. Renounce unnecessary admin roles
3. Monitor initial transactions closely
4. Have incident response plan ready

## Deployment Script Template

```javascript
// Example deployment order
async function main() {
  // 1. Deploy FeeCollector
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(TREASURY, CONVERSION_RATE);
  
  // 2. Deploy WEMARK
  const WEMARK = await ethers.getContractFactory("WEMARK");
  const wemark = await WEMARK.deploy(EMARK_ADDRESS);
  
  // 3. Deploy EvermarkNFT (upgradeable)
  const EvermarkNFT = await ethers.getContractFactory("EvermarkNFT");
  const nft = await upgrades.deployProxy(EvermarkNFT, [], { kind: 'uups' });
  
  // ... continue for other contracts
  
  // Post-deployment configuration
  await nft.setFeeCollector(feeCollector.address);
  // ... other configurations
}
```

## Sign-off

- [ ] Technical Lead Review: ___________________ Date: _______
- [ ] Security Review: _______________________ Date: _______
- [ ] Deployment Executor: ___________________ Date: _______
- [ ] Post-Deployment Verification: ___________ Date: _______