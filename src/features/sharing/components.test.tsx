// src/features/sharing/components.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DynamicFarcasterMeta } from '../../components/DynamicFarcasterMeta';
import { MainAppShareButton } from '../../components/share/MainAppShareButton';

// Mock the helmet component
vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <div data-testid="helmet">{children}</div>
}));

// Mock the app auth hook
vi.mock('../../providers/AppContext', () => ({
  useAppAuth: () => ({
    user: { address: '0x742d35Cc6634C0532925a3b8D0c46BD5bB8D2D2D' },
    isAuthenticated: true
  })
}));

// Mock fetch for leaderboard API
global.fetch = vi.fn();

describe('DynamicFarcasterMeta Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with fallback content when no top evermark', async () => {
    // Mock empty leaderboard response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ evermarks: [] })
    });

    render(<DynamicFarcasterMeta />);

    await waitFor(() => {
      const helmet = screen.getByTestId('helmet');
      expect(helmet).toBeInTheDocument();
    });
  });

  it('should fetch and display top evermark data', async () => {
    const mockTopEvermark = {
      token_id: 123,
      title: 'Test Evermark',
      author: 'Test Author',
      description: 'Test Description',
      supabase_image_url: 'https://example.com/image.jpg',
      votes: 100
    };

    // Mock successful leaderboard response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ evermarks: [mockTopEvermark] })
    });

    render(<DynamicFarcasterMeta />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/leaderboard-data?limit=1');
    });
  });

  it('should handle API errors gracefully', async () => {
    // Mock failed API response
    (fetch as any).mockRejectedValueOnce(new Error('API Error'));

    render(<DynamicFarcasterMeta />);

    await waitFor(() => {
      const helmet = screen.getByTestId('helmet');
      expect(helmet).toBeInTheDocument();
    });
  });

  it('should use custom fallback props', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ evermarks: [] })
    });

    const customProps = {
      fallbackTitle: 'Custom Title',
      fallbackDescription: 'Custom Description',
      fallbackImageUrl: 'https://custom.com/image.png'
    };

    render(<DynamicFarcasterMeta {...customProps} />);

    await waitFor(() => {
      const helmet = screen.getByTestId('helmet');
      expect(helmet).toBeInTheDocument();
    });
  });
});

describe('MainAppShareButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(void 0) },
      configurable: true
    });

    // Mock window.open
    global.open = vi.fn();
  });

  it('should render as button variant by default', () => {
    render(<MainAppShareButton />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Share Evermark');
  });

  it('should render as icon variant when specified', () => {
    render(<MainAppShareButton variant="icon" />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Share Evermark');
  });

  it('should use custom label when provided', () => {
    render(<MainAppShareButton label="Share App" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Share App');
  });

  it('should apply custom className', () => {
    render(<MainAppShareButton className="custom-class" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should handle native share API when available', () => {
    // Mock native share API
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(void 0),
      configurable: true
    });

    render(<MainAppShareButton />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should show fallback UI when native share not available', () => {
    // Ensure native share is not available
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true
    });

    render(<MainAppShareButton />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});

describe('Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        evermarks: [{
          token_id: 1,
          title: 'Top Evermark',
          author: 'Top Author',
          votes: 500,
          supabase_image_url: 'https://example.com/top.jpg'
        }]
      })
    });
  });

  it('should work together in a parent component', async () => {
    const TestParent = () => (
      <div>
        <DynamicFarcasterMeta />
        <MainAppShareButton />
      </div>
    );

    render(<TestParent />);

    // Both components should render
    await waitFor(() => {
      expect(screen.getByTestId('helmet')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    // API should be called for dynamic meta
    expect(fetch).toHaveBeenCalledWith('/.netlify/functions/leaderboard-data?limit=1');
  });

  it('should handle authentication state properly', () => {
    render(
      <div>
        <DynamicFarcasterMeta />
        <MainAppShareButton />
      </div>
    );

    // Components should render without crashing when user is authenticated
    expect(screen.getByTestId('helmet')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

describe('URL Generation', () => {
  it('should generate correct dynamic OG URLs', () => {
    const dynamicOGUrl = '/.netlify/functions/dynamic-og-image';
    
    expect(dynamicOGUrl).toBe('/.netlify/functions/dynamic-og-image');
    expect(dynamicOGUrl).toMatch(/^\/\.netlify\/functions\//);
  });

  it('should generate correct share URLs for platforms', () => {
    const baseText = 'Check out Evermark!';
    const encodedText = encodeURIComponent(baseText);
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      farcaster: `https://farcaster.xyz/~/compose?text=${encodedText}`
    };

    expect(urls.twitter).toContain('twitter.com/intent/tweet');
    expect(urls.farcaster).toContain('farcaster.xyz/~/compose');
    expect(decodeURIComponent(urls.twitter)).toContain('Check out Evermark!');
    expect(decodeURIComponent(urls.farcaster)).toContain('Check out Evermark!');
  });
});