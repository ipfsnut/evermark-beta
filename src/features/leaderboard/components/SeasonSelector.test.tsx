import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SeasonSelector } from './SeasonSelector'
import type { FinalizedSeason } from '../services/LeaderboardService'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock theme provider
vi.mock('../../../providers/ThemeProvider', () => ({
  useTheme: () => ({ isDark: false })
}))

// Mock formatters
vi.mock('../../../utils/formatters', () => ({
  Formatters: {
    formatDate: vi.fn((date) => date.toLocaleDateString()),
    formatRelativeTime: vi.fn((date) => 'a few days ago')
  }
}))

describe('SeasonSelector', () => {
  const mockSeasons: FinalizedSeason[] = [
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
    },
    {
      seasonNumber: 1,
      startTime: '2023-11-01T00:00:00Z',
      endTime: '2023-11-30T23:59:59Z',
      totalVotes: '600',
      totalEvermarksCount: 6,
      topEvermarkId: '3',
      topEvermarkVotes: '300',
      finalizedAt: '2023-12-01T00:00:00Z',
      duration: 2592000000,
      label: 'Season 1',
      description: '6 evermarks, 600 total votes'
    }
  ]

  const mockOnSeasonChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        seasons: mockSeasons
      })
    })
  })

  it('should render loading state initially', () => {
    // Mock fetch to never resolve to keep loading state
    mockFetch.mockImplementation(() => new Promise(() => {}))
    
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('should fetch and display available seasons', async () => {
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/finalized-seasons')
    })

    await waitFor(() => {
      expect(screen.getByText('Select Season')).toBeInTheDocument()
    })
  })

  it('should display selected season when provided', async () => {
    render(<SeasonSelector selectedSeason={3} onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      expect(screen.getByText('Season 3')).toBeInTheDocument()
      expect(screen.getByText('10 evermarks, 1,000 total votes')).toBeInTheDocument()
    })
  })

  it('should open dropdown when clicked', async () => {
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      fireEvent.click(dropdownButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Season 3')).toBeInTheDocument()
      expect(screen.getByText('Season 2')).toBeInTheDocument()
      expect(screen.getByText('Season 1')).toBeInTheDocument()
    })
  })

  it('should display season details in dropdown', async () => {
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      fireEvent.click(dropdownButton)
    })

    await waitFor(() => {
      // Check for season stats
      expect(screen.getByText('10 evermarks')).toBeInTheDocument()
      expect(screen.getByText('1,000 votes')).toBeInTheDocument()
      expect(screen.getByText('8 evermarks')).toBeInTheDocument()
      expect(screen.getByText('800 votes')).toBeInTheDocument()
    })
  })

  it('should call onSeasonChange when season is selected', async () => {
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    // Open dropdown
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      fireEvent.click(dropdownButton)
    })

    // Click on Season 2
    await waitFor(() => {
      const season2Button = screen.getByText('Season 2').closest('button')
      fireEvent.click(season2Button!)
    })

    expect(mockOnSeasonChange).toHaveBeenCalledWith(2)
  })

  it('should close dropdown after selection', async () => {
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    // Open dropdown
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      fireEvent.click(dropdownButton)
    })

    // Select a season
    await waitFor(() => {
      const season1Button = screen.getByText('Season 1').closest('button')
      fireEvent.click(season1Button!)
    })

    // Dropdown should close (check that dropdown items are no longer visible)
    await waitFor(() => {
      const dropdownMenu = document.querySelector('[role="button"]')?.parentElement?.querySelector('.absolute')
      expect(dropdownMenu).not.toBeInTheDocument()
    })
  })

  it('should show selected indicator for current selection', async () => {
    render(<SeasonSelector selectedSeason={2} onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      fireEvent.click(dropdownButton)
    })

    await waitFor(() => {
      // Look for the selected indicator (colored dot)
      const selectedIndicator = document.querySelector('.bg-app-brand-primary.rounded-full')
      expect(selectedIndicator).toBeInTheDocument()
    })
  })

  it('should handle fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      expect(screen.getByText('No finalized seasons available')).toBeInTheDocument()
    })
  })

  it('should handle empty seasons response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        seasons: []
      })
    })
    
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      expect(screen.getByText('No finalized seasons available')).toBeInTheDocument()
    })
  })

  it('should handle HTTP error response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500
    })
    
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch seasons: 500/)).toBeInTheDocument()
    })
  })

  it('should be disabled when disabled prop is true', async () => {
    render(<SeasonSelector disabled={true} onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      expect(dropdownButton).toBeDisabled()
      expect(dropdownButton).toHaveClass('opacity-50', 'cursor-not-allowed')
    })
  })

  it('should not open dropdown when disabled', async () => {
    render(<SeasonSelector disabled={true} onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      fireEvent.click(dropdownButton)
    })

    // Should not show dropdown menu
    expect(document.querySelector('.absolute')).not.toBeInTheDocument()
  })

  it('should close dropdown when clicking backdrop', async () => {
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    // Open dropdown
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      fireEvent.click(dropdownButton)
    })

    // Click backdrop
    await waitFor(() => {
      const backdrop = document.querySelector('.fixed.inset-0')
      fireEvent.click(backdrop!)
    })

    // Dropdown should close
    await waitFor(() => {
      expect(document.querySelector('.absolute')).not.toBeInTheDocument()
    })
  })

  it('should apply custom className', async () => {
    const customClass = 'test-custom-class'
    render(<SeasonSelector className={customClass} onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      const container = document.querySelector(`.${customClass}`)
      expect(container).toBeInTheDocument()
    })
  })

  it('should display formatted dates correctly', async () => {
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    await waitFor(() => {
      const dropdownButton = screen.getByRole('button')
      fireEvent.click(dropdownButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Finalized a few days ago')).toBeInTheDocument()
    })
  })

  it('should show chevron rotation when dropdown is open', async () => {
    render(<SeasonSelector onSeasonChange={mockOnSeasonChange} />)
    
    const dropdownButton = screen.getByRole('button')
    const chevron = dropdownButton.querySelector('.lucide-chevron-down')
    
    // Initially not rotated
    expect(chevron).not.toHaveClass('rotate-180')
    
    // Open dropdown
    fireEvent.click(dropdownButton)
    
    await waitFor(() => {
      expect(chevron).toHaveClass('rotate-180')
    })
  })
})