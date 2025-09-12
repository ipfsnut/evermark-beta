// Test suite for metadata services
import { ISBNService } from '../ISBNService';
import { DOIService } from '../DOIService';
import { ReadmeService } from '../ReadmeService';

// Helper to run tests manually in the browser console
export async function runMetadataTests() {
  console.log('🧪 Starting Metadata Service Tests...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    errors: [] as string[]
  };

  // Test ISBN Service
  console.log('📚 Testing ISBN Service...');
  try {
    // Test with a known book
    const isbn = '978-0-13-468599-1'; // Clean Code
    console.log(`  Testing ISBN: ${isbn}`);
    
    const bookData = await ISBNService.fetchBookMetadata(isbn);
    
    if (bookData) {
      console.log('  ✅ ISBN fetch successful:', {
        title: bookData.title,
        authors: bookData.authors,
        hasImage: !!bookData.imageUrl
      });
      results.passed++;
    } else {
      console.log('  ❌ ISBN fetch returned null');
      results.failed++;
      results.errors.push('ISBN fetch returned null for valid ISBN');
    }
  } catch (error) {
    console.error('  ❌ ISBN test failed:', error);
    results.failed++;
    results.errors.push(`ISBN test error: ${error}`);
  }

  // Test DOI Service
  console.log('\n📄 Testing DOI Service...');
  try {
    // Test with a known paper
    const doi = '10.1038/nature12373';
    console.log(`  Testing DOI: ${doi}`);
    
    const paperData = await DOIService.fetchPaperMetadata(doi);
    
    if (paperData) {
      console.log('  ✅ DOI fetch successful:', {
        title: paperData.title,
        authors: paperData.authors.length,
        hasAbstract: !!paperData.abstract
      });
      results.passed++;
    } else {
      console.log('  ❌ DOI fetch returned null');
      results.failed++;
      results.errors.push('DOI fetch returned null for valid DOI');
    }
  } catch (error) {
    console.error('  ❌ DOI test failed:', error);
    results.failed++;
    results.errors.push(`DOI test error: ${error}`);
  }

  // Test README Service
  console.log('\n📖 Testing README Service...');
  try {
    // Test with a sample README book URL
    const readmeUrl = 'https://opensea.io/assets/matic/0x931204fb8cea7f7068995dce924f0d76d571df99/1';
    console.log(`  Testing README URL: ${readmeUrl.substring(0, 50)}...`);
    
    const isReadmeBook = ReadmeService.isReadmeBook(readmeUrl);
    console.log(`  Is README book: ${isReadmeBook}`);
    
    if (isReadmeBook) {
      const readmeData = await ReadmeService.fetchReadmeMetadata(readmeUrl);
      
      if (readmeData) {
        console.log('  ✅ README fetch successful:', {
          hasBookTitle: !!readmeData.bookTitle,
          hasAuthor: !!readmeData.bookAuthor,
          hasImage: !!readmeData.image
        });
        results.passed++;
      } else {
        console.log('  ❌ README fetch returned null');
        results.failed++;
        results.errors.push('README fetch returned null for valid URL');
      }
    } else {
      console.log('  ⚠️ URL not recognized as README book');
      results.failed++;
      results.errors.push('README URL not recognized');
    }
  } catch (error) {
    console.error('  ❌ README test failed:', error);
    results.failed++;
    results.errors.push(`README test error: ${error}`);
  }

  // Summary
  console.log('\n📊 Test Results:');
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('  Errors:');
    results.errors.forEach(err => console.log(`    - ${err}`));
  }

  return results;
}

// Function to test the wizard integration
export async function testWizardIntegration() {
  console.log('🧙 Testing Wizard Integration...\n');
  
  // Check if services are imported correctly
  console.log('Checking service imports:');
  console.log('  ISBNService:', typeof ISBNService);
  console.log('  DOIService:', typeof DOIService);
  console.log('  ReadmeService:', typeof ReadmeService);
  
  // Check if methods exist
  console.log('\nChecking service methods:');
  console.log('  ISBNService.fetchBookMetadata:', typeof ISBNService.fetchBookMetadata);
  console.log('  DOIService.fetchPaperMetadata:', typeof DOIService.fetchPaperMetadata);
  console.log('  ReadmeService.fetchReadmeMetadata:', typeof ReadmeService.fetchReadmeMetadata);
  
  return true;
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).runMetadataTests = runMetadataTests;
  (window as any).testWizardIntegration = testWizardIntegration;
  console.log('💡 Test functions available in console:');
  console.log('  - runMetadataTests()');
  console.log('  - testWizardIntegration()');
}