# Implementation Roadmap: From Broken to Working

## What Needs to Be Built (Not Already Done)

### 1. VotingAggregatorService (NEW - Critical)
**Status**: Doesn't exist
**Purpose**: Single source of truth for all voting data
**Work Required**:
```typescript
// New file: src/features/voting/services/VotingAggregatorService.ts
- Consolidate VotingService, VotingCacheService, BlockchainLeaderboardService
- Standardize data format (wei → EMARK conversion)
- Handle cache misses with blockchain fallback
- Ensure consistency across all consumers
```
**Hurdles**: 
- Multiple existing services with different interfaces
- Need to maintain backward compatibility during transition
- Wei/EMARK conversion inconsistencies

### 2. WemarkLibrary Component (NEW - High Priority)
**Status**: Doesn't exist
**Purpose**: Show users their voting history as personal library
**Work Required**:
```typescript
// New file: src/features/voting/components/WemarkLibrary.tsx
- Query user's votes from votes table
- Join with evermark metadata
- Display as clickable library/collection
- Sort by date, amount, or alphabetical
- Direct links to original content
```
**Hurdles**:
- No existing user_votes view in Supabase
- Need to create efficient query joining votes + evermarks
- UI/UX design for library view

### 3. Fix evermarks.ts API (MODIFY - Critical)
**Status**: Returns hardcoded 0 for vote_count
**Current Code** (line 253):
```typescript
vote_count: 0,  // TODO: Add vote count
```
**Required Change**:
```typescript
import { VotingCacheService } from '@/features/voting/services/VotingCacheService';

// In the response building section:
const votingData = await VotingCacheService.getCachedVotingData(data.token_id.toString());
vote_count: Number(votingData.votes / BigInt(10 ** 18)),
supported_count: votingData.voterCount,
```
**Hurdles**:
- VotingCacheService is frontend code, need backend version
- May need to import/adapt service for Netlify function environment
- Performance impact of additional async call per evermark

### 4. Self-Voting Prevention (MODIFY - Medium Priority)
**Status**: Allowed everywhere
**Required Changes**:

**Frontend** (VotingPanel):
```typescript
const canVote = evermark.owner?.toLowerCase() !== userAddress?.toLowerCase();
```

**Backend** (voting-sync.ts):
```typescript
// Add validation before processing vote
if (voter.toLowerCase() === evermarkOwner.toLowerCase()) {
  throw new Error('Cannot vote for your own evermark');
}
```
**Hurdles**:
- Smart contract may still allow it (need to check)
- Existing self-votes in database need cleanup
- User experience messaging

## Major Implementation Hurdles

### 1. TypeScript Errors Blocking Deployment
**Problem**: Netlify functions have compilation errors
**Impact**: Can't deploy fixes until resolved
**Solution Path**:
- Fix Thirdweb v5 event handling syntax
- Add proper types for Supabase operations
- May need to temporarily use `// @ts-ignore` to unblock

### 2. Service Layer Import Issues
**Problem**: Services are in frontend `/src`, functions are in `/netlify`
**Impact**: Can't directly use VotingCacheService in evermarks.ts
**Solution Options**:
1. Duplicate service logic in Netlify functions (quick fix)
2. Create shared library both can import (better long-term)
3. Make API calls between functions (adds latency)

### 3. Database Schema Gaps
**Problem**: Missing tables/views mentioned in vision
**Needs Creation**:
- `voting_cache` table (if not exists)
- `user_votes` view joining votes + evermarks
- Indexes on evermark_id for performance

**SQL Required**:
```sql
CREATE TABLE IF NOT EXISTS voting_cache (
  evermark_id TEXT PRIMARY KEY,
  total_votes DECIMAL,
  total_votes_wei NUMERIC,
  voter_count INTEGER,
  current_cycle INTEGER,
  last_block_synced BIGINT,
  last_synced_at TIMESTAMP DEFAULT NOW()
);

CREATE VIEW user_votes AS
SELECT 
  v.user_id as user_address,
  v.evermark_id,
  e.title as evermark_title,
  e.content_url as evermark_url,
  v.amount / 1e18 as vote_amount_emark,
  v.metadata->>'transaction_hash' as transaction_hash,
  v.created_at as voted_at
FROM votes v
JOIN beta_evermarks e ON e.token_id::text = v.evermark_id
WHERE v.action = 'vote';
```

### 4. Real-time Sync Reliability
**Problem**: Events may be missed, cache gets stale
**Current**: Periodic sync every 5 minutes
**Challenges**:
- WebSocket connections for real-time updates
- Handling blockchain reorgs
- Rate limiting from RPC providers

## Implementation Order (Practical Path)

### Phase 1: Unblock Core Functionality (Week 1)
1. **Fix TypeScript errors** in Netlify functions
   - Update to Thirdweb v5 syntax
   - Add type definitions
   - Get builds passing

2. **Create backend VotingCacheService**
   - Port essential methods to Netlify function utils
   - Connect to Supabase from backend
   - Test cache reads

3. **Fix evermarks.ts vote counts**
   - Import backend VotingCacheService
   - Replace hardcoded 0 with real data
   - Test API returns correct counts

### Phase 2: Complete Voting System (Week 2)
1. **Create VotingAggregatorService**
   - Build in frontend first
   - Consolidate existing services
   - Standardize data format

2. **Add self-voting prevention**
   - Frontend UI blocking
   - Backend validation
   - Clean existing bad data

3. **Ensure sync reliability**
   - Add error recovery
   - Implement retry logic
   - Add monitoring/logging

### Phase 3: User Library Feature (Week 3)
1. **Create database views**
   - user_votes view
   - Add necessary indexes

2. **Build WemarkLibrary component**
   - Design UI layout
   - Implement data fetching
   - Add filtering/sorting

3. **Add to navigation**
   - "My Wemarks" menu item
   - Route configuration
   - Mobile responsive

## Testing Strategy

### Unit Tests Needed
- VotingAggregatorService data consolidation
- Wei to EMARK conversion accuracy
- Self-voting prevention logic

### Integration Tests Needed
- Vote flow from UI to blockchain to cache
- Leaderboard sorting with real data
- WemarkLibrary data queries

### Manual Testing Required
- Vote counts match between views
- Self-voting properly blocked
- Library shows correct history

## Risk Mitigation

### High Risk: Breaking existing functionality
**Mitigation**: 
- Feature flag new services
- Gradual rollout
- Keep old code paths during transition

### Medium Risk: Performance degradation
**Mitigation**:
- Add caching layers
- Optimize database queries
- Use connection pooling

### Low Risk: UI inconsistencies
**Mitigation**:
- Standardize number formatting
- Central conversion utilities
- Consistent loading states

## Success Criteria

✅ Vote counts show real numbers (not 0)
✅ Leaderboard sorts by actual votes
✅ Users can't vote for own content
✅ WemarkLibrary shows vote history
✅ All TypeScript errors resolved
✅ Sync completes in < 30 seconds
✅ No duplicate vote records

## Estimated Timeline

**Week 1**: Core fixes (vote counts working)
**Week 2**: System completion (aggregation + prevention)
**Week 3**: User features (library view)
**Week 4**: Testing and refinement

Total: ~1 month to fully working system