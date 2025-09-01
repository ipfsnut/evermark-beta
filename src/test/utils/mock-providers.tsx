import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

// Mock ThemeProvider
const MockThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mockThemeValue = {
    theme: 'dark' as const,
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    isDark: true,
    isLight: false,
  }
  
  return (
    <div data-testid="mock-theme-provider">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { themeContext: mockThemeValue })
        }
        return child
      })}
    </div>
  )
}

export const createMockQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

export const mockWalletContext = {
  address: '0x1234567890123456789012345678901234567890',
  isConnected: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signMessage: vi.fn(),
}

export const mockBlockchainContext = {
  client: { clientId: 'test' },
  chain: { id: 8453 },
  getEmarkTokenContract: vi.fn(),
  getCardCatalogContract: vi.fn(),
  getEvermarkNFTContract: vi.fn(),
  getEvermarkVotingContract: vi.fn(),
  getEvermarkLeaderboardContract: vi.fn(),
}

export const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = createMockQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <MockThemeProvider>
        {children}
      </MockThemeProvider>
    </QueryClientProvider>
  )
}

export const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createMockQueryClient()
  
  return {
    queryClient,
    ...render(ui, { wrapper: AllTheProviders }),
  }
}