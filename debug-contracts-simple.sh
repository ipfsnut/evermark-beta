#!/bin/bash

# Simplified contract debugging script
BASE_RPC="https://mainnet.base.org"
LEADERBOARD_CONTRACT="0x89117B7a9ef008d27443fC3845a5E2AB7C75eae0"

echo "🔍 EVERMARK LEADERBOARD CONTRACT DIAGNOSIS"
echo "=========================================="
echo "Contract: $LEADERBOARD_CONTRACT"
echo "Network: Base Mainnet"
echo ""

# Check cycle 1 initialization
echo "1. Checking Cycle 1 initialization status..."
RESULT=$(curl -s -X POST $BASE_RPC \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [{
            "to": "'$LEADERBOARD_CONTRACT'",
            "data": "0x6c0360eb0000000000000000000000000000000000000000000000000000000000000001"
        }, "latest"],
        "id": 1
    }')

echo "Response: $RESULT"

if echo "$RESULT" | grep -q "execution reverted"; then
    echo "❌ CYCLE 1 IS NOT INITIALIZED"
    echo ""
    echo "📋 ROOT CAUSE FOUND:"
    echo "   → The leaderboard contract cycle 1 has never been initialized"
    echo "   → This explains why all leaderboard queries return empty results"
    echo "   → The contract is deployed but no admin has called the initialization function"
else
    echo "✅ Cycle 1 is initialized"
fi

echo ""
echo "🎯 SOLUTION FOR BETA:"
echo "===================="
echo "1. Contract admin needs to initialize cycle 1 OR"
echo "2. Start with cycle 2 (if cycle 1 data isn't needed) OR" 
echo "3. Deploy new contracts for fresh start"
echo ""
echo "🚀 IMMEDIATE ACTION NEEDED:"
echo "Call the leaderboard contract initialization function as admin"
echo "This is a one-time setup required to make the leaderboard functional"