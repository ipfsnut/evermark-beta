import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LeaderboardTabs } from './LeaderboardTabs'
import { LeaderboardService } from '../services/LeaderboardService'
import { VotingService } from '../../voting/services/VotingService'
import type { FinalizedSeason } from '../services/LeaderboardService'

// Mock all dependencies
vi.mock('../services/LeaderboardService', () => ({
  LeaderboardService: {
    getAvailableFinalizedSeasons: vi.fn(),
    getFinalizedLeaderboard: vi.fn(),
    formatVoteAmount: vi.fn()
  }
}))

vi.mock('../../voting/services/VotingService', () => ({
  VotingService: {
    getCurrentSeason: vi.fn()
  }
}))

vi.mock('./LeaderboardTable', () => ({
  LeaderboardTable: vi.fn(({ onEvermarkClick, showFilters, showPagination, compactMode }) => (
    <div data-testid="leaderboard-table">
      Leaderboard Table
      {showFilters && <span data-testid="has-filters">Has Filters</span>}
      {showPagination && <span data-testid="has-pagination">Has Pagination</span>}
      {compactMode && <span data-testid="compact-mode">Compact Mode</span>}
      <button 
        onClick={() => onEvermarkClick?.({ 
          id: '1', 
          evermarkId: '1', 
          title: 'Test Evermark',
          rank: 1,
          totalVotes: BigInt(100),
          voteCount: 10,
          percentageOfTotal: 50,
          creator: 'Test Creator',
          createdAt: new Date().toISOString(),
          description: 'Test Description',
          contentType: 'URL',
          verified: false,
          tags: [],
          change: { direction: 'same', positions: 0 }
        })}
        data-testid="mock-evermark-click"
      >
        Click Evermark
      </button>
    </div>
  ))
}))

vi.mock('./SeasonSelector', () => ({
  SeasonSelector: vi.fn(({ selectedSeason, onSeasonChange, className }) => (
    <div data-testid="season-selector" className={className}>
      Season Selector - Selected: {selectedSeason}
      <button 
        onClick={() => onSeasonChange(3)}
        data-testid="select-season-3"
      >
        Select Season 3
      </button>
    </div>
  ))
}))

// Mock theme provider
vi.mock('../../../providers/ThemeProvider', () => ({
  useTheme: () => ({ isDark: false })
}))

