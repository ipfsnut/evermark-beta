// check-migration-status.js
// Dry-run script to check which tokens need URI migration
// Run with: node check-migration-status.js

const fetch = require('node-fetch');
const { ethers } = require('ethers');

// Configuration
const EVERMARK_NFT_ADDRESS = "0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2";
const RPC_URL = "https://8453.rpc.thirdweb.com/0b1d7a7c085408bf3cfe4ccccd24c08e";
const SUPABASE_API_URL = "https://evermarks.net/.netlify/functions/evermarks";
const MAX_TOKEN_ID = 37;

// Simple ERC721 ABI for tokenURI function
const ERC721_ABI = [
    "function tokenURI(uint256 tokenId) view returns (string)"
];

async function checkMigrationStatus() {
    console.log("🔍 Checking Token URI Migration Status");
    console.log("=====================================");
    
    // Setup provider and contract
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(EVERMARK_NFT_ADDRESS, ERC721_ABI, provider);
    
    const summary = {
        total: 0,
        migrated: 0,
        needsMigration: 0,
        errors: 0,
        details: []
    };
    
    for (let tokenId = 1; tokenId <= MAX_TOKEN_ID; tokenId++) {
        try {
            // Get on-chain URI
            const onChainURI = await contract.tokenURI(tokenId);
            
            // Get database URI
            const response = await fetch(`${SUPABASE_API_URL}?id=${tokenId}`);
            let dbURI = null;
            let title = 'Unknown';
            
            if (response.ok) {
                const data = await response.json();
                dbURI = data.evermark?.token_uri;
                title = data.evermark?.title || 'Unknown';
            }
            
            const status = {
                tokenId,
                title: title.substring(0, 40) + (title.length > 40 ? '...' : ''),
                onChainURI,
                dbURI,
                needsMigration: false,
                status: ''
            };
            
            if (onChainURI.startsWith('ar://')) {
                status.status = '✅ Already ArDrive';
                summary.migrated++;
            } else if (onChainURI.startsWith('ipfs://')) {
                if (dbURI && dbURI.startsWith('ar://')) {
                    status.status = '🔄 Needs Migration';
                    status.needsMigration = true;
                    summary.needsMigration++;
                } else {
                    status.status = '⚠️  No ArDrive URI in DB';
                    summary.errors++;
                }
            } else {
                status.status = '❓ Unknown format';
                summary.errors++;
            }
            
            summary.total++;
            summary.details.push(status);
            
            console.log(`Token #${tokenId.toString().padStart(2)}: ${status.status} - "${status.title}"`);
            
        } catch (error) {
            if (error.message.includes('nonexistent token')) {
                console.log(`Token #${tokenId}: Does not exist - stopping scan`);
                break;
            } else {
                console.log(`Token #${tokenId}: Error - ${error.message}`);
                summary.errors++;
            }
        }
    }
    
    console.log("\n📊 Migration Status Summary");
    console.log("===========================");
    console.log(`Total tokens found: ${summary.total}`);
    console.log(`✅ Already migrated: ${summary.migrated}`);
    console.log(`🔄 Need migration: ${summary.needsMigration}`);
    console.log(`❌ Errors/Unknown: ${summary.errors}`);
    
    if (summary.needsMigration > 0) {
        console.log("\n🔄 Tokens requiring migration:");
        summary.details
            .filter(token => token.needsMigration)
            .forEach(token => {
                console.log(`  #${token.tokenId}: "${token.title}"`);
                console.log(`    From: ${token.onChainURI}`);
                console.log(`    To:   ${token.dbURI}`);
            });
            
        console.log(`\n💡 Run 'npx hardhat run migrate-token-uris.js --network base' to execute migrations`);
        console.log(`⚠️  Estimated cost: ~${(summary.needsMigration * 0.001).toFixed(3)} ETH`);
    } else {
        console.log("\n🎉 All tokens are already migrated!");
    }
    
    return summary;
}

// Run if called directly
if (require.main === module) {
    checkMigrationStatus()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("Error:", error);
            process.exit(1);
        });
}

module.exports = { checkMigrationStatus };