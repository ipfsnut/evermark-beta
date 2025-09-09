// src/pages/BetaPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BetaPage from './BetaPage'

// Mock dependencies
vi.mock('@/providers/ThemeProvider', () => ({
  useTheme: () => ({ isDark: false })
}))

vi.mock('@/hooks/core/useWalletAccount', () => ({
  useWalletAccount: vi.fn()
}))

vi.mock('@/features/points/hooks/useBetaPoints', () => ({
  useBetaPoints: vi.fn()
}))

vi.mock('@/features/points/services/PointsService', () => ({
  PointsService: {
    formatPoints: vi.fn((points) => points.toString())
  }
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

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset to default mocks  
    const { useWalletAccount } = await import('@/hooks/core/useWalletAccount')
    const { useBetaPoints } = await import('@/features/points/hooks/useBetaPoints')
    const { useTheme } = await import('@/providers/ThemeProvider')
    
    vi.mocked(useWalletAccount).mockReturnValue(mockAccount)
    vi.mocked(useBetaPoints).mockReturnValue({
      userPoints: mockUserPoints,
      transactions: mockTransactions,
      leaderboard: mockLeaderboard,
      isLoading: false,
      error: null
    })
    vi.mocked(useTheme).mockReturnValue({ isDark: false })
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
    expect(screen.getByText('Create Evermark')).toBeInTheDocument()
    expect(screen.getByText('Vote')).toBeInTheDocument()
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

  it('should show unranked when user is not in leaderboard', async () => {
    const { useBetaPoints } = await import('@/features/points/hooks/useBetaPoints')
    vi.mocked(useBetaPoints).mockReturnValueOnce({
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

  it('should show empty state when no activities', async () => {
    const { useBetaPoints } = await import('@/features/points/hooks/useBetaPoints')
    vi.mocked(useBetaPoints).mockReturnValueOnce({
      userPoints: { total_points: 0, last_updated: new Date().toISOString() },
      transactions: [],
      leaderboard: mockLeaderboard,
      isLoading: false,
      error: null
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('No activity yet. Start by creating Evermarks, voting, or staking!')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument() // Total activities
  })

  it('should show wallet connection prompt when not connected', async () => {
    const { useWalletAccount } = await import('@/hooks/core/useWalletAccount')
    vi.mocked(useWalletAccount).mockReturnValueOnce(null)

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Beta Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Connect your wallet to view your beta points and activity.')).toBeInTheDocument()
    expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument()
  })

  it('should show loading state', async () => {
    const { useBetaPoints } = await import('@/features/points/hooks/useBetaPoints')
    vi.mocked(useBetaPoints).mockReturnValueOnce({
      userPoints: null,
      transactions: [],
      leaderboard: [],
      isLoading: true,
      error: null
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Loading beta data...')).toBeInTheDocument()
    // Loading spinner might not have role="status", so let's just check for the spinner div
    const loadingSpinner = screen.getByText('Loading beta data...').previousElementSibling
    expect(loadingSpinner).toHaveClass('animate-spin')
  })

  it('should show error state', async () => {
    const { useBetaPoints } = await import('@/features/points/hooks/useBetaPoints')
    vi.mocked(useBetaPoints).mockReturnValueOnce({
      userPoints: null,
      transactions: [],
      leaderboard: [],
      isLoading: false,
      error: 'Failed to load beta data'
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Failed to load beta data')).toBeInTheDocument()
  })

  it('should handle missing points data gracefully', async () => {
    const { useBetaPoints } = await import('@/features/points/hooks/useBetaPoints')
    vi.mocked(useBetaPoints).mockReturnValueOnce({
      userPoints: null,
      transactions: mockTransactions,
      leaderboard: mockLeaderboard,
      isLoading: false,
      error: null
    })

    render(<BetaPage />, { wrapper: createWrapper() })

    expect(screen.getByText('0')).toBeInTheDocument() // Should default to 0 points
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
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('How to Earn Points')
  })

  it('should handle dark theme properly', async () => {
    const { useTheme } = await import('@/providers/ThemeProvider')
    vi.mocked(useTheme).mockReturnValueOnce({ isDark: true })

    render(<BetaPage />, { wrapper: createWrapper() })

    // Component should render without crashing in dark mode
    expect(screen.getByText('Beta Dashboard')).toBeInTheDocument()
  })
})