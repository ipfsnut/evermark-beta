import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BetaPage from './BetaPage'

// Create mock functions
const mockUseWalletAccount = vi.fn()
const mockUseBetaPoints = vi.fn()
const mockUseTheme = vi.fn()
const mockFormatPoints = vi.fn()

// Mock dependencies
vi.mock('@/providers/ThemeProvider', () => ({
  useTheme: () => mockUseTheme()
}))

vi.mock('@/hooks/core/useWalletAccount', () => ({
  useWalletAccount: () => mockUseWalletAccount()
}))

vi.mock('@/features/points/hooks/useBetaPoints', () => ({
  useBetaPoints: () => mockUseBetaPoints()
}))

vi.mock('@/features/points/services/PointsService', () => ({
  PointsService: {
    formatPoints: (points: number) => mockFormatPoints(points) || points.toString()
  }
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  TrophyIcon: () => <div data-testid="trophy-icon">🏆</div>,
  CoinsIcon: () => <div data-testid="coins-icon">🪙</div>,
  UserIcon: () => <div data-testid="user-icon">👤</div>,
  CalendarIcon: () => <div data-testid="calendar-icon">📅</div>,
  ExternalLinkIcon: () => <div data-testid="external-link-icon">🔗</div>,
  FlaskConicalIcon: () => <div data-testid="flask-icon">🧪</div>,
  Loader2: () => <div data-testid="loader-icon" className="animate-spin">⟳</div>
}))

