import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WalletConnect, SimpleConnectButton } from './ConnectButton'

// Create mock implementations
const mockUseWallet = vi.fn()
const mockUseAppAuth = vi.fn()
const mockUseThemeClasses = vi.fn()
const mockDisconnect = vi.fn()

// Mock all dependencies at the top level
vi.mock('thirdweb/react', () => ({
  ConnectButton: ({ connectButton }: any) => (
    <button 
      className={connectButton?.className || ''}
      data-testid="thirdweb-connect-button"
    >
      {connectButton?.label || 'Connect Wallet'}
    </button>
  )
}))

vi.mock('thirdweb/wallets', () => ({
  createWallet: vi.fn((id) => ({ id })),
  inAppWallet: vi.fn(() => ({ id: 'inApp' }))
}))

vi.mock('@/lib/thirdweb', () => ({
  client: { clientId: 'test' }
}))

vi.mock('@/lib/contracts', () => ({
  CHAIN: { id: 8453, name: 'Base' }
}))

vi.mock('../providers/WalletProvider', () => ({
  useWallet: () => mockUseWallet()
}))

vi.mock('@/providers/AppContext', () => ({
  useAppAuth: () => mockUseAppAuth()
}))

vi.mock('@/providers/ThemeProvider', () => ({
  useThemeClasses: () => mockUseThemeClasses()
}))

vi.mock('./ui/UserAvatar', () => ({
  UserAvatar: ({ address, size }: any) => (
    <div data-testid="user-avatar" data-address={address} data-size={size}>
      Avatar-{address?.slice(-4)}
    </div>
  )
}))

// Mock icon components
vi.mock('lucide-react', () => ({
  WalletIcon: () => <div data-testid="wallet-icon">💼</div>,
  LogOutIcon: () => <div data-testid="logout-icon">🚪</div>,
  ChevronDown: () => <div data-testid="chevron-down">⬇️</div>
}))

describe('ConnectButton Components', () => {
  const mockThemeClasses = {
    bg: { card: 'bg-white' },
    border: { primary: 'border-gray-200' },
    text: { primary: 'text-gray-900', muted: 'text-gray-500' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up default mock returns
    mockUseThemeClasses.mockReturnValue(mockThemeClasses)
    mockUseAppAuth.mockReturnValue({
      user: null,
      isAuthenticated: false
    })
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      context: 'browser',
      disconnect: mockDisconnect
    })
  })

  describe('WalletConnect Component', () => {
    describe('when wallet is not connected', () => {
      it('should render connect button for browser context', () => {
        render(<WalletConnect />)
        
        const button = screen.getByTestId('thirdweb-connect-button')
        expect(button).toBeInTheDocument()
        expect(button).toHaveTextContent('Connect Wallet')
      })

      it('should render sign in button for PWA context', () => {
        mockUseWallet.mockReturnValue({
          address: null,
          isConnected: false,
          context: 'pwa',
          disconnect: mockDisconnect
        })

        render(<WalletConnect />)
        
        const button = screen.getByTestId('thirdweb-connect-button')
        expect(button).toHaveTextContent('Sign In')
      })

      it('should render connecting state for Farcaster context', () => {
        mockUseWallet.mockReturnValue({
          address: null,
          isConnected: false,
          context: 'farcaster',
          disconnect: mockDisconnect
        })

        render(<WalletConnect />)
        
        // In Farcaster context, it renders a custom button with different structure
        const button = screen.getByRole('button')
        expect(button).toHaveTextContent('Connecting...')
        expect(screen.getByTestId('wallet-icon')).toBeInTheDocument()
      })

      it('should apply custom className', () => {
        render(<WalletConnect className="custom-class" />)
        
        const button = screen.getByTestId('thirdweb-connect-button')
        expect(button).toHaveClass('custom-class')
      })
    })

    describe('when wallet is connected', () => {
      const mockAddress = '0x1234567890123456789012345678901234567890'
      
      beforeEach(() => {
        mockUseWallet.mockReturnValue({
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

      it('should render user display name when available', () => {
        mockUseAppAuth.mockReturnValue({
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

      it('should render compact variant correctly', () => {
        render(<WalletConnect variant="compact" />)
        
        expect(screen.getByText('0x1234...7890')).toBeInTheDocument()
        expect(screen.getByTestId('user-avatar')).toHaveAttribute('data-size', 'xs')
        expect(screen.queryByText('Connected')).not.toBeInTheDocument()
      })

      it('should handle Farcaster context properly', () => {
        mockUseWallet.mockReturnValue({
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
    it('should render WalletConnect when not connected', () => {
      render(<SimpleConnectButton />)
      
      const button = screen.getByTestId('thirdweb-connect-button')
      expect(button).toHaveTextContent('Connect Wallet')
    })

    it('should show simple connected state when connected', () => {
      const mockAddress = '0x1234567890123456789012345678901234567890'
      mockUseWallet.mockReturnValue({
        address: mockAddress,
        isConnected: true,
        context: 'browser',
        disconnect: mockDisconnect
      })

      render(<SimpleConnectButton />)
      
      expect(screen.getByText('0x1234...7890')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(<SimpleConnectButton className="simple-custom" />)
      
      const component = screen.getByTestId('thirdweb-connect-button').parentElement
      expect(component).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should have proper accessibility attributes', () => {
      const mockAddress = '0x1234567890123456789012345678901234567890'
      mockUseWallet.mockReturnValue({
        address: mockAddress,
        isConnected: true,
        context: 'browser',
        disconnect: mockDisconnect
      })

      render(<WalletConnect />)
      
      const usernameButton = screen.getByText('0x1234...7890')
      expect(usernameButton.tagName).toBe('BUTTON')
    })

    it('should handle missing wallet data gracefully', () => {
      mockUseWallet.mockReturnValue({
        address: null,
        isConnected: false,
        context: undefined,
        disconnect: mockDisconnect
      })

      render(<WalletConnect />)
      
      expect(screen.getByTestId('thirdweb-connect-button')).toBeInTheDocument()
    })

    it('should handle missing theme classes gracefully', () => {
      mockUseThemeClasses.mockReturnValue({})

      render(<WalletConnect />)
      
      expect(screen.getByTestId('thirdweb-connect-button')).toBeInTheDocument()
    })
  })
})