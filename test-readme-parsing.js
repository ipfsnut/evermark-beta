// Quick test of URL parsing for README books
const testUrl = 'https://opensea.io/item/matic/0x931204fb8cea7f7068995dce924f0d76d571df99/2';

// Test the parsing logic
function parseReadmeUrl(url) {
  // OpenSea patterns: 
  // - opensea.io/assets/matic/[contract]/[tokenId]
  // - opensea.io/item/matic/[contract]/[tokenId]
  const openseaPatterns = [
    /opensea\.io\/assets\/matic\/([0-9a-fA-Fx]+)\/(\d+)/,
    /opensea\.io\/item\/matic\/([0-9a-fA-Fx]+)\/(\d+)/
  ];
  
  for (const pattern of openseaPatterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        contract: match[1].toLowerCase(),
        tokenId: match[2],
        platform: 'opensea'
      };
    }
  }

  return {};
}

function isReadmeBook(url) {
  const readmePatterns = [
    // OpenSea README books (both URL formats)
    /opensea\.io\/(assets|item)\/matic\/0x931204fb8cea7f7068995dce924f0d76d571df99/i,
    // NFT Book Bazaar
    /nftbookbazaar\.com/i,
    // PageDAO mint site
    /mint\.nftbookbazaar\.com/i,
    // Direct contract references
    /0x931204fb8cea7f7068995dce924f0d76d571df99/i
  ];

  return readmePatterns.some(pattern => pattern.test(url));
}

console.log('Testing URL:', testUrl);
console.log('Is README book?', isReadmeBook(testUrl));
console.log('Parsed URL:', parseReadmeUrl(testUrl));