const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment...");

  // Get contract addresses from environment
  const EMARK_TOKEN = process.env.EMARK_ADDRESS;
  const CARD_CATALOG = process.env.CARD_CATALOG_ADDRESS;
  const WETH_TOKEN = "0x4200000000000000000000000000000000000006"; // Base WETH

  if (!EMARK_TOKEN || !CARD_CATALOG) {
    throw new Error("Missing required environment variables: EMARK_ADDRESS, CARD_CATALOG_ADDRESS");
  }

  console.log("📋 Deployment config:");
  console.log("  EMARK Token:", EMARK_TOKEN);
  console.log("  Card Catalog:", CARD_CATALOG);
  console.log("  WETH Token:", WETH_TOKEN);

  // Deploy EvermarkRewards as upgradeable proxy
  console.log("\n📦 Deploying EvermarkRewards...");
  const EvermarkRewards = await ethers.getContractFactory("EvermarkRewards");
  
  const rewardsContract = await upgrades.deployProxy(
    EvermarkRewards,
    [
      EMARK_TOKEN,        // _emarkToken
      CARD_CATALOG,       // _stakingToken  
      WETH_TOKEN,         // _wethToken
      1000,               // _wethDistributionRate (10% annually)
      2000,               // _emarkDistributionRate (20% annually)
      604800              // _rebalancePeriod (7 days)
    ],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await rewardsContract.waitForDeployment();
  const proxyAddress = await rewardsContract.getAddress();
  
  console.log("✅ EvermarkRewards deployed:");
  console.log("  Proxy:", proxyAddress);
  
  // Get implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("  Implementation:", implementationAddress);

  // Verify contracts
  console.log("\n🔍 Verifying contracts...");
  try {
    // Verify implementation
    await hre.run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
    });
    console.log("✅ Implementation verified");

    // Verify proxy (this might fail, that's ok)
    try {
      await hre.run("verify:verify", {
        address: proxyAddress,
        constructorArguments: [implementationAddress, "0x"],
      });
      console.log("✅ Proxy verified");
    } catch (e) {
      console.log("⚠️  Proxy verification failed (this is normal):", e.message);
    }
  } catch (error) {
    console.log("❌ Verification failed:", error.message);
    console.log("You can verify manually later with:");
    console.log(`npx hardhat verify --network base ${implementationAddress}`);
  }

  console.log("\n🎉 Deployment complete!");
  console.log("\n📋 Contract addresses to update in .env.local:");
  console.log(`VITE_EVERMARK_REWARDS_ADDRESS=${proxyAddress}`);
  console.log(`EVERMARK_REWARDS_ADDRESS=${proxyAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });