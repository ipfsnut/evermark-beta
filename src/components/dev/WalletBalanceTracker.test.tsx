import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WalletBalanceTracker, WalletBalanceDashboard } from './WalletBalanceTracker'

// Mock wagmi and viem with simple return functions
vi.mock('wagmi', () => ({
  usePublicClient: () => null
}))

vi.mock('viem', () => ({
  formatEther: (value: bigint) => {
    const weiPerEth = BigInt('1000000000000000000')
    const eth = Number(value) / Number(weiPerEth)
    return eth.toString()
  }
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

describe('WalletBalanceTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render wallet information correctly', () => {
    render(
      <WalletBalanceTracker
        walletAddress="0x3427b4716B90C11F9971e43999a48A47Cf5B571E"
        walletName="Test Wallet"
        description="Test wallet description"
      />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByText('Test Wallet')).toBeInTheDocument()
    expect(screen.getByText('Test wallet description')).toBeInTheDocument()
    expect(screen.getByText('0x3427...571E')).toBeInTheDocument()
  })

  it('should show address and refresh interval', () => {
    render(
      <WalletBalanceTracker
        walletAddress="0x3427b4716B90C11F9971e43999a48A47Cf5B571E"
        walletName="Test Wallet"
        refreshInterval={15000}
      />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByText('Updates every 15s')).toBeInTheDocument()
    expect(screen.getByText('Address:')).toBeInTheDocument()
  })

  it('should show balance label', () => {
    render(
      <WalletBalanceTracker
        walletAddress="0x3427b4716B90C11F9971e43999a48A47Cf5B571E"
        walletName="Test Wallet"
      />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByText('Balance:')).toBeInTheDocument()
  })

  it('should show BaseScan links', () => {
    render(
      <WalletBalanceTracker
        walletAddress="0x3427b4716B90C11F9971e43999a48A47Cf5B571E"
        walletName="Test Wallet"
      />,
      { wrapper: createTestWrapper() }
    )

    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    
    links.forEach(link => {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('should render with proper structure', () => {
    const { container } = render(
      <WalletBalanceTracker
        walletAddress="0x3427b4716B90C11F9971e43999a48A47Cf5B571E"
        walletName="Test Wallet"
        description="Test description"
      />,
      { wrapper: createTestWrapper() }
    )

    // Check for main container
    expect(container.querySelector('.bg-white')).toBeInTheDocument()
    expect(container.querySelector('.rounded-lg')).toBeInTheDocument()
    expect(container.querySelector('.shadow')).toBeInTheDocument()
  })
})

describe('WalletBalanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render dashboard with both wallets', () => {
    render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    expect(screen.getByText('Evermark Fee Flow Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Development Wallet')).toBeInTheDocument()
    expect(screen.getByText('Fee Collector')).toBeInTheDocument()
  })

  it('should show correct wallet descriptions', () => {
    render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    expect(screen.getByText(/Final destination for minting fees/)).toBeInTheDocument()
    expect(screen.getByText(/Temporary collection point/)).toBeInTheDocument()
  })

  it('should show fee flow explanation', () => {
    render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    expect(screen.getByText('Fee Flow Explanation')).toBeInTheDocument()
    expect(screen.getByText('User pays 0.00007 ETH minting fee')).toBeInTheDocument()
    expect(screen.getByText('10% goes to referrer (if applicable)')).toBeInTheDocument()
    expect(screen.getByText('90% goes to Fee Collector → Development Wallet')).toBeInTheDocument()
  })

  it('should render correct wallet addresses', () => {
    render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    // Should show truncated addresses
    expect(screen.getByText('0x3427...571E')).toBeInTheDocument() // Development wallet
    expect(screen.getByText('0xaab9...0604')).toBeInTheDocument() // Fee collector
  })

  it('should show fee flow visualization', () => {
    render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    expect(screen.getByText('Funds development costs, server maintenance, anti-spam measures')).toBeInTheDocument()
  })

  it('should render with proper layout', () => {
    const { container } = render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    expect(container.querySelector('.space-y-6')).toBeInTheDocument()
    expect(container.querySelector('.grid')).toBeInTheDocument()
    expect(container.querySelector('.md\\:grid-cols-2')).toBeInTheDocument()
  })

  it('should show proper information box', () => {
    render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    expect(screen.getByText(/Real-time balance tracking/)).toBeInTheDocument()
    expect(screen.getByText(/protocol fee collection/)).toBeInTheDocument()
  })

  it('should contain expected fee flow elements', () => {
    render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    // Check for flow steps
    const flowElements = [
      'User pays 0.00007 ETH minting fee',
      '10% goes to referrer (if applicable)', 
      '90% goes to Fee Collector → Development Wallet',
      'Funds development costs, server maintenance, anti-spam measures'
    ]

    flowElements.forEach(text => {
      expect(screen.getByText(text)).toBeInTheDocument()
    })
  })

  it('should render both wallet tracker components', () => {
    render(<WalletBalanceDashboard />, { wrapper: createTestWrapper() })

    // Both wallet names should be present
    expect(screen.getByText('Development Wallet')).toBeInTheDocument()
    expect(screen.getByText('Fee Collector')).toBeInTheDocument()
    
    // Both descriptions should be present
    expect(screen.getByText(/Final destination for minting fees \(emark\.base\.eth\)/)).toBeInTheDocument()
    expect(screen.getByText(/Temporary collection point that immediately forwards/)).toBeInTheDocument()
  })
})