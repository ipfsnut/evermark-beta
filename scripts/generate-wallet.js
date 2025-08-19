const { ethers } = require("ethers");

function generateWallet() {
  const wallet = ethers.Wallet.createRandom();
  
  console.log("🎉 New Wallet Generated:");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("Mnemonic:", wallet.mnemonic.phrase);
  
  console.log("\n💡 Add to .env.local:");
  console.log(`PRIVATE_KEY=${wallet.privateKey}`);
  
  console.log("\n💰 Fund this wallet with Base ETH for deployments");
  console.log("Bridge ETH to Base: https://bridge.base.org");
}

generateWallet();