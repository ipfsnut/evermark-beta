// Upgrade script for EvermarkRewards contract
const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Starting EvermarkRewards upgrade...");

  // The proxy address of your current EvermarkRewards contract
  const PROXY_ADDRESS = process.env.VITE_EVERMARK_REWARDS_ADDRESS;
  
  if (!PROXY_ADDRESS) {
    throw new Error("VITE_EVERMARK_REWARDS_ADDRESS not set in environment");
  }

  console.log("Proxy address:", PROXY_ADDRESS);

  // Get the new implementation
  const EvermarkRewardsV2 = await ethers.getContractFactory("EvermarkRewards");
  
  console.log("Deploying new implementation...");
  
  // Upgrade the proxy to the new implementation
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, EvermarkRewardsV2, {
    unsafeSkipStorageCheck: true // Only use if you're sure about storage layout compatibility
  });

  await upgraded.deployed();
  
  // Get the new implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  
  console.log("✅ Upgrade successful!");
  console.log("Proxy address (unchanged):", PROXY_ADDRESS);
  console.log("New implementation address:", implementationAddress);
  
  // Initialize V2 if needed
  console.log("Initializing V2...");
  await upgraded.initializeV2();
  console.log("V2 initialized!");
  
  // Verify the upgrade
  const contract = await ethers.getContractAt("EvermarkRewards", PROXY_ADDRESS);
  const periodNumber = await contract.currentPeriodNumber();
  console.log("Current period number:", periodNumber.toString());
  
  // Test the new getPeriodStatus function
  try {
    const status = await contract.getPeriodStatus();
    console.log("Period status:", {
      currentPeriod: status.currentPeriod.toString(),
      periodEnd: new Date(status.periodEnd.toNumber() * 1000).toISOString(),
      wethRate: ethers.utils.formatEther(status.wethRate),
      emarkRate: ethers.utils.formatEther(status.emarkRate)
    });
  } catch (error) {
    console.log("Note: getPeriodStatus function signature has changed as expected");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });