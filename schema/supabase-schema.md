# Supabase Database Schema

## Overview
This document describes the actual schema of the `evermarks` table in Supabase, discovered via API on 2025-08-14.

## Table: `evermarks`

### Core Identity Fields
```sql
token_id INTEGER PRIMARY KEY           -- NFT token ID
title TEXT NOT NULL                   -- Evermark title
author TEXT                          -- Content author
owner TEXT                           -- Current NFT owner address
```

### Content Fields
```sql
description TEXT                     -- Evermark description
content_type TEXT                   -- Type: "URL", "Custom Content", etc.
source_url TEXT                     -- Original source URL (nullable)
token_uri TEXT                      -- IPFS metadata URI
```

### Metadata Fields
```sql
metadata_json TEXT                  -- Full JSON metadata from IPFS
ipfs_image_hash TEXT               -- IPFS image hash
ipfs_metadata_hash TEXT            -- IPFS metadata hash
```

### Image & Storage Fields
```sql
supabase_image_url TEXT            -- Supabase storage image URL (nullable)
thumbnail_url TEXT                 -- Thumbnail URL (nullable)
image_width INTEGER                -- Image width in pixels (nullable)
image_height INTEGER               -- Image height in pixels (nullable)
file_size_bytes BIGINT            -- File size in bytes (nullable)
image_dimensions TEXT              -- Legacy field (nullable)
```

### Processing & Cache Fields  
```sql
cache_status TEXT                  -- "metadata_parsed", etc.
cache_priority INTEGER            -- Cache priority level
metadata_processed_at TIMESTAMP   -- When metadata was processed
supabase_uploaded_at TIMESTAMP    -- When uploaded to Supabase storage (nullable)
image_processing_status TEXT      -- "completed", "pending", "failed"
processing_errors TEXT            -- Error messages (nullable)
```

### Blockchain Fields
```sql
tx_hash TEXT                       -- Transaction hash (nullable)  
block_number BIGINT               -- Block number (nullable)
sync_timestamp TIMESTAMP          -- When synced from blockchain
last_synced_at TIMESTAMP         -- Last sync timestamp
```

### System Fields
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
verified BOOLEAN DEFAULT FALSE
user_id UUID                       -- User ID (nullable)
last_accessed_at TIMESTAMP        -- Last access (nullable)
access_count INTEGER DEFAULT 0    -- Access count
```

### Legacy/Unused Fields
```sql
metadata JSON                      -- Legacy metadata field (nullable)
image_processed_at TIMESTAMP      -- Legacy field (nullable)
metadata_json_old TEXT           -- Legacy field (nullable)
ipfs_metadata JSON               -- Legacy field (nullable)
```

## Code Mapping Issues (Fixed)

### Before (Incorrect Column Names):
```javascript
// Code was trying to use these column names:
image_file_size: data.fileSize     // ❌ Column doesn't exist
image_dimensions: data.dimensions  // ❌ Wrong usage
```

### After (Correct Column Names):
```javascript  
// Code should use these existing columns:
file_size_bytes: data.fileSize     // ✅ Correct column name
image_width: data.width           // ✅ Separate width field
image_height: data.height         // ✅ Separate height field
```

## Sample Data Structure
```json
{
  "token_id": 39,
  "title": "just checkin", 
  "author": "Unknown Author",
  "owner": "0x18A85ad341b2D6A2bd67fbb104B4827B922a2A3c",
  "description": "Web content from https://evermarks.net/create | Tags: testing; IGNORE ME",
  "content_type": "URL",
  "source_url": "https://evermarks.net/create",
  "token_uri": "ipfs://QmPsxCLfFKxH3dV5jaezFNUktzKHKGYzTPkySSnQz88k9s",
  "ipfs_image_hash": "QmQSN8NrwZvzz7LkXCGtYy8LgcV3yEgRfPTNXsEun4RpcM",
  "ipfs_metadata_hash": "QmPsxCLfFKxH3dV5jaezFNUktzKHKGYzTPkySSnQz88k9s",
  "supabase_image_url": null,
  "thumbnail_url": null,
  "image_width": null,
  "image_height": null, 
  "file_size_bytes": null,
  "cache_status": "metadata_parsed",
  "image_processing_status": "completed",
  "verified": false,
  "created_at": "2025-07-15T00:00:00+00:00",
  "updated_at": "2025-08-03T18:04:33.112+00:00"
}
```

## Notes
- All image storage fields are nullable since not all Evermarks have images
- Some fields appear to be legacy/unused but kept for compatibility
- The database uses separate `image_width` and `image_height` rather than a combined `image_dimensions` field
- File size is stored as `file_size_bytes` not `image_file_size`