const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🔄 Starting contract upgrade...");

  const PROXY_ADDRESS = process.env.EVERMARK_REWARDS_ADDRESS;
  
  if (!PROXY_ADDRESS) {
    throw new Error("Missing EVERMARK_REWARDS_ADDRESS in environment");
  }

  console.log("📋 Upgrade config:");
  console.log("  Existing Proxy:", PROXY_ADDRESS);

  // Deploy new implementation
  console.log("\n📦 Deploying new implementation...");
  const EvermarkRewardsV2 = await ethers.getContractFactory("EvermarkRewards");
  
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, EvermarkRewardsV2);
  await upgraded.waitForDeployment();

  console.log("✅ Contract upgraded!");
  console.log("  Proxy (unchanged):", PROXY_ADDRESS);
  
  // Get new implementation address
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("  New Implementation:", newImplementationAddress);

  // Verify new implementation
  console.log("\n🔍 Verifying new implementation...");
  try {
    await hre.run("verify:verify", {
      address: newImplementationAddress,
      constructorArguments: [],
    });
    console.log("✅ New implementation verified");
  } catch (error) {
    console.log("❌ Verification failed:", error.message);
    console.log("You can verify manually later with:");
    console.log(`npx hardhat verify --network base ${newImplementationAddress}`);
  }

  console.log("\n🎉 Upgrade complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });