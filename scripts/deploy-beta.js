// Evermark-Beta Deployment Script
// Deploy all contracts in correct order with proper initialization

const { ethers, upgrades } = require("hardhat");

// Configuration
const CONFIG = {
  // Base Network WETH
  WETH_ADDRESS: "0x4200000000000000000000000000000000000006",
  
  // Existing EMARK token (update with actual address)
  EMARK_ADDRESS: process.env.EMARK_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000",
  
  // FeeCollector settings
  FEE_RECIPIENT: process.env.FEE_RECIPIENT || null, // Will use deployer if not set
  
  // EvermarkNFT settings
  MINT_FEE: ethers.parseEther("0.00007"), // 0.00007 ETH mint fee
  
  // EvermarkRewards settings
  WETH_DISTRIBUTION_RATE: 1000, // 10% annually (in basis points)
  EMARK_DISTRIBUTION_RATE: 1000, // 10% annually (in basis points)
  REBALANCE_PERIOD: 7 * 24 * 60 * 60, // 7 days in seconds
  
  // Initial funding for rewards (optional)
  INITIAL_WETH_FUNDING: ethers.parseEther("0"), // Set to 0 if not funding initially
  INITIAL_EMARK_FUNDING: ethers.parseEther("0"), // Set to 0 if not funding initially
};

