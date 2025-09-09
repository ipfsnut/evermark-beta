# Beta Points System

Simple point rewards for user actions during beta period.

## Point Values
- **Create evermark**: 10 points
- **Vote on evermark**: 1 point  
- **Stake EMARK**: 1 point per 1,000,000 EMARK staked

## Implementation
- Points stored in `beta_points` table (wallet_address → total_points)
- Audit trail in `beta_point_transactions` table
- API endpoint: `/.netlify/functions/beta-points`
- Frontend hook: `useBetaPoints()` from `src/features/points/`

## Integration Points
Points are automatically awarded when:
1. Evermark creation completes successfully (in `useEvermarkCreation`)
2. Vote transaction confirms (in `useVotingState`) 
3. Stake transaction confirms (in `useStakingState`)

## Features
- Real-time point updates
- Transaction history per user
- Public leaderboard (top 100)
- Wallet-based identification

## Usage
```typescript
import { useBetaPoints } from '@/features/points';

const { userPoints, leaderboard, awardPoints } = useBetaPoints();

// Award points manually if needed
await awardPoints('create_evermark', evermarkId, txHash);
```

## Database Schema
```sql
-- User point totals
CREATE TABLE beta_points (
  wallet_address TEXT PRIMARY KEY,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Point transaction audit trail  
CREATE TABLE beta_point_transactions (
  id UUID PRIMARY KEY,
  wallet_address TEXT,
  action_type TEXT, -- 'create_evermark', 'vote', 'stake'
  points_earned INTEGER,
  related_id TEXT,  -- evermark_id, vote reference, etc
  tx_hash TEXT,     -- blockchain transaction hash
  created_at TIMESTAMP
);
```

## Notes
- No point decay or expiration during beta
- Used for beta leaderboard and early user rewards
- Points persist across wallet sessions
- Future: May convert to on-chain rewards system