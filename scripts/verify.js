const { upgrades } = require("hardhat");

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("Usage: npx hardhat run scripts/verify.js --network base -- <address>");
    console.log("Example: npx hardhat run scripts/verify.js --network base -- 0x123...");
    process.exit(1);
  }

  const address = args[0];
  console.log(`🔍 Verifying contract at ${address}...`);

  try {
    // First try as implementation
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("✅ Contract verified as implementation");
  } catch (error) {
    console.log("Implementation verification failed:", error.message);
    
    // Try as proxy
    try {
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(address);
      console.log(`Found proxy with implementation: ${implementationAddress}`);
      
      await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [],
      });
      console.log("✅ Proxy implementation verified");
    } catch (proxyError) {
      console.log("❌ Both verification attempts failed");
      console.log("Implementation error:", error.message);
      console.log("Proxy error:", proxyError.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });