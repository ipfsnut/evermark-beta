# Dynamic Sharing Deployment Checklist

## ✅ Pre-Deployment Verification

### Code Quality
- [x] **TypeScript Compilation**: `npm run type-check` passes
- [x] **Linting**: All new files pass ESLint with no errors
- [x] **Unit Tests**: 29/29 tests passing in sharing feature
- [x] **Integration Tests**: All URL and meta tag validation tests pass
- [x] **E2E Tests**: Dynamic sharing workflow tests created

### Core Implementation
- [x] **Dynamic OG Image Endpoint**: `/.netlify/functions/dynamic-og-image.ts` created
- [x] **Dynamic Meta Component**: `DynamicFarcasterMeta.tsx` implemented
- [x] **Share Button Component**: `MainAppShareButton.tsx` with platform support
- [x] **Homepage Integration**: Dynamic sharing enabled on main page
- [x] **ShareService Updates**: App-level sharing methods added

### URL Structure Verification
- [x] **Production URLs**: All `https://evermarks.net/.netlify/functions/*` endpoints validated
- [x] **Development URLs**: All `http://localhost:8888/.netlify/functions/*` endpoints validated
- [x] **Social Platform URLs**: Twitter, Farcaster, Warpcast URLs validated
- [x] **Redirect Logic**: Dynamic OG endpoint properly redirects to main app

### Meta Tag Compliance
- [x] **Open Graph**: Required tags (title, description, image, url) implemented
- [x] **Twitter Cards**: summary_large_image format with proper tags
- [x] **Farcaster Mini App**: fc:miniapp meta tags with button configuration
- [x] **Content Sanitization**: XSS protection for user-generated content

### Image Requirements
- [x] **Farcaster Specs**: 3:2 aspect ratio (1.5:1), 600-3000x400-2000px, <10MB
- [x] **Twitter Specs**: 2:1 aspect ratio for summary_large_image, <5MB
- [x] **Fallback Images**: Default og-image.png for when no top evermark available
- [x] **Cache Headers**: 5-minute cache for dynamic images

## 🚀 Deployment Steps

### 1. Environment Configuration
- [ ] Verify all required environment variables are set in Netlify
- [ ] Ensure `VITE_THIRDWEB_CLIENT_ID` is configured
- [ ] Confirm `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- [ ] Check that `URL` environment variable points to production domain

### 2. Database Dependencies
- [ ] Verify `beta_evermarks` table is accessible
- [ ] Confirm `VotingDataService` can fetch voting data
- [ ] Test leaderboard API endpoint functionality
- [ ] Ensure proper error handling for database unavailability

### 3. Function Deployment
- [ ] Deploy `dynamic-og-image.ts` function to Netlify
- [ ] Test function accessibility at production URL
- [ ] Verify function logs show proper execution
- [ ] Confirm function returns valid HTML with meta tags

### 4. Frontend Deployment
- [ ] Deploy updated homepage with `DynamicFarcasterMeta`
- [ ] Verify share buttons render correctly
- [ ] Test meta tag generation in browser dev tools
- [ ] Confirm no JavaScript errors in console

### 5. Social Platform Testing
- [ ] **Twitter**: Test share URL generation and card preview
- [ ] **Farcaster**: Verify Mini App embed displays correctly in Warpcast
- [ ] **Native Share API**: Test mobile sharing on iOS/Android
- [ ] **Copy Link**: Verify clipboard functionality works

## 🧪 Post-Deployment Testing

### Manual Testing Checklist
- [ ] Visit `https://evermarks.net` and inspect meta tags
- [ ] Navigate to `https://evermarks.net/.netlify/functions/dynamic-og-image`
- [ ] Verify redirect from dynamic OG endpoint to main app
- [ ] Test sharing via Twitter - check if card preview shows up
- [ ] Test sharing via Farcaster - verify Mini App embed
- [ ] Share on mobile device using native share API

### Performance Testing
- [ ] Check page load times with dynamic meta tag generation
- [ ] Verify 5-minute cache is working for dynamic OG endpoint
- [ ] Monitor function execution time (should be <2 seconds)
- [ ] Test with high traffic simulation

### Error Scenarios
- [ ] Test when leaderboard API is unavailable (should show fallback)
- [ ] Test when no evermarks exist (should use static meta tags)
- [ ] Test with malformed evermark data (should handle gracefully)
- [ ] Verify error logging is working in Netlify Functions

## 📊 Monitoring & Analytics

### Tracking Implementation
- [ ] Verify share tracking is recording to `shares` table
- [ ] Confirm special 'app' evermark ID is used for app-level shares
- [ ] Test analytics dashboard shows sharing metrics
- [ ] Monitor for any error spikes in function logs

### Business Impact Measurement
- [ ] Set up alerts for dynamic sharing function errors
- [ ] Track click-through rates on shared links
- [ ] Monitor increase in app shares after deployment
- [ ] Measure change in leaderboard voting activity

## 🔧 Rollback Plan

### Quick Fixes
- [ ] **Disable Dynamic Sharing**: Revert homepage to use static `FarcasterMeta`
- [ ] **Function Fallback**: Ensure function returns static content on error
- [ ] **Cache Bust**: Clear CDN cache if meta tags aren't updating

### Emergency Rollback
- [ ] **Complete Revert**: Git revert to commit before dynamic sharing
- [ ] **Database Cleanup**: Remove any new share tracking entries if needed
- [ ] **Monitoring Reset**: Update alerts to previous thresholds

## 🎯 Success Criteria

### Technical Success
- ✅ All functions deploy without errors
- ✅ Meta tags update dynamically based on top evermark
- ✅ Share buttons work across all platforms
- ✅ Performance impact is minimal (<100ms added to page load)
- ✅ Error handling prevents crashes when services unavailable

### Business Success
- 📈 Increased click-through rates on shared Evermark links
- 📈 More app-level shares due to interesting top evermark content
- 📈 Higher engagement with leaderboard content
- 📈 Users motivated to get their evermarks to #1 for sharing exposure

## 🎉 Launch Communication

### Internal Team
- [ ] Notify development team of successful deployment
- [ ] Share success metrics with product team
- [ ] Document any deployment issues for future reference

### Community
- [ ] Announce new dynamic sharing feature on social media
- [ ] Create example shares showing top evermark feature
- [ ] Encourage community to compete for #1 leaderboard spot

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Verification Completed By**: _____________

## Notes
_Add any deployment notes, issues encountered, or special considerations here_