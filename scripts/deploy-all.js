const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 Starting full Evermark ecosystem deployment...\n");

  // Get existing addresses from environment
  const EMARK_TOKEN = process.env.EMARK_ADDRESS;
  const WETH_TOKEN = "0x4200000000000000000000000000000000000006"; // Base WETH
  const FEE_RECIPIENT = "0x123456789..."; // UPDATE THIS TO YOUR FEE RECIPIENT ADDRESS

  if (!EMARK_TOKEN) {
    throw new Error("Missing EMARK_ADDRESS in environment");
  }

  const [deployer] = await ethers.getSigners();
  console.log("📋 Deploying from:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const deployedContracts = {};

  try {
    // PHASE 1: Core Infrastructure
    console.log("🏗️  PHASE 1: Core Infrastructure\n");

    // 1. Deploy FeeCollector
    console.log("1️⃣  Deploying FeeCollector...");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = await FeeCollector.deploy(FEE_RECIPIENT);
    await feeCollector.waitForDeployment();
    deployedContracts.feeCollector = await feeCollector.getAddress();
    console.log("✅ FeeCollector deployed:", deployedContracts.feeCollector);

    // 2. Deploy WEMARK  
    console.log("\n2️⃣  Deploying WEMARK...");
    const WEMARK = await ethers.getContractFactory("WEMARK");
    const wemark = await WEMARK.deploy(EMARK_TOKEN);
    await wemark.waitForDeployment();
    deployedContracts.wemark = await wemark.getAddress();
    console.log("✅ WEMARK deployed:", deployedContracts.wemark);

    // PHASE 2: Main Contracts
    console.log("\n🏗️  PHASE 2: Main Contracts\n");

    // 3. Deploy EvermarkNFT (upgradeable)
    console.log("3️⃣  Deploying EvermarkNFT...");
    const EvermarkNFT = await ethers.getContractFactory("EvermarkNFT");
    const evermarkNFT = await upgrades.deployProxy(
      EvermarkNFT,
      [deployedContracts.feeCollector],
      { initializer: "initialize", kind: "uups" }
    );
    await evermarkNFT.waitForDeployment();
    deployedContracts.evermarkNFT = await evermarkNFT.getAddress();
    console.log("✅ EvermarkNFT deployed:", deployedContracts.evermarkNFT);

    // 4. Deploy EvermarkVoting
    console.log("\n4️⃣  Deploying EvermarkVoting...");
    const EvermarkVoting = await ethers.getContractFactory("EvermarkVoting");
    const evermarkVoting = await EvermarkVoting.deploy(
      deployedContracts.wemark,
      deployedContracts.evermarkNFT
    );
    await evermarkVoting.waitForDeployment();
    deployedContracts.evermarkVoting = await evermarkVoting.getAddress();
    console.log("✅ EvermarkVoting deployed:", deployedContracts.evermarkVoting);

    // 5. Deploy NFTStaking (upgradeable)  
    console.log("\n5️⃣  Deploying NFTStaking...");
    const NFTStaking = await ethers.getContractFactory("NFTStaking");
    const nftStaking = await upgrades.deployProxy(
      NFTStaking,
      [
        deployedContracts.evermarkNFT,
        deployedContracts.evermarkVoting,
        EMARK_TOKEN
      ],
      { initializer: "initialize", kind: "uups" }
    );
    await nftStaking.waitForDeployment();
    deployedContracts.nftStaking = await nftStaking.getAddress();
    console.log("✅ NFTStaking deployed:", deployedContracts.nftStaking);

    // 6. Deploy EvermarkRewards (upgradeable) - with emergencyWithdraw function
    console.log("\n6️⃣  Deploying EvermarkRewards...");
    const EvermarkRewards = await ethers.getContractFactory("EvermarkRewards");
    const evermarkRewards = await upgrades.deployProxy(
      EvermarkRewards,
      [
        EMARK_TOKEN,                    // _emarkToken
        deployedContracts.nftStaking,   // _stakingToken (NFTStaking contract)  
        WETH_TOKEN,                     // _wethToken
        1000,                           // _wethDistributionRate (10% annually)
        2000,                           // _emarkDistributionRate (20% annually)
        604800                          // _rebalancePeriod (7 days)
      ],
      { initializer: "initialize", kind: "uups" }
    );
    await evermarkRewards.waitForDeployment();
    deployedContracts.evermarkRewards = await evermarkRewards.getAddress();
    console.log("✅ EvermarkRewards deployed:", deployedContracts.evermarkRewards);

    // PHASE 3: Verification
    console.log("\n🔍 PHASE 3: Contract Verification\n");
    
    const contractsToVerify = [
      { name: "FeeCollector", address: deployedContracts.feeCollector, args: [FEE_RECIPIENT] },
      { name: "WEMARK", address: deployedContracts.wemark, args: [EMARK_TOKEN] },
      { name: "EvermarkVoting", address: deployedContracts.evermarkVoting, args: [deployedContracts.wemark, deployedContracts.evermarkNFT] }
    ];

    for (const contract of contractsToVerify) {
      try {
        console.log(`Verifying ${contract.name}...`);
        await hre.run("verify:verify", {
          address: contract.address,
          constructorArguments: contract.args,
        });
        console.log(`✅ ${contract.name} verified`);
      } catch (error) {
        console.log(`⚠️  ${contract.name} verification failed:`, error.message);
      }
    }

    // Verify upgradeable implementations
    const upgradeableContracts = [
      { name: "EvermarkNFT", proxy: deployedContracts.evermarkNFT },
      { name: "NFTStaking", proxy: deployedContracts.nftStaking },
      { name: "EvermarkRewards", proxy: deployedContracts.evermarkRewards }
    ];

    for (const contract of upgradeableContracts) {
      try {
        const implAddress = await upgrades.erc1967.getImplementationAddress(contract.proxy);
        console.log(`Verifying ${contract.name} implementation...`);
        await hre.run("verify:verify", {
          address: implAddress,
          constructorArguments: [],
        });
        console.log(`✅ ${contract.name} implementation verified`);
      } catch (error) {
        console.log(`⚠️  ${contract.name} implementation verification failed:`, error.message);
      }
    }

    // PHASE 4: Summary
    console.log("\n🎉 DEPLOYMENT COMPLETE!\n");
    console.log("📋 Update your .env.local with these addresses:");
    console.log(`VITE_FEE_COLLECTOR_ADDRESS=${deployedContracts.feeCollector}`);
    console.log(`FEE_COLLECTOR_ADDRESS=${deployedContracts.feeCollector}`);
    console.log(`VITE_CARD_CATALOG_ADDRESS=${deployedContracts.nftStaking}`);
    console.log(`CARD_CATALOG_ADDRESS=${deployedContracts.nftStaking}`);
    console.log(`VITE_EVERMARK_NFT_ADDRESS=${deployedContracts.evermarkNFT}`);
    console.log(`EVERMARK_NFT_ADDRESS=${deployedContracts.evermarkNFT}`);
    console.log(`VITE_EVERMARK_VOTING_ADDRESS=${deployedContracts.evermarkVoting}`);
    console.log(`EVERMARK_VOTING_ADDRESS=${deployedContracts.evermarkVoting}`);
    console.log(`VITE_NFT_STAKING_ADDRESS=${deployedContracts.nftStaking}`);
    console.log(`NFT_STAKING_ADDRESS=${deployedContracts.nftStaking}`);
    console.log(`VITE_EVERMARK_REWARDS_ADDRESS=${deployedContracts.evermarkRewards}`);
    console.log(`EVERMARK_REWARDS_ADDRESS=${deployedContracts.evermarkRewards}`);

    console.log("\n💡 WEMARK token for staking:", deployedContracts.wemark);

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    
    if (Object.keys(deployedContracts).length > 0) {
      console.log("\n📋 Partially deployed contracts:");
      for (const [name, address] of Object.entries(deployedContracts)) {
        console.log(`${name}: ${address}`);
      }
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });