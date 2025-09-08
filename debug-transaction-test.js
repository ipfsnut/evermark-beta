// Test transaction-related issues
import { EvermarkBlockchainService } from './src/features/evermarks/services/BlockchainService.js';

async function testTransactionIssues() {
  console.log('🔍 Testing transaction issues...');
  
  // Test 1: RPC Connection
  try {
    const canAfford = await EvermarkBlockchainService.canAffordMint(
      '0x1234567890123456789012345678901234567890'
    );
    console.log('✅ RPC connection working');
  } catch (error) {
    console.log('❌ RPC connection issue:', error.message);
    if (error.message.includes('rpcRequest is not a function')) {
      console.log('🚨 CONFIRMED: RPC request function not available');
    }
  }
  
  // Test 2: Minting fee
  try {
    const fee = await EvermarkBlockchainService.getMintingFee();
    console.log('✅ Minting fee retrieved:', fee);
  } catch (error) {
    console.log('❌ Minting fee issue:', error.message);
  }
}

testTransactionIssues();