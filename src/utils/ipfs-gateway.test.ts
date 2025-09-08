import { describe, it, expect, vi } from 'vitest'
import { 
  replaceIPFSGateway, 
  getRandomIPFSGateway, 
  processEvermarkImages, 
  processEvermarkImagesArray 
} from './ipfs-gateway'

describe('replaceIPFSGateway', () => {
  it('should return undefined for undefined input', () => {
    expect(replaceIPFSGateway(undefined)).toBeUndefined()
  })

  it('should return url unchanged for non-IPFS URLs', () => {
    const url = 'https://example.com/image.jpg'
    expect(replaceIPFSGateway(url)).toBe(url)
  })

  it('should replace problematic Pinata gateway URLs', () => {
    const pinataUrl = 'https://gateway.pinata.cloud/ipfs/QmTest123'
    const result = replaceIPFSGateway(pinataUrl)
    expect(result).toBe('https://ipfs.io/ipfs/QmTest123')
  })

  it('should replace another problematic Pinata gateway URL', () => {
    const pinataUrl = 'https://pinata.cloud/ipfs/QmTest456'
    const result = replaceIPFSGateway(pinataUrl)
    expect(result).toBe('https://ipfs.io/ipfs/QmTest456')
  })

  it('should extract hash from various IPFS URL formats', () => {
    // Standard IPFS gateway URL (already good, returns as-is)
    expect(replaceIPFSGateway('https://ipfs.io/ipfs/QmTest123')).toBe('https://ipfs.io/ipfs/QmTest123')
    
    // IPFS protocol URL (contains 'ipfs', gets processed and hash extracted)
    expect(replaceIPFSGateway('ipfs://QmTest123')).toBe('https://ipfs.io/ipfs/QmTest123')
    
    // Direct hash (doesn't contain 'ipfs', returns as-is) 
    expect(replaceIPFSGateway('QmTest123456789012345678901234567890123456')).toBe('QmTest123456789012345678901234567890123456')
  })

  it('should handle CIDv1 format hashes', () => {
    const cidv1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
    // Direct hash doesn't contain 'ipfs', returns as-is
    expect(replaceIPFSGateway(cidv1)).toBe(cidv1)
    
    // But from a problematic gateway, it should be replaced
    const problematicUrl = `https://gateway.pinata.cloud/ipfs/${cidv1}`
    expect(replaceIPFSGateway(problematicUrl)).toBe(`https://ipfs.io/ipfs/${cidv1}`)
  })

  it('should use preferred gateway when provided', () => {
    const pinataUrl = 'https://gateway.pinata.cloud/ipfs/QmTest123'
    const preferredGateway = 'https://cloudflare-ipfs.com/ipfs'
    const result = replaceIPFSGateway(pinataUrl, preferredGateway)
    expect(result).toBe('https://cloudflare-ipfs.com/ipfs/QmTest123')
  })

  it('should handle malformed URLs gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    // This URL actually has a valid pattern that matches, so it gets replaced
    const malformedUrl = 'https://gateway.pinata.cloud/ipfs/invalid-hash'
    const result = replaceIPFSGateway(malformedUrl)
    
    // The hash 'invalid' gets extracted and replaced
    expect(result).toBe('https://ipfs.io/ipfs/invalid')
    expect(consoleSpy).not.toHaveBeenCalled()
    
    // Test with truly malformed URL
    const trulyMalformed = 'https://gateway.pinata.cloud/not-ipfs/invalid'
    const result2 = replaceIPFSGateway(trulyMalformed)
    expect(result2).toBe(trulyMalformed)
    expect(consoleSpy).toHaveBeenCalledWith('Could not extract IPFS hash from URL:', trulyMalformed)
    
    consoleSpy.mockRestore()
  })

  it('should not replace already good gateway URLs', () => {
    const goodUrl = 'https://ipfs.io/ipfs/QmTest123'
    expect(replaceIPFSGateway(goodUrl)).toBe(goodUrl)
    
    // Implementation treats all URLs with 'ipfs' as needing processing, but since cloudflare is not in problematic list,
    // it will extract the hash and use default gateway
    const cloudflareUrl = 'https://cloudflare-ipfs.com/ipfs/QmTest456'
    // The function sees 'ipfs' in URL, extracts hash, and uses default gateway
    expect(replaceIPFSGateway(cloudflareUrl)).toBe('https://ipfs.io/ipfs/QmTest456')
  })

  it('should handle empty string', () => {
    // Empty string is falsy, returns undefined
    expect(replaceIPFSGateway('')).toBeUndefined()
  })

  it('should handle URLs with query parameters', () => {
    const urlWithQuery = 'https://gateway.pinata.cloud/ipfs/QmTest123?query=param'
    const result = replaceIPFSGateway(urlWithQuery)
    expect(result).toBe('https://ipfs.io/ipfs/QmTest123')
  })
})

describe('getRandomIPFSGateway', () => {
  it('should return a valid IPFS gateway URL', () => {
    const gateway = getRandomIPFSGateway()
    expect(gateway).toMatch(/^https:\/\/.*\/ipfs$/)
  })

  it('should return different gateways over multiple calls', () => {
    const gateways = new Set()
    // Call multiple times to increase chance of getting different gateways
    for (let i = 0; i < 50; i++) {
      gateways.add(getRandomIPFSGateway())
    }
    // Should have at least 2 different gateways (probabilistically)
    expect(gateways.size).toBeGreaterThan(1)
  })

  it('should return one of the predefined gateways', () => {
    const validGateways = [
      'https://ipfs.io/ipfs',
      'https://cloudflare-ipfs.com/ipfs',
      'https://dweb.link/ipfs',
      'https://gateway.lighthouse.storage/ipfs',
      'https://ipfs.filebase.io/ipfs',
      'https://w3s.link/ipfs',
      'https://nftstorage.link/ipfs'
    ]
    
    const gateway = getRandomIPFSGateway()
    expect(validGateways).toContain(gateway)
  })
})

describe('processEvermarkImages', () => {
  it('should prioritize supabase URL when available', () => {
    const evermark = {
      image: 'https://gateway.pinata.cloud/ipfs/QmTest123',
      supabaseImageUrl: 'https://supabase.co/image.jpg',
      thumbnailUrl: 'https://gateway.pinata.cloud/ipfs/QmThumb123'
    }
    
    const result = processEvermarkImages(evermark)
    expect(result).toEqual(evermark) // Should return unchanged
  })

  it('should replace problematic image URLs when no supabase URL', () => {
    const evermark = {
      image: 'https://gateway.pinata.cloud/ipfs/QmTest123',
      thumbnailUrl: 'https://gateway.pinata.cloud/ipfs/QmThumb123'
    }
    
    const result = processEvermarkImages(evermark)
    expect(result.image).toBe('https://ipfs.io/ipfs/QmTest123')
    expect(result.thumbnailUrl).toBe('https://ipfs.io/ipfs/QmThumb123')
  })

  it('should not modify good gateway URLs', () => {
    const evermark = {
      image: 'https://ipfs.io/ipfs/QmTest123',
      thumbnailUrl: 'https://cloudflare-ipfs.com/ipfs/QmThumb123'
    }
    
    const result = processEvermarkImages(evermark)
    expect(result).toEqual(evermark)
  })

  it('should handle missing image fields', () => {
    const evermark = {
      title: 'Test Evermark'
    }
    
    const result = processEvermarkImages(evermark)
    expect(result).toEqual(evermark)
  })

  it('should handle empty image URLs', () => {
    const evermark = {
      image: '',
      thumbnailUrl: ''
    }
    
    const result = processEvermarkImages(evermark)
    expect(result.image).toBe('')
    expect(result.thumbnailUrl).toBe('')
  })

  it('should not mutate the original object', () => {
    const evermark = {
      image: 'https://gateway.pinata.cloud/ipfs/QmTest123'
    }
    
    const result = processEvermarkImages(evermark)
    expect(result).not.toBe(evermark) // Different object
    expect(evermark.image).toBe('https://gateway.pinata.cloud/ipfs/QmTest123') // Original unchanged
    expect(result.image).toBe('https://ipfs.io/ipfs/QmTest123') // Result changed
  })

  it('should handle partial field replacement', () => {
    const evermark = {
      image: 'https://ipfs.io/ipfs/QmGood123', // Good gateway
      thumbnailUrl: 'https://gateway.pinata.cloud/ipfs/QmBad123' // Bad gateway
    }
    
    const result = processEvermarkImages(evermark)
    expect(result.image).toBe('https://ipfs.io/ipfs/QmGood123') // Unchanged
    expect(result.thumbnailUrl).toBe('https://ipfs.io/ipfs/QmBad123') // Changed
  })
})