async function main() {
  console.log("🚀 Starting Evermark-Beta Deployment...\n");
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  // Validate configuration
  if (CONFIG.EMARK_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error("❌ EMARK_ADDRESS must be set in environment or CONFIG");
  }
  
  const feeRecipient = CONFIG.FEE_RECIPIENT || deployer.address;
  
  // Track deployed addresses
  const deployed = {};
  
  try {
    // ============================================
    // Phase 1: Deploy Non-Upgradeable Contracts
    // ============================================
    
    console.log("📦 Phase 1: Deploying Non-Upgradeable Contracts\n");
    
    // 1. Deploy FeeCollector
    console.log("1. Deploying FeeCollector...");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = await FeeCollector.deploy(
      feeRecipient,
      CONFIG.WETH_ADDRESS,
      CONFIG.EMARK_ADDRESS
    );
    await feeCollector.waitForDeployment();
    deployed.FeeCollector = await feeCollector.getAddress();
    console.log("   ✅ FeeCollector deployed to:", deployed.FeeCollector);
    
    // 2. Deploy WEMARK
    console.log("2. Deploying WEMARK...");
    const WEMARK = await ethers.getContractFactory("WEMARK");
    const wemark = await WEMARK.deploy(CONFIG.EMARK_ADDRESS);
    await wemark.waitForDeployment();
    deployed.WEMARK = await wemark.getAddress();
    console.log("   ✅ WEMARK deployed to:", deployed.WEMARK);
    
    // 3. Deploy EvermarkVoting
    console.log("3. Deploying EvermarkVoting...");
    const EvermarkVoting = await ethers.getContractFactory("EvermarkVoting");
    // Note: We need EvermarkNFT address, will deploy that first
    
    // ============================================
    // Phase 2: Deploy Upgradeable Contracts
    // ============================================
    
    console.log("\n📦 Phase 2: Deploying Upgradeable Contracts\n");
    
    // 4. Deploy EvermarkNFT (Upgradeable)
    console.log("4. Deploying EvermarkNFT (Upgradeable)...");
    const EvermarkNFT = await ethers.getContractFactory("EvermarkNFT");
    const evermarkNFT = await upgrades.deployProxy(
      EvermarkNFT,
      [],
      { 
        kind: 'uups',
        initializer: 'initialize'
      }
    );
    await evermarkNFT.waitForDeployment();
    deployed.EvermarkNFT = await evermarkNFT.getAddress();
    console.log("   ✅ EvermarkNFT proxy deployed to:", deployed.EvermarkNFT);
    
    // Configure EvermarkNFT
    console.log("   Configuring EvermarkNFT...");
    await evermarkNFT.setFeeCollector(deployed.FeeCollector);
    await evermarkNFT.setMintingFee(CONFIG.MINT_FEE);
    console.log("   ✅ EvermarkNFT configured");
    
    // Now deploy EvermarkVoting with NFT address
    const evermarkVoting = await EvermarkVoting.deploy(deployed.WEMARK, deployed.EvermarkNFT);
    await evermarkVoting.waitForDeployment();
    deployed.EvermarkVoting = await evermarkVoting.getAddress();
    console.log("   ✅ EvermarkVoting deployed to:", deployed.EvermarkVoting);
    
    // Start first voting season
    console.log("   Starting first voting season...");
    await evermarkVoting.startNewSeason();
    console.log("   ✅ First voting season started");
    
    // 5. Deploy NFTStaking (Upgradeable) - Simplified for creator verification
    console.log("5. Deploying NFTStaking (Upgradeable)...");
    const NFTStaking = await ethers.getContractFactory("NFTStaking");
    const nftStaking = await upgrades.deployProxy(
      NFTStaking,
      [deployed.EvermarkNFT], // Only needs NFT address, no EMARK needed
      { 
        kind: 'uups',
        initializer: 'initialize'
      }
    );
    await nftStaking.waitForDeployment();
    deployed.NFTStaking = await nftStaking.getAddress();
    console.log("   ✅ NFTStaking proxy deployed to:", deployed.NFTStaking);
    
    // 6. Deploy EvermarkRewards (Upgradeable)
    console.log("6. Deploying EvermarkRewards (Upgradeable)...");
    const EvermarkRewards = await ethers.getContractFactory("EvermarkRewards");
    const evermarkRewards = await upgrades.deployProxy(
      EvermarkRewards,
      [
        CONFIG.EMARK_ADDRESS,
        deployed.WEMARK, // stakingToken is WEMARK
        CONFIG.WETH_ADDRESS,
        CONFIG.WETH_DISTRIBUTION_RATE,
        CONFIG.EMARK_DISTRIBUTION_RATE,
        CONFIG.REBALANCE_PERIOD
      ],
      { 
        kind: 'uups',
        initializer: 'initialize'
      }
    );
    await evermarkRewards.waitForDeployment();
    deployed.EvermarkRewards = await evermarkRewards.getAddress();
    console.log("   ✅ EvermarkRewards proxy deployed to:", deployed.EvermarkRewards);
    
    // Configure FeeCollector with EvermarkRewards contract
    console.log("   Configuring FeeCollector...");
    await feeCollector.setRewardsContract(deployed.EvermarkRewards);
    
    // Grant DISTRIBUTOR_ROLE to FeeCollector in EvermarkRewards
    const DISTRIBUTOR_ROLE = await evermarkRewards.DISTRIBUTOR_ROLE();
    await evermarkRewards.grantRole(DISTRIBUTOR_ROLE, deployed.FeeCollector);
    console.log("   ✅ FeeCollector configured with EvermarkRewards integration");
    
    // ============================================
    // Phase 3: Optional Initial Funding
    // ============================================
    
    if (CONFIG.INITIAL_WETH_FUNDING > 0 || CONFIG.INITIAL_EMARK_FUNDING > 0) {
      console.log("\n📦 Phase 3: Initial Reward Pool Funding\n");
      
      if (CONFIG.INITIAL_WETH_FUNDING > 0) {
        console.log("Funding WETH rewards pool...");
        const weth = await ethers.getContractAt("IERC20", CONFIG.WETH_ADDRESS);
        await weth.approve(deployed.EvermarkRewards, CONFIG.INITIAL_WETH_FUNDING);
        await evermarkRewards.fundWethRewards(CONFIG.INITIAL_WETH_FUNDING);
        console.log(`   ✅ Funded with ${ethers.formatEther(CONFIG.INITIAL_WETH_FUNDING)} WETH`);
      }
      
      if (CONFIG.INITIAL_EMARK_FUNDING > 0) {
        console.log("Funding EMARK rewards pool...");
        const emark = await ethers.getContractAt("IERC20", CONFIG.EMARK_ADDRESS);
        await emark.approve(deployed.EvermarkRewards, CONFIG.INITIAL_EMARK_FUNDING);
        await evermarkRewards.fundEmarkRewards(CONFIG.INITIAL_EMARK_FUNDING);
        console.log(`   ✅ Funded with ${ethers.formatEther(CONFIG.INITIAL_EMARK_FUNDING)} EMARK`);
      }
    }
    
    // ============================================
    // Summary
    // ============================================
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(60));
    console.log("\n📋 Deployed Contract Addresses:\n");
    console.log(`EMARK Token (existing):     ${CONFIG.EMARK_ADDRESS}`);
    console.log(`WETH Token (Base):          ${CONFIG.WETH_ADDRESS}`);
    console.log(`FeeCollector:               ${deployed.FeeCollector}`);
    console.log(`WEMARK:                     ${deployed.WEMARK}`);
    console.log(`EvermarkNFT:                ${deployed.EvermarkNFT}`);
    console.log(`EvermarkVoting:             ${deployed.EvermarkVoting}`);
    console.log(`NFTStaking:                 ${deployed.NFTStaking}`);
    console.log(`EvermarkRewards:            ${deployed.EvermarkRewards}`);
    
    console.log("\n📝 Add these to your .env file:\n");
    console.log(`VITE_EMARK_TOKEN_ADDRESS=${CONFIG.EMARK_ADDRESS}`);
    console.log(`VITE_WEMARK_ADDRESS=${deployed.WEMARK}`);
    console.log(`VITE_EVERMARK_NFT_ADDRESS=${deployed.EvermarkNFT}`);
    console.log(`VITE_EVERMARK_VOTING_ADDRESS=${deployed.EvermarkVoting}`);
    console.log(`VITE_NFT_STAKING_ADDRESS=${deployed.NFTStaking}`);
    console.log(`VITE_EVERMARK_REWARDS_ADDRESS=${deployed.EvermarkRewards}`);
    console.log(`VITE_FEE_COLLECTOR_ADDRESS=${deployed.FeeCollector}`);
    
    console.log("\n⚠️  Next Steps:");
    console.log("1. Verify all contracts on Basescan");
    console.log("2. Update frontend environment variables");
    console.log("3. Test all contract interactions");
    console.log("4. Consider transferring ownership to multisig");
    console.log("5. Fund reward pools if not done initially");
    
    // Save deployment info to file
    const fs = require('fs');
    const deploymentInfo = {
      network: "base",
      chainId: 8453,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: {
        EMARK: CONFIG.EMARK_ADDRESS,
        WETH: CONFIG.WETH_ADDRESS,
        ...deployed
      },
      configuration: CONFIG
    };
    
    fs.writeFileSync(
      `./deployments/evermark-beta-${Date.now()}.json`,
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n📄 Deployment info saved to ./deployments/");
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    console.log("\n📋 Partially deployed addresses:", deployed);
    throw error;
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });