import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DevDashboardPage from './DevDashboardPage'

// Mock the WalletBalanceDashboard component
vi.mock('../components/dev/WalletBalanceTracker', () => ({
  WalletBalanceDashboard: vi.fn(() => <div data-testid="wallet-balance-dashboard">Mock Wallet Balance Dashboard</div>)
}))

// Mock the wallet address hook
vi.mock('../hooks/core/useWalletAccount', () => ({
  useWalletAddress: vi.fn(() => '0x3427b4716B90C11F9971e43999a48A47Cf5B571E') // Return dev wallet address
}))

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
      },
    },
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('DevDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the page header correctly', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(screen.getByText('Development Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Real-time monitoring of Evermark protocol fee flows and development funding.')).toBeInTheDocument()
  })

  it('should render the WalletBalanceDashboard component', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(screen.getByTestId('wallet-balance-dashboard')).toBeInTheDocument()
    expect(screen.getByText('Mock Wallet Balance Dashboard')).toBeInTheDocument()
  })

  it('should render stats cards', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(screen.getByText('Minting Stats')).toBeInTheDocument()
    expect(screen.getByText('Referral Activity')).toBeInTheDocument()
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
  })

  it('should show placeholder values in stats', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    // Check for placeholder values
    const placeholders = screen.getAllByText('--')
    expect(placeholders.length).toBeGreaterThan(0)

    // There are multiple "-- ETH" texts, so use getAllByText
    const ethPlaceholders = screen.getAllByText('-- ETH')
    expect(ethPlaceholders.length).toBeGreaterThan(0)
    
    expect(screen.getByText('--%')).toBeInTheDocument()
  })

  it('should render contract links', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    const evermarkNftLink = screen.getByText('EvermarkNFT Contract')
    const feeCollectorLink = screen.getByText('FeeCollector Contract')
    const devWalletLink = screen.getByText('Development Wallet')
    const evermarkRewardsLink = screen.getByText('EvermarkRewards Contract')

    expect(evermarkNftLink).toBeInTheDocument()
    expect(feeCollectorLink).toBeInTheDocument()
    expect(devWalletLink).toBeInTheDocument()
    expect(evermarkRewardsLink).toBeInTheDocument()

    // Check that they are links
    expect(evermarkNftLink.closest('a')).toHaveAttribute('href', 'https://basescan.org/address/0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2')
    expect(feeCollectorLink.closest('a')).toHaveAttribute('href', 'https://basescan.org/address/0xaab93405679576ec743fDAA57AA603D949850604')
    expect(devWalletLink.closest('a')).toHaveAttribute('href', 'https://basescan.org/address/0x3427b4716B90C11F9971e43999a48A47Cf5B571E')
    expect(evermarkRewardsLink.closest('a')).toHaveAttribute('href', 'https://basescan.org/address/0x88E5C57FFC8De966eD789ebd5A8E3B290Ed2B55C')
  })

  it('should render fee structure summary', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(screen.getByText('Fee Structure Summary')).toBeInTheDocument()
    expect(screen.getByText('Minting Fee (0.00007 ETH)')).toBeInTheDocument()
    expect(screen.getByText('Important Notes')).toBeInTheDocument()
  })

  it('should show fee structure details', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(screen.getByText('• Anti-spam mechanism')).toBeInTheDocument()
    expect(screen.getByText('• Development cost funding')).toBeInTheDocument()
    expect(screen.getByText('• Server maintenance')).toBeInTheDocument()
    expect(screen.getByText('• Infrastructure improvements')).toBeInTheDocument()
  })

  it('should show important notes about fee structure', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(screen.getByText('• Separate from staking rewards')).toBeInTheDocument()
    expect(screen.getByText('• Not part of community treasury')).toBeInTheDocument()
    expect(screen.getByText('• Direct development funding')).toBeInTheDocument()
    expect(screen.getByText('• Transparent on-chain flow')).toBeInTheDocument()
  })

  it('should render with proper layout classes', () => {
    const { container } = render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(container.querySelector('.container')).toBeInTheDocument()
    expect(container.querySelector('.mx-auto')).toBeInTheDocument()
    expect(container.querySelector('.max-w-6xl')).toBeInTheDocument()
  })

  it('should render grid layouts correctly', () => {
    const { container } = render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    // Check for grid layouts
    const gridElements = container.querySelectorAll('.grid')
    expect(gridElements.length).toBeGreaterThan(0)
  })

  it('should show connection hints for live data', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(screen.getByText('Connect to database for live stats')).toBeInTheDocument()
    expect(screen.getByText('Based on on-chain referral events')).toBeInTheDocument()
  })

  it('should render all external links with correct attributes', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    const externalLinks = screen.getAllByRole('link')
    
    externalLinks.forEach(link => {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link.getAttribute('href')).toMatch(/^https:\/\/basescan\.org\/address\/0x[a-fA-F0-9]{40}$/)
    })
  })

  it('should display proper color-coded buttons', () => {
    const { container } = render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    const blueButton = container.querySelector('.bg-blue-600')
    const purpleButton = container.querySelector('.bg-purple-600')
    const greenButton = container.querySelector('.bg-green-600')

    expect(blueButton).toBeInTheDocument()
    expect(purpleButton).toBeInTheDocument()
    expect(greenButton).toBeInTheDocument()
  })

  it('should render responsive design classes', () => {
    const { container } = render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    // Check for responsive grid classes
    expect(container.querySelector('.md\\:grid-cols-2')).toBeInTheDocument()
    expect(container.querySelector('.lg\\:grid-cols-3')).toBeInTheDocument()
  })

  it('should render the deposit section with correct content', () => {
    render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    expect(screen.getByText('💰 Deposit $EMARK to Staking Rewards')).toBeInTheDocument()
    expect(screen.getByText('fundEmarkRewards')).toBeInTheDocument()
    expect(screen.getByText('Open Write Contract Interface →')).toBeInTheDocument()
    
    const depositLink = screen.getByText('Open Write Contract Interface →')
    expect(depositLink.closest('a')).toHaveAttribute('href', 'https://basescan.org/address/0x88E5C57FFC8De966eD789ebd5A8E3B290Ed2B55C#writeContract')
  })

  it('should render orange button for EvermarkRewards contract', () => {
    const { container } = render(<DevDashboardPage />, { wrapper: createTestWrapper() })

    const orangeButton = container.querySelector('.bg-orange-600')
    expect(orangeButton).toBeInTheDocument()
  })
})