describe('LeaderboardTabs', () => {
  const mockFinalizedSeasons: FinalizedSeason[] = [
    {
      seasonNumber: 3,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-31T23:59:59Z',
      totalVotes: '1000',
      totalEvermarksCount: 10,
      topEvermarkId: '1',
      topEvermarkVotes: '500',
      finalizedAt: '2024-02-01T00:00:00Z',
      duration: 2678400000,
      label: 'Season 3',
      description: '10 evermarks, 1,000 total votes'
    },
    {
      seasonNumber: 2,
      startTime: '2023-12-01T00:00:00Z',
      endTime: '2023-12-31T23:59:59Z',
      totalVotes: '800',
      totalEvermarksCount: 8,
      topEvermarkId: '2',
      topEvermarkVotes: '400',
      finalizedAt: '2024-01-01T00:00:00Z',
      duration: 2678400000,
      label: 'Season 2',
      description: '8 evermarks, 800 total votes'
    }
  ]

  const mockCurrentSeason = {
    seasonNumber: 4,
    startTime: new Date('2024-02-01T00:00:00Z'),
    endTime: new Date('2024-02-29T23:59:59Z'),
    totalVotes: BigInt(1500),
    totalVoters: 25,
    isActive: true,
    activeEvermarksCount: 12
  }

  const mockOnEvermarkClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    vi.mocked(VotingService.getCurrentSeason).mockResolvedValue(mockCurrentSeason)
    vi.mocked(LeaderboardService.getAvailableFinalizedSeasons).mockResolvedValue(mockFinalizedSeasons)
    vi.mocked(LeaderboardService.getFinalizedLeaderboard).mockResolvedValue({
      entries: [],
      totalCount: 0,
      totalPages: 1,
      currentPage: 1,
      pageSize: 50,
      hasNextPage: false,
      hasPreviousPage: false,
      lastUpdated: new Date(),
      filters: {}
    })
    vi.mocked(LeaderboardService.formatVoteAmount).mockImplementation((amount) => amount.toString())
  })

  it('should render tab navigation with current and final tabs', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Current Season: 4/)).toBeInTheDocument()
      expect(screen.getByText('Final Results')).toBeInTheDocument()
    })
  })

  it('should start with current season tab active', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    await waitFor(() => {
      const currentTab = screen.getByText(/Current Season: 4/).closest('button')
      const finalTab = screen.getByText('Final Results').closest('button')
      
      expect(currentTab).toHaveClass('bg-app-bg-primary')
      expect(finalTab).not.toHaveClass('bg-app-bg-primary')
    })
  })

  it('should show leaderboard table in current season tab', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-table')).toBeInTheDocument()
      expect(screen.getByTestId('has-filters')).toBeInTheDocument()
      expect(screen.getByTestId('has-pagination')).toBeInTheDocument()
    })
  })

  it('should switch to final results tab when clicked', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    await waitFor(() => {
      const finalTab = screen.getByText('Final Results').closest('button')
      fireEvent.click(finalTab!)
    })

    await waitFor(() => {
      expect(screen.getByTestId('season-selector')).toBeInTheDocument()
      expect(screen.getByText('Select Finalized Season')).toBeInTheDocument()
    })
  })

  it('should show season count badge on final results tab', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    await waitFor(() => {
      const badge = screen.getByText('2')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-app-brand-primary')
    })
  })

  it('should display season selector when final tab is active', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    // Switch to final tab
    await waitFor(() => {
      const finalTab = screen.getByText('Final Results').closest('button')
      fireEvent.click(finalTab!)
    })

    await waitFor(() => {
      expect(screen.getByTestId('season-selector')).toBeInTheDocument()
      expect(screen.getByText('2 seasons available')).toBeInTheDocument()
    })
  })

  it('should handle season selection change', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    // Switch to final tab
    await waitFor(() => {
      const finalTab = screen.getByText('Final Results').closest('button')
      fireEvent.click(finalTab!)
    })

    // Select a season
    await waitFor(() => {
      const selectButton = screen.getByTestId('select-season-3')
      fireEvent.click(selectButton)
    })

    // Should update the selected season in the selector
    await waitFor(() => {
      expect(screen.getByText('Season Selector - Selected: 3')).toBeInTheDocument()
    })
  })

  it('should show loading state when fetching current season', () => {
    vi.mocked(VotingService.getCurrentSeason).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockCurrentSeason), 100)))
    
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    expect(screen.getByText('Current Season')).toBeInTheDocument()
  })

  it('should handle no finalized seasons available', async () => {
    vi.mocked(LeaderboardService.getAvailableFinalizedSeasons).mockResolvedValue([])
    
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    // Switch to final tab
    await waitFor(() => {
      const finalTab = screen.getByText('Final Results').closest('button')
      fireEvent.click(finalTab!)
    })

    await waitFor(() => {
      expect(screen.getByText('No finalized seasons yet')).toBeInTheDocument()
      expect(screen.getByText('Final results will appear here when seasons are completed and finalized')).toBeInTheDocument()
    })
  })

  it('should forward evermark click events', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    await waitFor(() => {
      const clickButton = screen.getByTestId('mock-evermark-click')
      fireEvent.click(clickButton)
    })

    expect(mockOnEvermarkClick).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      evermarkId: '1',
      title: 'Test Evermark'
    }))
  })

  it('should handle current season fetch error gracefully', async () => {
    vi.mocked(VotingService.getCurrentSeason).mockRejectedValue(new Error('Network error'))
    
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    await waitFor(() => {
      // Should fall back to default season number
      expect(screen.getByText(/Current Season/)).toBeInTheDocument()
    })
  })

  it('should show active indicator for current season', async () => {
    render(<LeaderboardTabs onEvermarkClick={mockOnEvermarkClick} />)
    
    await waitFor(() => {
      const activeIndicator = document.querySelector('.animate-pulse')
      expect(activeIndicator).toBeInTheDocument()
    })
  })

  it('should apply custom className', () => {
    const customClass = 'custom-test-class'
    render(<LeaderboardTabs className={customClass} onEvermarkClick={mockOnEvermarkClick} />)
    
    const container = document.querySelector(`.${customClass}`)
    expect(container).toBeInTheDocument()
  })
})