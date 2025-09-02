# Issue 002: Voting Count and Total Consistency Issues

## Issue Summary
The voting system has multiple sources of truth for vote counts and totals, leading to inconsistency:
1. Vote counts stored in different places (Supabase cache, blockchain, evermarks table)
2. Missing synchronization between data sources
3. Self-voting problem requiring manual cleanup
4. Discrepancies between "total_votes", "supported_count", and actual vote tallies

## Evidence
- Recent commits: "fixing total & supported counts", "getting my evermarks to work properly"
- New cleanup function: `clear-incorrect-votes.ts` to handle self-voting issues
- Multiple voting data services with different calculation methods

## Architecture Analysis

### Current Data Flow
```
User Votes (Frontend)
    ↓
Smart Contract (Source of Truth)
    ↓
Multiple Parallel Systems:
├── Supabase Cache (VotingCacheService)
├── Votes Table (individual vote records)
├── Evermarks Table (vote_count field - hardcoded to 0!)
└── Leaderboard Service (calculates from multiple sources)
```

### Discovered Issues

#### 1. Hardcoded Zero Vote Count
In `netlify/functions/evermarks.ts:253`:
```typescript
vote_count: 0,  // TODO: Add vote count and staking data when available
```
**Problem**: Vote counts are always returned as 0 from the evermarks API, despite votes existing on-chain.

#### 2. Multiple Calculation Methods
- **LeaderboardService**: Uses cached data, falls back to blockchain
- **VotingCacheService**: Maintains separate cache in Supabase
- **BlockchainLeaderboardService**: Direct blockchain queries
- **VotingService**: Mixed approach with caching

#### 3. Self-Voting Issue
Users can vote for their own evermarks, which violates the intended mechanics:
- Requires manual cleanup via `clear-incorrect-votes.ts`
- No prevention mechanism at contract or frontend level
- Creates invalid vote records that skew totals

#### 4. Cache Staleness Problem
From `LeaderboardService.ts`:
```typescript
// Check if cache is stale and needs refresh
const isStale = await VotingCacheService.isCacheStale(evermarkId);
```
Multiple caching layers with different TTLs and refresh strategies.

## Root Causes

### 1. Missing Integration
The evermarks API endpoint doesn't integrate with the voting system:
- Returns hardcoded 0 for vote_count
- No connection to VotingCacheService or blockchain data
- Frontend receives incorrect vote totals

### 2. Self-Voting Not Prevented
No validation at multiple levels:
- Smart contract allows self-voting (needs verification)
- Frontend doesn't prevent UI interaction
- Backend accepts and stores invalid votes

### 3. Inconsistent Data Models
Different services use different field names:
- `vote_count` vs `total_votes` vs `votes`
- `supported_count` vs `voterCount` vs `totalVoters`
- Wei vs whole token representations

## Proposed Fix

### Phase 1: Immediate Fixes
1. **Update evermarks.ts to return real vote counts**:
```typescript
// Instead of hardcoded 0
const votingData = await VotingCacheService.getCachedVotingData(evermark.token_id.toString());
const vote_count = Number(votingData.votes / BigInt(10 ** 18));
const supported_count = votingData.voterCount;
```

2. **Add self-voting prevention in frontend**:
```typescript
// In voting component
const canVote = evermark.owner?.toLowerCase() !== userAddress?.toLowerCase();
```

### Phase 2: Data Consistency
1. **Create single source of truth service**:
```typescript
// VotingAggregatorService.ts
export class VotingAggregatorService {
  static async getVotingData(evermarkId: string) {
    // 1. Check cache first
    // 2. If stale, sync from blockchain
    // 3. Update all dependent tables
    // 4. Return consistent data structure
  }
}
```

2. **Standardize field names across system**:
- Use `total_votes_wei` for raw blockchain values
- Use `total_votes` for human-readable token amounts
- Use `voter_count` consistently

### Phase 3: Prevention & Validation
1. **Smart contract update** (if possible):
   - Add require statement to prevent self-voting
   
2. **Backend validation**:
   - Check owner before accepting votes
   - Validate in Netlify functions

3. **Automated cleanup**:
   - Schedule regular cleanup of invalid votes
   - Add validation on vote insertion

## Implementation Priority
1. **Critical**: Fix evermarks.ts to return real vote counts
2. **High**: Prevent self-voting in frontend
3. **Medium**: Standardize data models
4. **Low**: Refactor to single aggregator service

## Testing Plan
1. Verify vote counts match between API and blockchain
2. Test self-voting prevention
3. Check cache synchronization
4. Validate totals across all views (feed, leaderboard, details)

## Notes
- The `clear-incorrect-votes.ts` function suggests this has been an ongoing issue
- Recent commits indicate active attempts to fix these problems
- Consider adding comprehensive logging to track discrepancies