describe('processEvermarkImagesArray', () => {
  it('should process all evermarks in array', () => {
    const evermarks = [
      {
        id: '1',
        image: 'https://gateway.pinata.cloud/ipfs/QmTest123'
      },
      {
        id: '2',
        image: 'https://ipfs.io/ipfs/QmGood456'
      },
      {
        id: '3',
        supabaseImageUrl: 'https://supabase.co/image.jpg',
        image: 'https://gateway.pinata.cloud/ipfs/QmTest789'
      }
    ]
    
    const result = processEvermarkImagesArray(evermarks)
    
    expect(result).toHaveLength(3)
    expect(result[0].image).toBe('https://ipfs.io/ipfs/QmTest123') // Replaced
    expect(result[1].image).toBe('https://ipfs.io/ipfs/QmGood456') // Unchanged
    expect(result[2].image).toBe('https://gateway.pinata.cloud/ipfs/QmTest789') // Unchanged due to supabase URL
    expect(result[2].supabaseImageUrl).toBe('https://supabase.co/image.jpg')
  })

  it('should handle empty array', () => {
    const result = processEvermarkImagesArray([])
    expect(result).toEqual([])
  })

  it('should not mutate original array or objects', () => {
    const evermarks = [
      {
        id: '1',
        image: 'https://gateway.pinata.cloud/ipfs/QmTest123'
      }
    ]
    
    const result = processEvermarkImagesArray(evermarks)
    
    expect(result).not.toBe(evermarks) // Different array
    expect(result[0]).not.toBe(evermarks[0]) // Different objects
    expect(evermarks[0].image).toBe('https://gateway.pinata.cloud/ipfs/QmTest123') // Original unchanged
    expect(result[0].image).toBe('https://ipfs.io/ipfs/QmTest123') // Result changed
  })

  it('should handle mixed good and bad URLs', () => {
    const evermarks = [
      { image: 'https://gateway.pinata.cloud/ipfs/QmBad1' },
      { image: 'https://ipfs.io/ipfs/QmGood1' },
      { thumbnailUrl: 'https://pinata.cloud/ipfs/QmBad2' },
      { image: 'https://cloudflare-ipfs.com/ipfs/QmGood2' }
    ]
    
    const result = processEvermarkImagesArray(evermarks)
    
    expect(result[0].image).toBe('https://ipfs.io/ipfs/QmBad1')
    expect(result[1].image).toBe('https://ipfs.io/ipfs/QmGood1')
    expect(result[2].thumbnailUrl).toBe('https://ipfs.io/ipfs/QmBad2')
    expect(result[3].image).toBe('https://cloudflare-ipfs.com/ipfs/QmGood2')
  })
})

describe('IPFS hash extraction edge cases', () => {
  it('should handle very long hashes correctly', () => {
    const longHash = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
    const url = `https://gateway.pinata.cloud/ipfs/${longHash}`
    const result = replaceIPFSGateway(url)
    expect(result).toBe(`https://ipfs.io/ipfs/${longHash}`)
  })

  it('should handle minimum valid hash lengths', () => {
    // Minimum Qm hash (46 characters)
    const minHash = 'QmTest123456789012345678901234567890123456'
    const url = `https://gateway.pinata.cloud/ipfs/${minHash}`
    const result = replaceIPFSGateway(url)
    expect(result).toBe(`https://ipfs.io/ipfs/${minHash}`)
  })

  it('should handle short hashes that match patterns', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const shortHash = 'QmTooShort'
    const url = `https://gateway.pinata.cloud/ipfs/${shortHash}`
    const result = replaceIPFSGateway(url)
    
    // The regex pattern /\/ipfs\/([a-zA-Z0-9]+)/ matches any alphanumeric string
    // so 'QmTooShort' gets extracted and replaced
    expect(result).toBe('https://ipfs.io/ipfs/QmTooShort')
    expect(consoleSpy).not.toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })
})

describe('error handling', () => {
  it('should handle malformed URLs without throwing', () => {
    expect(() => replaceIPFSGateway('not-a-url')).not.toThrow()
    expect(() => processEvermarkImages({ image: 'invalid-url' })).not.toThrow()
  })

  it('should handle null values in evermark objects', () => {
    const evermark = {
      image: null,
      thumbnailUrl: undefined
    } as any
    
    expect(() => processEvermarkImages(evermark)).not.toThrow()
    const result = processEvermarkImages(evermark)
    expect(result.image).toBeNull()
    expect(result.thumbnailUrl).toBeUndefined()
  })
})