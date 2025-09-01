# Complete Cast + Deduplication System Implementation Roadmap

## Current Status: Phase 1 & 2 Complete ✅

### ✅ COMPLETED
- [x] **farcaster-cast.ts** netlify function with Neynar API integration
- [x] **FarcasterService** updated for new endpoint response format
- [x] **useEvermarkCreation.ts** cast metadata fetching integration
- [x] **Database sync** with rich cast metadata structure
- [x] **Automatic image generation** trigger after cast creation

---

## PHASE 3: Enhanced Cast Image Generation (2 days)
**Priority: HIGH** - Improves user experience significantly

### Day 1: Core Visual Improvements
```typescript
// netlify/functions/generate-cast-image.ts enhancements
```

**Tasks:**
- [ ] **Modern Typography & Layout**
  - Replace Arial with Inter font family
  - Implement Farcaster color scheme (#8B5CF6 primary)
  - Add card-style background with subtle gradients
  - Improve text hierarchy and spacing

- [ ] **Profile Picture Integration**
  - Download author pfp_url from cast metadata
  - Resize to 40x40px circular crop
  - Embed as data URI in SVG
  - Fallback to colored circle with username initial

- [ ] **Channel Context Display**
  - Show channel badge if cast belongs to a channel
  - Format as "📺 channel-name" in top-right
  - Style as rounded pill with purple accent

### Day 2: Advanced Features & Polish
- [ ] **Embed Indicators**
  - Detect embeds in cast metadata from Neynar
  - Show icons: 🖼️ Image, 🎥 Video, 🔗 Link, 🖼️ Frame
  - Position below main text content

- [ ] **Enhanced Engagement Display**
  - Better formatting of likes/recasts/replies
  - Improved positioning and typography
  - Add hover-style visual effects

- [ ] **Error Handling & Optimization**
  - Graceful fallbacks for missing profile pictures
  - Performance optimization for image processing
  - Retry logic for failed profile picture downloads

**Expected Result**: Cast images look professional and match modern social media standards

---

## PHASE 4: Repair Existing Broken Casts (1 day)
**Priority: HIGH** - Fixes immediate user-visible issues

### Repair Function Implementation
**File**: `netlify/functions/repair-cast-metadata.ts`

```typescript
// Manual repair function for casts #4 and #5
async function repairBrokenCasts() {
  // 1. Query casts with minimal metadata
  const brokenCasts = await supabase
    .from('beta_evermarks')
    .select('*')
    .eq('content_type', 'Cast')
    .like('metadata_json', '{"tags":["farcaster","cast"],"customFields":[]}');
  
  // 2. Re-fetch cast data and update records
  for (const cast of brokenCasts) {
    const castData = await FarcasterService.fetchCastMetadata(cast.source_url);
    // Update database with rich metadata
    // Regenerate cast preview image
  }
}
```

**Tasks:**
- [ ] **Create repair function**
  - Identify casts with minimal metadata
  - Re-fetch from Neynar API using source_url
  - Update database records with rich metadata
  - Trigger image regeneration

- [ ] **Fix Casts #4 and #5**
  - Run repair function on specific token IDs
  - Verify metadata is correctly updated
  - Confirm images are regenerated
  - Test display in UI

**Expected Result**: All existing cast evermarks have proper metadata and images

---

## PHASE 5: Multi-Tier Deduplication System (3-4 days)
**Priority: MEDIUM** - Prevents content bloat, drives engagement

### Day 1: Content Identifier Extraction
**File**: `src/utils/contentIdentifiers.ts`

```typescript
interface ContentIdentifier {
  id: string;
  type: 'cast_hash' | 'doi' | 'isbn' | 'tweet_id' | 'youtube_id' | 'normalized_url';
  confidence: 'exact' | 'high' | 'medium' | 'low';
}

export function extractContentIdentifier(url: string): ContentIdentifier {
  // Tier 1: Immutable identifiers (exact matches)
  // Tier 2: Platform-specific IDs (high confidence)  
  // Tier 3: Normalized URLs (low confidence)
}
```

**Tasks:**
- [ ] **Implement identifier extraction**
  - Farcaster cast hashes (exact)
  - DOI patterns (exact) 
  - ISBN patterns (exact)
  - Twitter/X tweet IDs (high)
  - YouTube video IDs (high)
  - Normalized URL fallback (low)

- [ ] **URL Normalization**
  - Protocol standardization (https://)
  - Remove www., trailing slashes
  - Strip tracking parameters
  - Domain variations (twitter.com ↔ x.com)

### Day 2: API Duplicate Detection
**File**: `netlify/functions/evermarks.ts` enhancement

```typescript
// GET /api/evermarks?check_duplicate=true&source_url={url}
interface DuplicateCheckResponse {
  exists: boolean;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  existingTokenId?: number;
  existingEvermark?: EvermarkRecord;
  duplicateType: string;
}
```

**Tasks:**
- [ ] **Database queries by identifier type**
  - Cast hash: Check metadata_json->cast->hash
  - DOI: Check source_url and metadata
  - ISBN: Check source_url and metadata
  - Tweet ID: Extract and compare
  - Normalized URL: Direct comparison

- [ ] **Include voting/engagement data**
  - Vote counts from voting contract
  - Leaderboard rankings
  - Creation date and author info

### Day 3: Frontend Integration
**File**: `src/features/evermarks/hooks/useEvermarkCreation.ts`

**New Pre-Creation Flow:**
```typescript
1. Validate inputs
2. [NEW] Extract content identifier
3. [NEW] Check for duplicates via API
4. [NEW] If exact match found:
   - Show DuplicateContentModal
   - Hard stop creation process
5. [NEW] If high-confidence match:
   - Show warning with option to proceed
6. If no duplicates OR user chooses "Create Anyway":
   - Continue with cast fetching + creation flow
```

**Tasks:**
- [ ] **Pre-creation duplicate check**
  - Call duplicate detection API
  - Handle different confidence levels
  - Store duplicate info in component state

- [ ] **Modal trigger logic**
  - Exact matches: Hard stop with redirect options
  - High confidence: Warning with override
  - Medium/Low: Optional notification

### Day 4: Duplicate Content Modal UI
**File**: `src/features/evermarks/components/DuplicateContentModal.tsx`

**Features:**
- **Existing Evermark Preview**
  - Title, author, creation date
  - Current vote count and ranking
  - Preview image/thumbnail

- **Action Buttons**
  - "🗳️ Vote & Boost Ranking" → redirect to detail page
  - "👀 View Evermark" → open in new tab
  - "⚡ Create Anyway" → override and continue

- **Content-Type Specific Messaging**
  - Cast: "This cast is already preserved..."
  - DOI: "This research paper is already preserved..."
  - URL: "Similar content might exist..."

**Tasks:**
- [ ] **Modal component creation**
  - Responsive design matching app theme
  - Action button handling
  - Content type detection for messaging

- [ ] **Integration with creation form**
  - Show modal when duplicates detected
  - Handle user choice actions
  - Reset form state appropriately

**Expected Result**: Users are redirected to existing content instead of creating duplicates

---

## PHASE 6: Testing & Validation (2 days)
**Priority: MEDIUM** - Ensures system reliability

### Day 1: Unit & Integration Tests
**Files**: Various `*.test.ts`

**Tasks:**
- [ ] **Cast fetching tests**
  - FarcasterService with various cast URLs
  - Error handling for invalid hashes
  - API timeout and retry logic

- [ ] **Deduplication tests**
  - Content identifier extraction accuracy
  - Database query correctness
  - Edge cases (malformed URLs, missing data)

- [ ] **Image generation tests**
  - Profile picture downloading
  - SVG generation with various cast types
  - Error fallbacks

### Day 2: End-to-End Testing
**Manual testing scenarios**

**Tasks:**
- [ ] **Cast creation flow**
  - Create new cast evermark with working hash
  - Verify metadata fetching and storage
  - Confirm image generation
  - Check database structure

- [ ] **Deduplication flow** 
  - Attempt to create duplicate cast
  - Verify modal appears with correct options
  - Test "Vote" and "View" redirects
  - Test "Create Anyway" override

- [ ] **Edge case testing**
  - Invalid cast hashes
  - Network failures during creation
  - Missing profile pictures
  - Malformed duplicate detection

**Expected Result**: Robust system that handles errors gracefully

---

## PHASE 7: Database Schema Enhancement (1 day)
**Priority: LOW** - Nice to have for better performance

### Schema Changes
```sql
-- Add content identifier tracking
ALTER TABLE beta_evermarks 
ADD COLUMN content_identifier TEXT,
ADD COLUMN identifier_type TEXT;

-- Performance indexes
CREATE INDEX idx_content_identifier ON beta_evermarks(content_identifier, identifier_type);
CREATE INDEX idx_source_url_btree ON beta_evermarks USING btree(source_url);
```

**Tasks:**
- [ ] **Add new columns**
  - content_identifier for extracted IDs
  - identifier_type for classification

- [ ] **Populate existing records**
  - Run migration to extract identifiers from existing evermarks
  - Backfill new columns

- [ ] **Update creation flow**
  - Store identifier on creation
  - Use for faster duplicate queries

---

## SUCCESS METRICS

### Cast Functionality
- [ ] All new cast evermarks have rich metadata with author, engagement, timestamp
- [ ] Cast preview images generate automatically with modern design  
- [ ] Broken casts #4 and #5 are repaired and functional
- [ ] Cast creation completes in <30 seconds including metadata fetch

### Deduplication System
- [ ] Exact duplicates (casts, DOIs, ISBNs) are prevented with 100% accuracy
- [ ] High-confidence duplicates show appropriate warnings
- [ ] Users successfully redirected to existing evermarks for voting
- [ ] Duplicate detection adds <2 seconds to creation flow

### Overall System Health
- [ ] Zero regression on existing non-cast evermark creation
- [ ] API endpoints handle errors gracefully with proper HTTP codes
- [ ] System degrades gracefully when external APIs (Neynar) are unavailable
- [ ] Database performance remains stable with new indexes

---

## IMPLEMENTATION TIMELINE

**Week 1:**
- Day 1-2: Phase 3 (Enhanced Cast Images)
- Day 3: Phase 4 (Repair Broken Casts)
- Day 4-5: Phase 5 Days 1-2 (Deduplication Backend)

**Week 2:**
- Day 1-2: Phase 5 Days 3-4 (Deduplication Frontend)  
- Day 3-4: Phase 6 (Testing & Validation)
- Day 5: Phase 7 (Database Schema) + Buffer/Polish

**Total Estimated Time: 8-10 development days**

This comprehensive system will transform cast evermarks from broken/basic to professional-grade with intelligent duplicate prevention that drives user engagement to existing content.