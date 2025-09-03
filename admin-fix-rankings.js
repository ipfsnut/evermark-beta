// Quick fix script for the ranking corruption
// Run this once to fix the current database state

console.log('Current rankings issue:');
console.log('- Rank 2: ID 2 "Alpha Retirement" - 11,000,000,000,000,000,000,000 votes');
console.log('- Rank 2: ID 17 "Cast by m00npapi.eth" - 1,002,000,000,000,000,000,000,000 votes');
console.log('');
console.log('SHOULD BE:');
console.log('- Rank 2: ID 17 "Cast by m00npapi.eth" - 1,002,000,000,000,000,000,000,000 votes');
console.log('- Rank 3: ID 2 "Alpha Retirement" - 11,000,000,000,000,000,000,000 votes');
console.log('');
console.log('The fix in update-voting-data.ts will prevent this in future, but current data is corrupted.');
console.log('Need to either:');
console.log('1. Deploy the fix and wait for next vote to auto-correct');
console.log('2. Create a one-time admin function to fix current state');
console.log('3. Manually update the database');