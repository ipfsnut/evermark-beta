# Evermark System Vision & Architecture

## Core Purpose
Evermark provides **dual utility** through a content curation ecosystem:

### For Voters (Readers/Curators)
- **Bookmark with stake**: Voting creates a personal, weighted record of content you've engaged with
- **Build your library**: Your votes become your reading history and reference collection
- **Surface quality**: Collective voting elevates the best content for discovery

### For Creators (Evermarkers)
- **Monetize curation**: Earn from creating persistent links to valuable content
- **Share discoveries**: Get rewarded for finding and preserving great content
- **Build reputation**: Your evermarks' popularity reflects your curation quality

## The Working System

### System Components & Their Roles

```
┌─────────────────────────────────────────────────┐
│                   USER LAYER                     │
├───────────────────┬─────────────────────────────┤
│     CREATORS      │         VOTERS              │
│ - Submit content  │ - Stake $EMARK              │
│ - Earn from votes │ - Vote to wemark            │
│ - Track earnings  │ - Access vote history       │
└───────────────────┴─────────────────────────────┘
                    ↓↑
┌─────────────────────────────────────────────────┐
│                FRONTEND LAYER                    │
├──────────────────────────────────────────────────┤
│ - Evermark Feed (discovery)                      │
│ - Leaderboard (popularity rankings)              │
│ - My Votes (personal library)                    │
│ - Create Form (new evermarks)                    │
└──────────────────────────────────────────────────┘
                    ↓↑
┌─────────────────────────────────────────────────┐
│                   API LAYER                      │
├──────────────────────────────────────────────────┤
│ Single Source of Truth Service                   │
│ - Aggregates blockchain + cache data             │
│ - Returns consistent vote counts                 │
│ - Manages user vote history                      │
└──────────────────────────────────────────────────┘
                    ↓↑
┌─────────────────────────────────────────────────┐
│               STORAGE LAYER                      │
├─────────────────┬────────────────────────────────┤
│   BLOCKCHAIN    │        SUPABASE               │
│ (Authoritative) │     (Fast Cache)              │
│ - Vote txns     │ - Evermark metadata           │
│ - Token stakes  │ - Aggregated counts           │
│ - Ownership     │ - User vote history           │
└─────────────────┴────────────────────────────────┘
```

## Critical User Flows

### Flow 1: Voting as Evermarking
```
1. User sees interesting evermark in feed/leaderboard
2. User clicks "Support" (vote)
3. System records vote on-chain
4. Vote appears in "My Votes" (personal library)
5. Evermark rises in leaderboard
6. User can return via their vote history
```
**Value**: Users build a staked, permanent collection of content they value

### Flow 2: Creating for Earnings
```
1. Creator finds valuable content
2. Creator mints evermark with link/description
3. Other users discover via feed
4. Users vote (bookmark) if valuable
5. Creator earns from vote activity
6. Popular evermarks rise to top
```
**Value**: Creators monetize their curation skills

## The Fixed Architecture

### 1. Single Aggregation Service
```typescript
// VotingAggregatorService.ts - THE source of truth
class VotingAggregatorService {
  // Returns consistent data structure for ANY request
  async getEvermarkData(evermarkId: string) {
    return {
      evermark_id: string,
      total_votes: number,      // Human readable
      total_votes_wei: bigint,  // Raw blockchain
      voter_count: number,       // Unique voters
      user_votes: Map<address, amount>,
      last_synced: timestamp
    }
  }
  
  // User's complete voting history (their library)
  async getUserVoteHistory(address: string) {
    return {
      votes: [{
        evermark_id: string,
        evermark_data: {...},  // Full evermark info
        vote_amount: number,
        voted_at: timestamp,
        transaction_hash: string
      }]
    }
  }
}
```

### 2. Synchronization Strategy
```
Blockchain (source of truth)
    ↓
[Real-time sync on vote transactions]
    ↓
Supabase Cache (normalized, indexed)
    ↓
[Served instantly to users]
```

- **On each vote**: Update cache immediately
- **Periodic sync**: Every 5 minutes, reconcile any gaps
- **On cache miss**: Fetch from blockchain, update cache

### 3. Data Model (Unified)
```sql
-- evermarks table
evermark_id (primary)
content_url
title
description
creator_address
created_at

-- voting_aggregates table (THE key table)
evermark_id (foreign key)
total_votes (decimal, human readable)
total_votes_wei (numeric, raw)
voter_count (integer)
last_block_synced (bigint)
last_synced_at (timestamp)

-- user_votes table (for "My Library")
user_address
evermark_id
vote_amount
transaction_hash
voted_at
```

### 4. API Endpoints (Simplified)
```
GET /api/evermarks
- Returns evermarks WITH real vote data from aggregates

GET /api/evermarks/{id}
- Single evermark WITH real vote data

GET /api/leaderboard
- Sorted by voting_aggregates.total_votes DESC

GET /api/users/{address}/votes
- User's complete vote history (their library)
- Includes full evermark data for each vote

POST /api/votes
- Records vote on blockchain
- Updates cache immediately
- Returns updated totals
```

## Implementation Priorities

### Phase 1: Fix Data Flow (Critical)
1. Create VotingAggregatorService
2. Update evermarks.ts to use aggregator
3. Ensure vote counts display correctly
4. Test leaderboard sorting

### Phase 2: User Library (High)
1. Build "My Votes" view showing vote history
2. Make votes clickable to return to content
3. Show vote amounts and dates
4. Add search/filter for personal library

### Phase 3: Creator Dashboard (Medium)
1. Show earnings per evermark
2. Track voter engagement
3. Display trending status
4. Provide sharing tools

## Success Metrics
- **Vote counts match** between blockchain and UI
- **Leaderboard updates** within 30 seconds of voting
- **User can find** all their past votes
- **Creators can track** earnings in real-time

## Anti-Patterns to Avoid
❌ Multiple sources of truth for vote counts
❌ Hardcoded values in API responses
❌ Self-voting without restrictions
❌ Cache-only queries without blockchain fallback
❌ Inconsistent field names across services

## Key Insight
The system works when **voting serves both personal and collective value**:
- Personal: Building your library of valued content
- Collective: Surfacing the best content for everyone

Every vote is simultaneously:
1. A bookmark for the voter
2. A signal for the community
3. A reward for the creator