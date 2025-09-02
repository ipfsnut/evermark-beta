# Issue 001: TypeScript Errors in Netlify Functions

## Issue Summary
Multiple Netlify Functions have TypeScript compilation errors, primarily related to:
1. Type mismatches with Thirdweb v5 SDK event handling
2. Incorrect type assignments to Supabase query results
3. Missing type definitions for database operations

## Affected Files
- `netlify/functions/populate-historical-votes.ts`
- `netlify/functions/populate-season3-data.ts`
- `netlify/functions/sync-season3-totals.ts`
- `netlify/functions/sync-vote-records.ts`

## Root Cause Analysis

### 1. Thirdweb SDK Event Type Issues
The migration to Thirdweb v5 has introduced breaking changes in how events are typed and handled:
- Event names are now passed differently (not as `eventName` property)
- Event results have different type structures
- PreparedEvent type expectations have changed

### 2. Supabase Type Safety
Database query results are not properly typed, leading to:
- `never` type assignments when inserting/updating records
- Missing property errors on query results
- Type inference failures in array operations

## Detailed Error Breakdown

### populate-season3-data.ts
```typescript
// Line 56: 'eventName' property doesn't exist in new SDK
eventName: 'VoteCast', // This format is deprecated

// Lines 74-76: Event result structure has changed
event.blockNumber // Property doesn't exist on 'never'
event.transactionHash // Property doesn't exist on 'never'
event.args // Property doesn't exist on 'never'
```

### sync-vote-records.ts
```typescript
// Lines 64-66: String assignments to PreparedEvent<AbiEvent>
events: [
  'VoteCast',      // Type 'string' not assignable to PreparedEvent
  'VotesDelegated',
  'VotesRecalled'
]
```

## Proposed Fix

### Step 1: Update Event Handling for Thirdweb v5
```typescript
// Instead of:
eventName: 'VoteCast'

// Use:
events: [
  prepareEvent({
    signature: 'VoteCast(address indexed voter, uint256 indexed evermarkId, uint256 amount)'
  })
]
```

### Step 2: Add Proper Type Definitions
Create a types file for database schemas:
```typescript
// netlify/functions/types/database.ts
export interface VoteRecord {
  user_id: string;
  evermark_id: string;
  cycle: number;
  amount: string;
  action: string;
  metadata: Record<string, any>;
}

export interface EvermarkTotal {
  evermark_id: string;
  cycle_id: number;
  total_votes: string;
  rank: number;
  updated_at: string;
}
```

### Step 3: Type Supabase Queries
```typescript
const { data, error } = await supabase
  .from('votes')
  .insert<VoteRecord>({
    user_id: voter.toLowerCase(),
    evermark_id: evermarkId.toString(),
    // ...
  });
```

## Implementation Plan

1. **Create types file** for database schemas
2. **Update event handling** to match Thirdweb v5 patterns
3. **Add generic types** to Supabase operations
4. **Test each function** individually
5. **Verify type checking** passes

## Priority
**High** - These TypeScript errors prevent successful builds and deployments

## Notes
- The new file `clear-incorrect-votes.ts` appears to be a maintenance function and doesn't have type errors
- Recent commits mention "fixing total & supported counts" suggesting ongoing voting system issues
- Consider adding a comprehensive test suite for these critical functions