// Debug functions to test metadata services directly in browser console
import { ISBNService } from './ISBNService';
import { DOIService } from './DOIService';
import { ReadmeService } from './ReadmeService';

// Test ISBN service with real API calls
export async function testISBNDirectly(isbn: string = '978-0-13-468599-1') {
  console.log('🧪 Testing ISBN Service directly...');
  console.log('📚 ISBN:', isbn);
  
  try {
    console.time('ISBN fetch');
    const result = await ISBNService.fetchBookMetadata(isbn);
    console.timeEnd('ISBN fetch');
    
    console.log('📚 Raw result:', result);
    
    if (result) {
      console.log('✅ SUCCESS! Book found:');
      console.log('  Title:', result.title);
      console.log('  Authors:', result.authors);
      console.log('  Description:', result.description?.substring(0, 100) + '...');
      console.log('  Image URL:', result.imageUrl);
      console.log('  Publisher:', result.publisher);
      console.log('  Published:', result.publishedDate);
      
      // Test generated evermark data
      console.log('\n📝 Generated Evermark Data:');
      console.log('  Title:', ISBNService.generateEvermarkTitle(result));
      console.log('  Description:', ISBNService.generateEvermarkDescription(result).substring(0, 200) + '...');
      console.log('  Tags:', ISBNService.generateTags(result));
    } else {
      console.log('❌ No book data found');
    }
    
    return result;
  } catch (error) {
    console.error('❌ ISBN test failed:', error);
    return null;
  }
}

// Test DOI service with real API calls
export async function testDOIDirectly(doi: string = '10.1038/nature12373') {
  console.log('🧪 Testing DOI Service directly...');
  console.log('📄 DOI:', doi);
  
  try {
    console.time('DOI fetch');
    const result = await DOIService.fetchPaperMetadata(doi);
    console.timeEnd('DOI fetch');
    
    console.log('📄 Raw result:', result);
    
    if (result) {
      console.log('✅ SUCCESS! Paper found:');
      console.log('  Title:', result.title);
      console.log('  Authors:', result.authors);
      console.log('  Journal:', result.journal);
      console.log('  Published:', result.publishedDate);
      console.log('  Citations:', result.citations);
      console.log('  Abstract:', result.abstract?.substring(0, 100) + '...');
      
      // Test generated evermark data
      console.log('\n📝 Generated Evermark Data:');
      console.log('  Title:', DOIService.generateEvermarkTitle(result));
      console.log('  Description:', DOIService.generateEvermarkDescription(result).substring(0, 200) + '...');
      console.log('  Tags:', DOIService.generateTags(result));
    } else {
      console.log('❌ No paper data found');
    }
    
    return result;
  } catch (error) {
    console.error('❌ DOI test failed:', error);
    return null;
  }
}

// Test README service
export async function testREADMEDirectly(url: string = 'https://opensea.io/assets/matic/0x931204fb8cea7f7068995dce924f0d76d571df99/1') {
  console.log('🧪 Testing README Service directly...');
  console.log('📖 URL:', url);
  
  try {
    console.time('README fetch');
    const result = await ReadmeService.fetchReadmeMetadata(url);
    console.timeEnd('README fetch');
    
    console.log('📖 Raw result:', result);
    
    if (result) {
      console.log('✅ SUCCESS! README book found:');
      console.log('  Title:', result.bookTitle);
      console.log('  Author:', result.bookAuthor);
      console.log('  Description:', result.description?.substring(0, 100) + '...');
      console.log('  Image:', result.image);
      console.log('  Confidence:', result.confidence);
    } else {
      console.log('❌ No README data found');
    }
    
    return result;
  } catch (error) {
    console.error('❌ README test failed:', error);
    return null;
  }
}

// Test all services
export async function testAllServices() {
  console.log('🧪 Testing all metadata services...\n');
  
  const results = {
    isbn: await testISBNDirectly(),
    doi: await testDOIDirectly(),
    readme: await testREADMEDirectly()
  };
  
  console.log('\n📊 Summary:');
  console.log('  ISBN working:', !!results.isbn);
  console.log('  DOI working:', !!results.doi);
  console.log('  README working:', !!results.readme);
  
  return results;
}

// Quick API connectivity test
export async function testAPIConnectivity() {
  console.log('🌐 Testing API connectivity...');
  
  const tests = [
    { name: 'Google Books', url: 'https://www.googleapis.com/books/v1/volumes?q=isbn:9780134685991' },
    { name: 'CrossRef', url: 'https://api.crossref.org/works/10.1038/nature12373' },
    { name: 'OpenSea', url: 'https://api.opensea.io/api/v1/asset/0x931204fb8cea7f7068995dce924f0d76d571df99/1' }
  ];
  
  for (const test of tests) {
    try {
      console.time(test.name);
      const response = await fetch(test.url);
      console.timeEnd(test.name);
      
      console.log(`${test.name}:`, response.ok ? '✅ OK' : `❌ ${response.status}`);
    } catch (error) {
      console.error(`${test.name}: ❌ FAILED -`, error instanceof Error ? error.message : error);
    }
  }
}

// Make functions available in browser console
if (typeof window !== 'undefined') {
  (window as any).testISBNDirectly = testISBNDirectly;
  (window as any).testDOIDirectly = testDOIDirectly;
  (window as any).testREADMEDirectly = testREADMEDirectly;
  (window as any).testAllServices = testAllServices;
  (window as any).testAPIConnectivity = testAPIConnectivity;
  
  console.log('🔧 Debug functions available:');
  console.log('  testISBNDirectly("978-0-13-468599-1")');
  console.log('  testDOIDirectly("10.1038/nature12373")');
  console.log('  testREADMEDirectly()');
  console.log('  testAllServices()');
  console.log('  testAPIConnectivity()');
}