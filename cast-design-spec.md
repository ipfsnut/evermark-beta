# Enhanced Cast Image Design Specification

## Visual Layout (800x400px)

```
┌─────────────────────────────────────────────────────────────────┐
│ Farcaster Cast                                         Evermarks │ ← Header (60px)
├─────────────────────────────────────────────────────────────────┤
│  ●                                                               │
│ ┌─┐  Vitalik Buterin                              📺 confessions │ ← Author Row (50px)
│ │🖼│  @vitalik.eth                                   2h ago      │
│ └─┘                                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ MOO                                                             │
│ MOO HA                                                          │ ← Cast Content (240px)
│ MOO HA HA SAID THE LAUGHING COW                                │
│                                                                 │
│ 🔗 Link preview or 📷 Image indicator (if embeds exist)       │
├─────────────────────────────────────────────────────────────────┤
│ ❤️ 32   🔄 5   💬 16                           Apr 17, 2024    │ ← Engagement (50px)
└─────────────────────────────────────────────────────────────────┘
```

## Design Elements

### Color Scheme
```typescript
const colors = {
  // Farcaster brand colors
  primary: '#8B5CF6',    // Purple header
  secondary: '#A78BFA',  // Lighter purple accents
  
  // Content colors  
  background: '#FFFFFF',
  cardBg: '#F8FAFC',
  
  // Text hierarchy
  textPrimary: '#1F2937',     // Author name, main text
  textSecondary: '#6B7280',   // Username, metadata
  textMuted: '#9CA3AF',       // Timestamps, counts
  
  // Accents
  border: '#E5E7EB',
  success: '#10B981',   // For verified badges
}
```

### Typography
```typescript
const fonts = {
  author: {
    family: 'Inter, -apple-system, sans-serif',
    size: '18px',
    weight: '600',
    color: colors.textPrimary
  },
  username: {
    family: 'Inter, -apple-system, sans-serif', 
    size: '14px',
    weight: '400',
    color: colors.textSecondary
  },
  content: {
    family: 'Inter, -apple-system, sans-serif',
    size: '16px',
    weight: '400',
    color: colors.textPrimary,
    lineHeight: '1.5'
  },
  engagement: {
    family: 'Inter, -apple-system, sans-serif',
    size: '13px',
    weight: '500',
    color: colors.textMuted
  }
}
```

### Profile Picture
- **Size**: 40x40px circular
- **Position**: 16px from left, 16px from author row top
- **Fallback**: Colored circle with first letter of username
- **Border**: 2px solid rgba(139, 92, 246, 0.1)

### Channel Badge
- **Style**: Rounded pill badge
- **Colors**: Light purple background, darker purple text
- **Position**: Top right of author row
- **Format**: "📺 channel-name" or custom channel emoji

### Embed Indicators
```typescript
const embedTypes = {
  image: '🖼️ Image',
  video: '🎥 Video', 
  link: '🔗 Link',
  frame: '🖼️ Frame',
  mention: '@mention'
}
```

### Engagement Row
- **Layout**: Left-aligned metrics, right-aligned timestamp
- **Icons**: Native emoji (❤️ 🔄 💬) for better cross-platform display
- **Spacing**: 16px between metrics

## Implementation Approach

### Profile Picture Handling
```typescript
async function getProfileImage(pfpUrl: string): Promise<string> {
  try {
    // Download and resize profile picture
    const response = await fetch(pfpUrl);
    const imageBuffer = await response.arrayBuffer();
    
    // Resize to 40x40 and make circular
    const processedImage = await sharp(Buffer.from(imageBuffer))
      .resize(40, 40)
      .png()
      .toBuffer();
      
    return `data:image/png;base64,${processedImage.toString('base64')}`;
  } catch (error) {
    // Return default avatar SVG
    return generateDefaultAvatar(username);
  }
}
```

### SVG Template Structure
```xml
<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with subtle gradient -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#F8FAFC;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFFFFF;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Main background -->
  <rect width="800" height="400" fill="url(#bg)"/>
  
  <!-- Header with brand colors -->
  <rect width="800" height="60" fill="#8B5CF6"/>
  <!-- Header gradient overlay -->
  <rect width="800" height="60" fill="url(#headerGradient)" opacity="0.1"/>
  
  <!-- Profile picture (will be embedded as data URI) -->
  <circle cx="36" cy="116" r="22" fill="#E5E7EB"/>
  <image x="16" y="96" width="40" height="40" href="{profileImageDataUri}" clip-path="circle(20px at 20px 20px)"/>
  
  <!-- Content sections... -->
</svg>
```

### Text Rendering Improvements
- **Better line breaking**: Break on word boundaries, not character limits
- **Smart truncation**: Show "..." if content is too long
- **URL detection**: Style URLs differently from regular text
- **Mention highlighting**: Color @mentions differently

## Expected Visual Impact

### Before (Current)
- Basic purple header with Arial text
- No visual hierarchy
- Minimal engagement display
- Text-heavy, corporate look

### After (Enhanced)
- Modern card-like design with subtle shadows
- Clear visual hierarchy with profile pictures
- Channel context and embed indicators  
- Social media aesthetic matching user expectations
- Professional but approachable Farcaster branding

## Development Complexity: Medium (2-3 days)

### Day 1: Core Visual Improvements
- Implement new color scheme and typography
- Add profile picture downloading and embedding
- Improve layout and spacing

### Day 2: Content Enhancements  
- Add channel badge support
- Implement embed indicators
- Better text wrapping and formatting

### Day 3: Polish & Testing
- Error handling for missing profile pictures
- Performance optimization for image processing
- Test with various cast types and edge cases

This design will make cast evermarks look modern and professional while staying true to the Farcaster visual language that users expect.