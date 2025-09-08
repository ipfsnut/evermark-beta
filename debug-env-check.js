// Check environment variables that could cause transaction issues

console.log('🔍 Environment Variable Check:');
console.log('================================');

const requiredEnvVars = [
  'VITE_THIRDWEB_CLIENT_ID',
  'VITE_CHAIN_ID', 
  'VITE_EMARK_TOKEN_ADDRESS',
  'VITE_EVERMARK_NFT_ADDRESS',
  'VITE_PINATA_JWT'
];

const missingVars = [];
const presentVars = [];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value === 'undefined' || value === 'your_client_id_here') {
    missingVars.push(varName);
    console.log(`❌ ${varName}: MISSING OR INVALID`);
  } else {
    presentVars.push(varName);
    // Show first few characters for security
    console.log(`✅ ${varName}: ${value.substring(0, 6)}...`);
  }
});

console.log('\n📋 Summary:');
console.log(`✅ Present: ${presentVars.length}/${requiredEnvVars.length}`);
console.log(`❌ Missing: ${missingVars.length}/${requiredEnvVars.length}`);

if (missingVars.length > 0) {
  console.log('\n🚨 CRITICAL ISSUES:');
  missingVars.forEach(varName => {
    console.log(`- ${varName} is missing or invalid`);
    
    if (varName === 'VITE_THIRDWEB_CLIENT_ID') {
      console.log('  → This will break ALL blockchain transactions');
    }
    if (varName === 'VITE_PINATA_JWT') {
      console.log('  → This will break image/metadata uploads');
    }
  });
}

// Test Thirdweb RPC URL construction
if (process.env.VITE_THIRDWEB_CLIENT_ID) {
  const rpcUrl = `https://8453.rpc.thirdweb.com/${process.env.VITE_THIRDWEB_CLIENT_ID}`;
  console.log('\n🔗 Constructed RPC URL:', rpcUrl);
} else {
  console.log('\n❌ Cannot construct RPC URL - missing client ID');
}