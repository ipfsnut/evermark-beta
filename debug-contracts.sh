#!/bin/bash

# Script to debug Evermark contracts on Base network using public RPC
# This will help us understand the current state of cycle 1 data

BASE_RPC="https://mainnet.base.org"
VOTING_CONTRACT="0x174cEA217d2331880E6c1ccA9DD9a5F59A28178D"
LEADERBOARD_CONTRACT="0x89117B7a9ef008d27443fC3845a5E2AB7C75eae0"
EMARK_TOKEN="0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07"

echo "🔍 Debugging Evermark contracts on Base..."
echo "=================================================="

# Function to make eth_call requests
eth_call() {
    local to=$1
    local data=$2
    local description=$3
    
    echo -e "\n📊 $description"
    echo "Contract: $to"
    echo "Data: $data"
    
    curl -s -X POST $BASE_RPC \
        -H "Content-Type: application/json" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"method\": \"eth_call\",
            \"params\": [{
                \"to\": \"$to\",
                \"data\": \"$data\"
            }, \"latest\"],
            \"id\": 1
        }" | jq -r '.result // .error'
}

# Function to convert hex to decimal
hex_to_dec() {
    echo $((16#${1#0x}))
}

echo -e "\n🎯 LEADERBOARD CONTRACT ANALYSIS"
echo "=================================="

# Check cycle 1 initialization status
# cycleInitialized(uint256) - function selector: 0x6c0360eb
echo -e "\n1. Checking if Cycle 1 is initialized..."
CYCLE_1_INIT=$(eth_call $LEADERBOARD_CONTRACT "0x6c0360eb0000000000000000000000000000000000000000000000000000000000000001" "Cycle 1 Initialized Status")
if [[ "$CYCLE_1_INIT" == "0x0000000000000000000000000000000000000000000000000000000000000001" ]]; then
    echo "✅ Cycle 1 IS initialized"
else
    echo "❌ Cycle 1 is NOT initialized"
fi

# Get cycle 1 stats
# getCycleStats(uint256) - function selector: 0x4b0ca4e2
echo -e "\n2. Getting Cycle 1 statistics..."
CYCLE_1_STATS=$(eth_call $LEADERBOARD_CONTRACT "0x4b0ca4e20000000000000000000000000000000000000000000000000000000000000001" "Cycle 1 Statistics")
echo "Raw stats: $CYCLE_1_STATS"

if [[ ${#CYCLE_1_STATS} -gt 10 ]]; then
    # Parse the stats (4 values: totalUpdates, leaderboardSize, lastUpdate, initialized)
    TOTAL_UPDATES_HEX="0x${CYCLE_1_STATS:2:64}"
    LEADERBOARD_SIZE_HEX="0x${CYCLE_1_STATS:66:64}"
    LAST_UPDATE_HEX="0x${CYCLE_1_STATS:130:64}"
    INITIALIZED_HEX="0x${CYCLE_1_STATS:194:64}"
    
    echo "   Total Updates: $(hex_to_dec $TOTAL_UPDATES_HEX)"
    echo "   Leaderboard Size: $(hex_to_dec $LEADERBOARD_SIZE_HEX)"
    echo "   Last Update: $(hex_to_dec $LAST_UPDATE_HEX)"
    echo "   Initialized: $(hex_to_dec $INITIALIZED_HEX)"
fi

# Try to get leaderboard data for cycle 1 (top 5 entries)
# getLeaderboard(uint256 cycle, uint256 startRank, uint256 count) - function selector: 0x5f4f9fbb
echo -e "\n3. Getting top 5 leaderboard entries for Cycle 1..."
LEADERBOARD_DATA=$(eth_call $LEADERBOARD_CONTRACT "0x5f4f9fbb000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000005" "Cycle 1 Top 5 Leaderboard")
echo "Raw leaderboard data: $LEADERBOARD_DATA"

# Check leaderboard size for cycle 1
# getLeaderboardSize(uint256) - function selector: 0x38c90e2d  
echo -e "\n4. Getting leaderboard size for Cycle 1..."
LEADERBOARD_SIZE=$(eth_call $LEADERBOARD_CONTRACT "0x38c90e2d0000000000000000000000000000000000000000000000000000000000000001" "Cycle 1 Leaderboard Size")
echo "Leaderboard size: $(hex_to_dec $LEADERBOARD_SIZE)"

echo -e "\n🗳️ VOTING CONTRACT ANALYSIS"
echo "============================"

# Check if voting contract has a getCurrentCycle function
# getCurrentCycle() - function selector: 0x4b0f55c6
echo -e "\n5. Getting current cycle from voting contract..."
CURRENT_CYCLE=$(eth_call $VOTING_CONTRACT "0x4b0f55c6" "Current Voting Cycle")
if [[ ${#CURRENT_CYCLE} -gt 10 ]]; then
    echo "Current cycle: $(hex_to_dec $CURRENT_CYCLE)"
else
    echo "⚠️  Could not get current cycle (function may not exist)"
fi

# Try to get votes for some sample evermarks in cycle 1
echo -e "\n6. Checking votes for sample evermarks in Cycle 1..."
for EVERMARK_ID in 1 2 3 4 5; do
    # getEvermarkVotesInCycle(uint256 cycle, uint256 evermarkId) - function selector: 0x8f8b7a40
    EVERMARK_ID_HEX=$(printf "%064x" $EVERMARK_ID)
    VOTES_DATA=$(eth_call $VOTING_CONTRACT "0x8f8b7a400000000000000000000000000000000000000000000000000000000000000001${EVERMARK_ID_HEX}" "Votes for Evermark $EVERMARK_ID in Cycle 1")
    
    if [[ ${#VOTES_DATA} -gt 10 ]]; then
        VOTES_DEC=$(hex_to_dec $VOTES_DATA)
        if [[ $VOTES_DEC -gt 0 ]]; then
            echo "   Evermark #$EVERMARK_ID: $VOTES_DEC votes"
        else
            echo "   Evermark #$EVERMARK_ID: 0 votes"
        fi
    else
        echo "   Evermark #$EVERMARK_ID: No data"
    fi
done

echo -e "\n💰 EMARK TOKEN ANALYSIS"
echo "======================="

# Check total supply
# totalSupply() - function selector: 0x18160ddd
echo -e "\n7. Getting EMARK token total supply..."
TOTAL_SUPPLY=$(eth_call $EMARK_TOKEN "0x18160ddd" "EMARK Total Supply")
if [[ ${#TOTAL_SUPPLY} -gt 10 ]]; then
    # Convert from wei (18 decimals) to EMARK
    SUPPLY_DEC=$(hex_to_dec $TOTAL_SUPPLY)
    SUPPLY_EMARK=$(echo "scale=2; $SUPPLY_DEC / 1000000000000000000" | bc -l)
    echo "Total EMARK supply: $SUPPLY_EMARK EMARK ($SUPPLY_DEC wei)"
fi

echo -e "\n🔍 SUMMARY AND RECOMMENDATIONS"
echo "=============================="

# Analyze the results
if [[ "$CYCLE_1_INIT" == "0x0000000000000000000000000000000000000000000000000000000000000001" ]]; then
    echo "✅ Cycle 1 is properly initialized"
else
    echo "❌ Issue: Cycle 1 is not initialized - this needs admin action"
fi

if [[ $(hex_to_dec $LEADERBOARD_SIZE) -gt 0 ]]; then
    echo "✅ Leaderboard has $(hex_to_dec $LEADERBOARD_SIZE) entries"
else
    echo "❌ Issue: Leaderboard is empty - no entries found"
fi

echo -e "\n💡 Next steps based on findings:"
echo "1. If cycle is initialized but empty: Check if voting data needs to be synced"
echo "2. If cycle is not initialized: Admin needs to initialize the cycle"
echo "3. If no votes exist: Users need to stake and vote on evermarks"
echo "4. Check if leaderboard update functions need to be called"

echo -e "\n🚀 Contract addresses for reference:"
echo "Voting: $VOTING_CONTRACT"
echo "Leaderboard: $LEADERBOARD_CONTRACT" 
echo "EMARK Token: $EMARK_TOKEN"
echo "Base RPC: $BASE_RPC"