// Create a test wrapper with React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('BetaPage', () => {
  const mockAccount = {
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true
  }

  const mockUserPoints = {
    total_points: 150,
    last_updated: new Date().toISOString()
  }

  const mockTransactions = [
    {
      id: '1',
      action_type: 'create_evermark' as const,
      points_earned: 10,
      created_at: new Date('2024-01-15').toISOString(),
      tx_hash: '0xabc123'
    },
    {
      id: '2',
      action_type: 'vote' as const,
      points_earned: 1,
      created_at: new Date('2024-01-14').toISOString(),
      tx_hash: '0xdef456'
    }
  ]

  const mockLeaderboard = [
    {
      wallet_address: '0x1234567890123456789012345678901234567890',
      total_points: 150,
      rank: 1
    },
    {
      wallet_address: '0x9876543210987654321098765432109876543210',
      total_points: 100,
      rank: 2
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up default mock returns
    mockUseWalletAccount.mockReturnValue(mockAccount)
    mockUseBetaPoints.mockReturnValue({
      userPoints: mockUserPoints,
      transactions: mockTransactions,
      leaderboard: mockLeaderboard,
      isLoading: false,
      error: null
    })
    mockUseTheme.mockReturnValue({ isDark: false })
    mockFormatPoints.mockImplementation((points) => points.toString())
  })

  it('should render beta dashboard when wallet is connected', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Beta Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Track your beta participation and earn points for early access rewards.')).toBeInTheDocument()
  })

  it('should display total points correctly', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Total Points')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('should display correct leaderboard rank', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Leaderboard Rank')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('should display total activities count', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Total Activities')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('should display recent activity list', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    // Check activity list contains both actions (text appears in multiple places)
    expect(screen.getAllByText('Create Evermark')).toHaveLength(2) // Once in activity, once in guide
    expect(screen.getAllByText('Vote')).toHaveLength(2) // Once in activity, once in guide
    expect(screen.getByText('+10 pts')).toBeInTheDocument()
    expect(screen.getByText('+1 pts')).toBeInTheDocument()
  })

  it('should display transaction links to BaseScan', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    const txLinks = screen.getAllByText('View TX')
    expect(txLinks).toHaveLength(2)

    // Check that links point to BaseScan
    const firstLink = txLinks[0].closest('a')
    expect(firstLink).toHaveAttribute('href', 'https://basescan.org/tx/0xabc123')
    expect(firstLink).toHaveAttribute('target', '_blank')
    expect(firstLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('should display points earning guide', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('How to Earn Points')).toBeInTheDocument()
    expect(screen.getByText('10 points per Evermark')).toBeInTheDocument()
    expect(screen.getByText('1 point per vote transaction')).toBeInTheDocument()
    expect(screen.getByText('1 point per 1M EMARK staked')).toBeInTheDocument()
  })

  it('should show unranked when user is not in leaderboard', () => {
    mockUseBetaPoints.mockReturnValue({
      userPoints: mockUserPoints,
      transactions: mockTransactions,
      leaderboard: [
        {
          wallet_address: '0x9876543210987654321098765432109876543210',
          total_points: 100,
          rank: 1
        }
      ], // User not in leaderboard
      isLoading: false,
      error: null
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Unranked')).toBeInTheDocument()
  })

  it('should show empty state when no activities', () => {
    mockUseBetaPoints.mockReturnValue({
      userPoints: { total_points: 0, last_updated: new Date().toISOString() },
      transactions: [],
      leaderboard: mockLeaderboard,
      isLoading: false,
      error: null
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('No activity yet. Start by creating Evermarks, voting, or staking!')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(2) // Points and total activities both show 0
  })

  it('should show wallet connection prompt when not connected', () => {
    mockUseWalletAccount.mockReturnValue(null)

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Beta Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Connect your wallet to view your beta points and activity.')).toBeInTheDocument()
    expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument()
  })

  it('should show loading state', () => {
    mockUseBetaPoints.mockReturnValue({
      userPoints: null,
      transactions: [],
      leaderboard: [],
      isLoading: true,
      error: null
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Loading beta data...')).toBeInTheDocument()
    // Loading spinner is rendered as a div with animate-spin class, not using Loader2 icon
    const spinner = screen.getByText('Loading beta data...').previousElementSibling
    expect(spinner).toHaveClass('animate-spin')
  })

  it('should show error state', () => {
    mockUseBetaPoints.mockReturnValue({
      userPoints: null,
      transactions: [],
      leaderboard: [],
      isLoading: false,
      error: 'Failed to load beta data'
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Failed to load beta data')).toBeInTheDocument()
  })

  it('should handle missing points data gracefully', () => {
    mockUseBetaPoints.mockReturnValue({
      userPoints: null,
      transactions: mockTransactions,
      leaderboard: mockLeaderboard,
      isLoading: false,
      error: null
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    // Should show 0 points when userPoints is null
    const pointsCards = screen.getAllByText('0')
    expect(pointsCards.length).toBeGreaterThan(0)
  })

  it('should format dates correctly in activity list', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    // Check that dates are formatted (will be locale-specific)
    expect(screen.getByText(new Date('2024-01-15').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByText(new Date('2024-01-14').toLocaleDateString())).toBeInTheDocument()
  })

  it('should have proper accessibility attributes', () => {
    render(<BetaPage />, { wrapper: createWrapper() })

    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Beta Dashboard')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Recent Activity')
    
    // Multiple h3 elements exist, so check by text content
    const h3Headings = screen.getAllByRole('heading', { level: 3 })
    expect(h3Headings.some(heading => heading.textContent === 'How to Earn Points')).toBe(true)
  })

  it('should handle dark theme properly', () => {
    mockUseTheme.mockReturnValue({ isDark: true })

    render(<BetaPage />, { wrapper: createWrapper() })

    // Component should render without crashing in dark mode
    expect(screen.getByText('Beta Dashboard')).toBeInTheDocument()
  })

  describe('Component structure', () => {
    it('should render all expected sections when loaded', () => {
      render(<BetaPage />, { wrapper: createWrapper() })

      // Should have stats cards
      expect(screen.getByText('Total Points')).toBeInTheDocument()
      expect(screen.getByText('Leaderboard Rank')).toBeInTheDocument()
      expect(screen.getByText('Total Activities')).toBeInTheDocument()

      // Should have activity section
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()

      // Should have points guide
      expect(screen.getByText('How to Earn Points')).toBeInTheDocument()
    })

    it('should handle points formatting', () => {
      mockFormatPoints.mockReturnValue('150 pts')
      
      render(<BetaPage />, { wrapper: createWrapper() })

      expect(mockFormatPoints).toHaveBeenCalledWith(150)
    })

    it('should handle empty transactions gracefully', () => {
      mockUseBetaPoints.mockReturnValue({
        userPoints: mockUserPoints,
        transactions: [],
        leaderboard: mockLeaderboard,
        isLoading: false,
        error: null
      })

      render(<BetaPage />, { wrapper: createWrapper() })

      expect(screen.getByText('No activity yet. Start by creating Evermarks, voting, or staking!')).toBeInTheDocument()
    })
  })
})