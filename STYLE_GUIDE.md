# Evermark Style Guide

## Design Philosophy

Evermark combines blockchain permanence with elegant, accessible design. The visual system emphasizes clarity, trust, and innovation while maintaining excellent readability across dark and light themes.

## Color System

### Brand Colors
- **Primary**: Cyan/Teal spectrum for trust and innovation
- **Secondary**: Purple spectrum for creativity and distinction  
- **Accent**: Warm amber for important actions and highlights

### Dark Mode Palette
```css
/* Backgrounds */
--bg-primary: #000000        /* Pure black base */
--bg-secondary: #111827      /* Gray-900 */
--bg-tertiary: #1f2937       /* Gray-800 */
--bg-card: #111827           /* Gray-900 with opacity */
--bg-hover: #1f2937          /* Gray-800 */

/* Text */
--text-primary: #ffffff      /* White */
--text-secondary: #d1d5db    /* Gray-300 */
--text-muted: #9ca3af        /* Gray-400 */

/* Borders */
--border-primary: #374151    /* Gray-700 */
--border-secondary: #4b5563  /* Gray-600 */

/* Accents */
--accent-cyan: #00ff41       /* Neon green (legacy) */
--accent-blue: #0080ff       /* Electric blue */
--accent-purple: #ff0080     /* Hot pink */
```

### Light Mode Palette (Refined)
```css
/* Backgrounds */
--bg-primary: #ffffff        /* Clean white */
--bg-secondary: #f9fafb      /* Gray-50 */
--bg-tertiary: #f3f4f6       /* Gray-100 */
--bg-card: #ffffff           /* White with subtle shadow */
--bg-hover: #f3f4f6          /* Gray-100 */

/* Text */
--text-primary: #111827      /* Gray-900 */
--text-secondary: #4b5563    /* Gray-600 */
--text-muted: #6b7280        /* Gray-500 */

/* Borders */
--border-primary: #e5e7eb    /* Gray-200 */
--border-secondary: #d1d5db  /* Gray-300 */

/* Accents */
--accent-primary: #06b6d4    /* Cyan-500 */
--accent-secondary: #8b5cf6  /* Purple-500 */
--accent-success: #10b981    /* Green-500 */
--accent-warning: #f59e0b    /* Amber-500 */
--accent-error: #ef4444      /* Red-500 */
```

## Typography

### Font Stack
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
```

### Type Scale
- **Display**: 3rem (48px) - Hero headings
- **H1**: 2.25rem (36px) - Page titles
- **H2**: 1.875rem (30px) - Section headers
- **H3**: 1.5rem (24px) - Subsections
- **H4**: 1.25rem (20px) - Card titles
- **Body**: 1rem (16px) - Default text
- **Small**: 0.875rem (14px) - Secondary text
- **Caption**: 0.75rem (12px) - Metadata

### Font Weights
- **Light**: 300 - Subtle emphasis
- **Regular**: 400 - Body text
- **Medium**: 500 - UI elements
- **Semibold**: 600 - Headings
- **Bold**: 700 - Strong emphasis

## Spacing System

Using an 8-point grid system:
```css
--space-1: 0.25rem   /* 4px */
--space-2: 0.5rem    /* 8px */
--space-3: 0.75rem   /* 12px */
--space-4: 1rem      /* 16px */
--space-5: 1.25rem   /* 20px */
--space-6: 1.5rem    /* 24px */
--space-8: 2rem      /* 32px */
--space-10: 2.5rem   /* 40px */
--space-12: 3rem     /* 48px */
--space-16: 4rem     /* 64px */
```

## Component Patterns

### Buttons

#### Primary Button
- Dark: Cyan gradient with glow on hover
- Light: Solid cyan with shadow on hover
- States: Default, Hover, Active, Disabled, Loading

#### Secondary Button
- Dark: Gray border with subtle fill
- Light: Gray background with border
- States: Default, Hover, Active, Disabled

#### Ghost Button
- Transparent with border
- Color change on hover
- Minimal visual weight

### Cards

#### Content Card
- Dark: Gray-900 background with gray-700 border
- Light: White background with subtle shadow
- Hover: Border color change and elevated shadow
- Padding: 1.5rem (24px)
- Border radius: 0.5rem (8px)

#### Interactive Card
- Includes hover state with transform
- Cursor pointer indication
- Optional glow effect in dark mode

### Forms

#### Input Fields
- Dark: Gray-900 background with gray-700 border
- Light: White background with gray-200 border
- Focus: Cyan border with ring
- Height: 2.5rem (40px) minimum
- Padding: 0.75rem horizontal

#### Labels
- Position: Above input
- Weight: Medium (500)
- Size: 0.875rem (14px)
- Color: Secondary text color

### Navigation

#### Nav Items
- Padding: 0.75rem x 1rem
- Border radius: 0.5rem
- Active state: Gradient background with glow
- Hover: Background color change
- Transition: 200ms all properties

## Animation Guidelines

### Timing Functions
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
```

