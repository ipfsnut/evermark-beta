import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock ThemeProvider
vi.mock('@/providers/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    isDark: true,
    isLight: false,
  }),
  useThemeClasses: () => ({
    bg: {
      primary: 'bg-gray-900',
      secondary: 'bg-gray-800',
    },
    text: {
      primary: 'text-white',
      secondary: 'text-gray-300',
    },
  }),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })),
    useMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      isLoading: false,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
    })),
  }
})

vi.mock('thirdweb', () => ({
  createThirdwebClient: vi.fn(() => ({ clientId: 'test' })),
  defineChain: vi.fn((id) => ({ id })),
  getContract: vi.fn(),
  prepareContractCall: vi.fn(),
  sendTransaction: vi.fn(),
  waitForReceipt: vi.fn(),
  readContract: vi.fn(),
}))

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  })),
  useConnect: vi.fn(() => ({ connect: vi.fn() })),
  useDisconnect: vi.fn(() => ({ disconnect: vi.fn() })),
  useSignMessage: vi.fn(() => ({ signMessageAsync: vi.fn() })),
  useWalletClient: vi.fn(),
  usePublicClient: vi.fn(),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})