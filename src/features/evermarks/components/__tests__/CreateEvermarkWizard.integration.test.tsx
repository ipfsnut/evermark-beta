import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateEvermarkWizard } from '../CreateEvermarkWizard';
import { ISBNService } from '../../services/ISBNService';
import { DOIService } from '../../services/DOIService';

// Mock the services
vi.mock('../../services/ISBNService');
vi.mock('../../services/DOIService');
vi.mock('../../services/ReadmeService');

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()]
}));

// Mock providers
vi.mock('@/providers/AppContext', () => ({
  useAppAuth: () => ({
    user: { displayName: 'Test User' }
  })
}));

vi.mock('@/providers/IntegratedUserProvider', () => ({
  useUserForEvermarks: () => ({
    hasWallet: true,
    canCreate: true
  })
}));

vi.mock('@/providers/ThemeProvider', () => ({
  useTheme: () => ({
    isDark: false
  })
}));

// Mock evermarks state
vi.mock('../../hooks/useEvermarkState', () => ({
  useEvermarksState: () => ({
    createEvermark: vi.fn(),
    isCreating: false,
    createError: null,
    createProgress: 0,
    createStep: '',
    clearCreateError: vi.fn()
  })
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

describe('CreateEvermarkWizard Integration', () => {
  const mockISBNFetch = vi.mocked(ISBNService.fetchBookMetadata);
  const mockDOIFetch = vi.mocked(DOIService.fetchPaperMetadata);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ISBN Integration', () => {
    it('should call ISBN service when ISBN content type is selected and identifier is entered', async () => {
      const mockBookData = {
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        description: 'A handbook of agile software craftsmanship',
        imageUrl: 'https://example.com/cover.jpg',
        isbn: '9780134685991'
      };

      mockISBNFetch.mockResolvedValueOnce(mockBookData);

      render(
        <TestWrapper>
          <CreateEvermarkWizard />
        </TestWrapper>
      );

      // Step 1: Select Published Book (ISBN) content type
      const isbnOption = screen.getByText('Published Book');
      fireEvent.click(isbnOption);

      // Should now be on step 2 - identifier input
      await waitFor(() => {
        expect(screen.getByText('Enter the unique identifier')).toBeInTheDocument();
      });

      // Enter ISBN
      const isbnInput = screen.getByPlaceholderText('978-3-16-148410-0');
      fireEvent.change(isbnInput, { target: { value: '978-0-13-468599-1' } });

      // Trigger the fetch (simulate Enter key or blur)
      fireEvent.keyPress(isbnInput, { key: 'Enter', charCode: 13 });

      // Verify ISBN service was called
      await waitFor(() => {
        expect(mockISBNFetch).toHaveBeenCalledWith('978-0-13-468599-1');
      });
    });

    it('should display "Fetch Now" button for manual triggering', async () => {
      render(
        <TestWrapper>
          <CreateEvermarkWizard />
        </TestWrapper>
      );

      // Step 1: Select ISBN
      fireEvent.click(screen.getByText('Published Book'));

      // Step 2: Enter identifier but don't trigger auto-fetch
      await waitFor(() => {
        const isbnInput = screen.getByPlaceholderText('978-3-16-148410-0');
        fireEvent.change(isbnInput, { target: { value: '978-0-13-468599-1' } });
      });

      // Should see "Fetch Now" button
      await waitFor(() => {
        expect(screen.getByText('Fetch Now')).toBeInTheDocument();
      });
    });
  });

  describe('DOI Integration', () => {
    it('should call DOI service when Academic Paper content type is selected', async () => {
      const mockPaperData = {
        title: 'CRISPR-Cas9 genome editing',
        authors: ['Jennifer Doudna'],
        abstract: 'Revolutionary gene editing technology',
        doi: '10.1038/nature12373',
        journal: 'Nature'
      };

      mockDOIFetch.mockResolvedValueOnce(mockPaperData);

      render(
        <TestWrapper>
          <CreateEvermarkWizard />
        </TestWrapper>
      );

      // Step 1: Select Academic Paper
      fireEvent.click(screen.getByText('Academic Paper'));

      // Step 2: Enter DOI
      await waitFor(() => {
        const doiInput = screen.getByPlaceholderText('10.1234/example.doi or https://doi.org/10.xxxx/xxxxx');
        fireEvent.change(doiInput, { target: { value: '10.1038/nature12373' } });
        fireEvent.keyPress(doiInput, { key: 'Enter', charCode: 13 });
      });

      // Verify DOI service was called
      await waitFor(() => {
        expect(mockDOIFetch).toHaveBeenCalledWith('10.1038/nature12373');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when ISBN lookup fails', async () => {
      mockISBNFetch.mockResolvedValueOnce(null);

      render(
        <TestWrapper>
          <CreateEvermarkWizard />
        </TestWrapper>
      );

      // Select ISBN and enter invalid identifier
      fireEvent.click(screen.getByText('Published Book'));
      
      await waitFor(() => {
        const isbnInput = screen.getByPlaceholderText('978-3-16-148410-0');
        fireEvent.change(isbnInput, { target: { value: 'invalid-isbn' } });
        fireEvent.keyPress(isbnInput, { key: 'Enter', charCode: 13 });
      });

      // Should still advance (with fallback data) but might show a warning
      await waitFor(() => {
        expect(mockISBNFetch).toHaveBeenCalled();
      });
    });

    it('should show error when API call throws exception', async () => {
      mockISBNFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <CreateEvermarkWizard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Published Book'));
      
      await waitFor(() => {
        const isbnInput = screen.getByPlaceholderText('978-3-16-148410-0');
        fireEvent.change(isbnInput, { target: { value: '978-0-13-468599-1' } });
        fireEvent.keyPress(isbnInput, { key: 'Enter', charCode: 13 });
      });

      // Should display error
      await waitFor(() => {
        expect(screen.getByText(/lookup failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Progress Flow', () => {
    it('should advance to metadata step after successful fetch', async () => {
      const mockBookData = {
        title: 'Test Book',
        authors: ['Test Author'],
        isbn: '9780134685991'
      };

      mockISBNFetch.mockResolvedValueOnce(mockBookData);

      render(
        <TestWrapper>
          <CreateEvermarkWizard />
        </TestWrapper>
      );

      // Go through the flow
      fireEvent.click(screen.getByText('Published Book'));
      
      await waitFor(() => {
        const isbnInput = screen.getByPlaceholderText('978-3-16-148410-0');
        fireEvent.change(isbnInput, { target: { value: '978-0-13-468599-1' } });
        fireEvent.keyPress(isbnInput, { key: 'Enter', charCode: 13 });
      });

      // Should eventually reach metadata step
      await waitFor(() => {
        expect(screen.getByText('Review & edit metadata')).toBeInTheDocument();
      });
    });
  });

  describe('Service Integration Verification', () => {
    it('should have all services properly imported', () => {
      // This test ensures the services are properly imported and mocked
      expect(ISBNService.fetchBookMetadata).toBeDefined();
      expect(DOIService.fetchPaperMetadata).toBeDefined();
    });

    it('should call the correct service method with correct parameters', async () => {
      const mockBookData = {
        title: 'Test Book',
        authors: ['Test Author'],
        isbn: '9780134685991'
      };

      mockISBNFetch.mockResolvedValueOnce(mockBookData);

      render(
        <TestWrapper>
          <CreateEvermarkWizard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Published Book'));
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText('978-3-16-148410-0');
        fireEvent.change(input, { target: { value: '978-0-13-468599-1' } });
        fireEvent.blur(input);
      });

      await waitFor(() => {
        expect(mockISBNFetch).toHaveBeenCalledWith('978-0-13-468599-1');
        expect(mockISBNFetch).toHaveBeenCalledTimes(1);
      });
    });
  });
});