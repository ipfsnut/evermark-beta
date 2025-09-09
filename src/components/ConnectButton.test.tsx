// src/components/ConnectButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WalletConnect, SimpleConnectButton } from './ConnectButton'

// Mock dependencies
vi.mock('thirdweb/react', () => ({
  ConnectButton: ({ connectButton }: any) => (
    <button className={connectButton.className}>
      {connectButton.label}
    </button>
  )
}))

vi.mock('thirdweb/wallets', () => ({
  createWallet: vi.fn((id) => ({ id })),
  inAppWallet: vi.fn(() => ({ id: 'inApp' }))
}))

vi.mock('@/lib/thirdweb', () => ({
  client: {}
}))

vi.mock('@/lib/contracts', () => ({
  CHAIN: {}
}))

vi.mock('../providers/WalletProvider', () => ({
  useWallet: vi.fn()
}))

vi.mock('@/providers/AppContext', () => ({
  useAppAuth: vi.fn()
}))

vi.mock('@/providers/ThemeProvider', () => ({
  useThemeClasses: vi.fn()
}))

vi.mock('./ui/UserAvatar', () => ({
  UserAvatar: ({ address, size }: any) => (
    <div data-testid="user-avatar" data-address={address} data-size={size}>
      Avatar
    </div>
  )
}))

describe('WalletConnect Component', () => {
  const mockThemeClasses = {
    bg: { card: 'bg-white' },
    border: { primary: 'border-gray-200' },
    text: { primary: 'text-gray-900', muted: 'text-gray-500' }
  }

  const mockDisconnect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    const { useWallet } = vi.importMock('../providers/WalletProvider')
    const { useAppAuth } = vi.importMock('@/providers/AppContext')
    const { useThemeClasses } = vi.importMock('@/providers/ThemeProvider')
    
    vi.mocked(useThemeClasses).mockReturnValue(mockThemeClasses)
    vi.mocked(useAppAuth).mockReturnValue({
      user: null,
      isAuthenticated: false
    })
    vi.mocked(useWallet).mockReturnValue({
      address: null,
      isConnected: false,
      context: 'browser',
      disconnect: mockDisconnect
    })
  })

  describe('when wallet is not connected', () => {
    it('should render connect button for browser context', () => {
      render(<WalletConnect />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Connect Wallet')
      expect(button.querySelector('svg')).toBeInTheDocument() // WalletIcon
    })

    it('should render sign in button for PWA context', async () => {
      const { useWallet } = await import('../providers/WalletProvider')
      vi.mocked(useWallet).mockReturnValueOnce({
        address: null,
        isConnected: false,
        context: 'pwa',
        disconnect: mockDisconnect
      })

      render(<WalletConnect />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Sign In')
    })

    it('should render connecting state for Farcaster context', async () => {
      const { useWallet } = await import('../providers/WalletProvider')
      vi.mocked(useWallet).mockReturnValueOnce({
        address: null,
        isConnected: false,
        context: 'farcaster',
        disconnect: mockDisconnect
      })

      render(<WalletConnect />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Connecting...')
    })

    it('should apply custom className', () => {
      render(<WalletConnect className="custom-class" />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('when wallet is connected', () => {
    const mockAddress = '0x1234567890123456789012345678901234567890'
    
    beforeEach(async () => {
      const { useWallet } = await import('../providers/WalletProvider')
      vi.mocked(useWallet).mockReturnValue({
        address: mockAddress,
        isConnected: true,
        context: 'browser',
        disconnect: mockDisconnect
      })
    })

    it('should render user info with address', () => {
      render(<WalletConnect />)
      
      expect(screen.getByText('0x1234...7890')).toBeInTheDocument()
      expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('should render user display name when available', async () => {
      const { useAppAuth } = await import('@/providers/AppContext')
      vi.mocked(useAppAuth).mockReturnValueOnce({
        user: {
          displayName: 'John Doe',
          username: 'johndoe',
          avatar: 'https://example.com/avatar.jpg'
        },
        isAuthenticated: true
      })

      render(<WalletConnect />)
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.queryByText('0x1234...7890')).not.toBeInTheDocument()
    })

    it('should call disconnect when clicking on username', () => {
      render(<WalletConnect />)
      
      const usernameButton = screen.getByText('0x1234...7890')
      fireEvent.click(usernameButton)
      
      expect(mockDisconnect).toHaveBeenCalledOnce()
    })

    it('should render compact variant correctly', async () => {
      render(<WalletConnect variant="compact" />)
      
      expect(screen.getByText('0x1234...7890')).toBeInTheDocument()
      expect(screen.getByTestId('user-avatar')).toHaveAttribute('data-size', 'xs')
      expect(screen.queryByText('Connected')).not.toBeInTheDocument() // No auth type in compact mode
    })

    it('should handle Farcaster context properly', async () => {
      const { useWallet } = await import('../providers/WalletProvider')
      vi.mocked(useWallet).mockReturnValueOnce({
        address: mockAddress,
        isConnected: true,
        context: 'farcaster',
        disconnect: mockDisconnect
      })

      render(<WalletConnect />)
      
      expect(screen.getByText('Farcaster')).toBeInTheDocument()
    })
  })
})

describe('SimpleConnectButton Component', () => {
  const mockThemeClasses = {
    bg: { card: 'bg-white' },
    border: { primary: 'border-gray-200' },
    text: { primary: 'text-gray-900', muted: 'text-gray-500' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    const { useWallet } = vi.importMock('../providers/WalletProvider')
    const { useAppAuth } = vi.importMock('@/providers/AppContext')
    const { useThemeClasses } = vi.importMock('@/providers/ThemeProvider')
    
    vi.mocked(useThemeClasses).mockReturnValue(mockThemeClasses)
    vi.mocked(useAppAuth).mockReturnValue({
      user: null,
      isAuthenticated: false
    })
    vi.mocked(useWallet).mockReturnValue({
      address: null,
      isConnected: false,
      context: 'browser',
      disconnect: vi.fn()
    })
  })

  it('should render WalletConnect when not connected', () => {
    render(<SimpleConnectButton />)
    
    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('Connect Wallet')
  })

  it('should show simple connected state when connected', async () => {
    const mockAddress = '0x1234567890123456789012345678901234567890'
    const { useWallet } = await import('../providers/WalletProvider')
    vi.mocked(useWallet).mockReturnValueOnce({
      address: mockAddress,
      isConnected: true,
      context: 'browser',
      disconnect: vi.fn()
    })

    render(<SimpleConnectButton />)
    
    expect(screen.getByText('0x1234...7890')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(<SimpleConnectButton className="simple-custom" />)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('simple-custom')
  })
})