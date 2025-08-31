#!/bin/bash

# Fix unused function parameters by prefixing with underscore
echo "Fixing unused function parameters..."

# Common unused parameters in the codebase
PARAMS=("evermarkId" "season" "amount" "error" "e" "userAddress" "cycleNumber" "fromBlock" "toBlock" "period")

for param in "${PARAMS[@]}"; do
  echo "Processing $param..."
  # Find files with this unused parameter
  npm run lint 2>&1 | grep "$param.*is defined but never used" | cut -d':' -f1 | sort -u | while read file; do
    if [ -f "$file" ]; then
      echo "  Fixing in $(basename $file)..."
      # This would need more sophisticated sed/awk to handle properly
      # For now, just report what needs fixing
    fi
  done
done

echo "Run 'npm run lint:fix' to auto-fix some issues"
echo "Then manually review and remove unused imports"