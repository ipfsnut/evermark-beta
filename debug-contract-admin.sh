#!/bin/bash

# Deep diagnostic script to understand admin configuration
BASE_RPC="https://mainnet.base.org"
LEADERBOARD_CONTRACT="0x89117B7a9ef008d27443fC3845a5E2AB7C75eae0"
ADMIN_WALLET="0x18A85ad341b2D6A2bd67fbb104B4827B922a2A3c"  # Your current wallet address

echo "🔍 DEEP ADMIN DIAGNOSTIC"
echo "======================="
echo "Contract: $LEADERBOARD_CONTRACT"
echo "Checking wallet: $ADMIN_WALLET"
echo ""

# Function to make eth_call requests
eth_call() {
    local to=$1
    local data=$2
    local description=$3
    
    echo -e "\n📊 $description"
    
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

# Get DEFAULT_ADMIN_ROLE constant (should be 0x00...)
echo "1. Getting DEFAULT_ADMIN_ROLE constant..."
DEFAULT_ADMIN_ROLE=$(eth_call $LEADERBOARD_CONTRACT "0xa217fddf" "DEFAULT_ADMIN_ROLE")
echo "DEFAULT_ADMIN_ROLE: $DEFAULT_ADMIN_ROLE"

# Get ADMIN_ROLE constant 
echo -e "\n2. Getting ADMIN_ROLE constant..."
ADMIN_ROLE=$(eth_call $LEADERBOARD_CONTRACT "0x75b238fc" "ADMIN_ROLE")
echo "ADMIN_ROLE: $ADMIN_ROLE"

# Get LEADERBOARD_MANAGER_ROLE constant
echo -e "\n3. Getting LEADERBOARD_MANAGER_ROLE constant..."
MANAGER_ROLE=$(eth_call $LEADERBOARD_CONTRACT "0x8da5cb5b" "LEADERBOARD_MANAGER_ROLE")
echo "MANAGER_ROLE: $MANAGER_ROLE"

# Check if the admin wallet has DEFAULT_ADMIN_ROLE
echo -e "\n4. Checking if wallet has DEFAULT_ADMIN_ROLE..."
# hasRole(bytes32,address) = 0x91d14854
WALLET_PADDED=$(echo $ADMIN_WALLET | sed 's/0x/000000000000000000000000/')
DEFAULT_ADMIN_CHECK=$(eth_call $LEADERBOARD_CONTRACT "0x91d14854${DEFAULT_ADMIN_ROLE:2}${WALLET_PADDED}" "Has DEFAULT_ADMIN_ROLE")
echo "Has DEFAULT_ADMIN_ROLE: $DEFAULT_ADMIN_CHECK"

# Check contract deployment transaction to see who deployed it
echo -e "\n5. Checking contract creation..."
CONTRACT_INFO=$(curl -s "https://api.basescan.org/api?module=contract&action=getcontractcreation&contractaddresses=$LEADERBOARD_CONTRACT&apikey=YourApiKeyToken")
echo "Contract creation info:"
echo "$CONTRACT_INFO" | jq -r '.result[0].contractCreator // "No creator found"'

# Try to get the owner/deployer using common owner functions
echo -e "\n6. Trying to find contract owner..."

# Try owner() function - 0x8da5cb5b
OWNER_RESULT=$(eth_call $LEADERBOARD_CONTRACT "0x8da5cb5b" "owner()")
echo "owner() result: $OWNER_RESULT"

# Try admin() function - 0xf851a440  
ADMIN_RESULT=$(eth_call $LEADERBOARD_CONTRACT "0xf851a440" "admin()")
echo "admin() result: $ADMIN_RESULT"

# Check if contract was properly initialized
echo -e "\n7. Checking contract initialization..."

# Try to call a view function that should work
UPGRADE_VERSION=$(eth_call $LEADERBOARD_CONTRACT "0xad3cb1cc" "UPGRADE_INTERFACE_VERSION")
echo "Contract responds to calls: $UPGRADE_VERSION"

echo -e "\n🎯 DIAGNOSTIC SUMMARY"
echo "===================="

if [[ "$DEFAULT_ADMIN_CHECK" == "0x0000000000000000000000000000000000000000000000000000000000000001" ]]; then
    echo "✅ Wallet HAS DEFAULT_ADMIN_ROLE"
else
    echo "❌ Wallet does NOT have DEFAULT_ADMIN_ROLE"
    echo "   This means either:"
    echo "   1. The contract was deployed by a different wallet"
    echo "   2. The contract wasn't properly initialized"
    echo "   3. Admin roles were assigned to a different address"
fi

echo -e "\n💡 NEXT STEPS:"
echo "1. Check who actually deployed the contract"
echo "2. Verify the contract was properly initialized after deployment" 
echo "3. If you're the deployer, you may need to initialize the contract properly"
echo "4. If someone else deployed it, they need to grant you admin roles"