### Duration Scale
- **Instant**: 100ms - Micro interactions
- **Fast**: 200ms - Hover states, small transitions
- **Normal**: 300ms - Most animations
- **Slow**: 500ms - Page transitions, modals
- **Deliberate**: 700ms - Complex animations

### Common Animations
- **Fade In**: Opacity 0 to 1 with translateY
- **Slide Up**: TranslateY with opacity
- **Scale**: Transform scale with opacity
- **Glow Pulse**: Box-shadow animation (dark mode)
- **Shimmer**: Loading state animation

## Accessibility

### Color Contrast
- **WCAG AA**: Minimum 4.5:1 for normal text
- **WCAG AAA**: 7:1 for enhanced accessibility
- All text colors tested against backgrounds

### Focus States
- Visible focus rings on all interactive elements
- Cyan color for brand consistency
- 2px ring with 50% opacity

### Touch Targets
- Minimum 44x44px for mobile
- Adequate spacing between targets
- Clear hover and active states

## Responsive Design

### Breakpoints
```css
--mobile: 640px    /* sm */
--tablet: 768px    /* md */
--laptop: 1024px   /* lg */
--desktop: 1280px  /* xl */
--wide: 1536px     /* 2xl */
```

### Mobile-First Approach
- Base styles for mobile
- Progressive enhancement for larger screens
- Touch-optimized interactions
- Safe area considerations for modern devices

## Icon System

### Icon Libraries
- **Lucide React**: Primary icon set
- **Custom SVGs**: Brand-specific icons

### Icon Sizes
- **Small**: 16px - Inline text
- **Default**: 20px - UI elements
- **Medium**: 24px - Buttons, nav
- **Large**: 32px - Feature icons

### Icon Colors
- Inherit from parent text color
- Accent colors for special states
- Consistent stroke width (2px)

## State Communication

### Loading States
- Skeleton screens for content
- Spinners for actions
- Progress bars for uploads
- Shimmer effects for placeholders

### Error States
- Red accent color (#ef4444)
- Clear error messages
- Recovery actions
- Icon indicators

### Success States
- Green accent color (#10b981)
- Temporary notifications
- Smooth transitions
- Checkmark icons

### Empty States
- Helpful illustrations
- Clear call-to-action
- Explanatory text
- Subdued colors

## Best Practices

### Do's
- Maintain consistent spacing
- Use semantic color names
- Provide hover states for all interactive elements
- Test in both themes
- Consider mobile experience first
- Use smooth transitions
- Maintain visual hierarchy

### Don'ts
- Mix spacing units
- Use arbitrary colors
- Forget focus states
- Ignore touch targets
- Create jarring animations
- Break established patterns
- Compromise accessibility

## Implementation Examples

### Button Component
```tsx
// Primary button with theme support
<button className={cn(
  "px-4 py-2 rounded-lg font-medium transition-all duration-200",
  "focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50",
  isDark ? [
    "bg-gradient-to-r from-cyan-500 to-cyan-600",
    "text-white hover:from-cyan-600 hover:to-cyan-700",
    "shadow-lg shadow-cyan-500/25"
  ] : [
    "bg-cyan-500 text-white",
    "hover:bg-cyan-600 hover:shadow-lg"
  ]
)}>
  Action Button
</button>
```

### Card Component
```tsx
// Themed card with hover effect
<div className={cn(
  "p-6 rounded-lg border transition-all duration-200",
  isDark ? [
    "bg-gray-900 border-gray-700",
    "hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10"
  ] : [
    "bg-white border-gray-200",
    "hover:border-cyan-500 hover:shadow-lg"
  ]
)}>
  <h3 className={isDark ? "text-white" : "text-gray-900"}>
    Card Title
  </h3>
  <p className={isDark ? "text-gray-400" : "text-gray-600"}>
    Card content goes here
  </p>
</div>
```

## Version History

- **v1.0.0** (2024-01): Initial style guide creation
- Defined color systems for dark and light themes
- Established typography and spacing scales
- Created component patterns
- Added accessibility guidelines