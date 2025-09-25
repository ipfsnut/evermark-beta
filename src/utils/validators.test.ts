import { describe, it, expect } from 'vitest'
import { Validators, EvermarkValidator } from './validators'

describe('Validators', () => {
  describe('isValidAddress', () => {
    it('should validate correct Ethereum addresses', () => {
      expect(Validators.isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true)
      expect(Validators.isValidAddress('0xabcdefABCDEF1234567890123456789012345678')).toBe(true)
      expect(Validators.isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true)
    })

    it('should reject invalid Ethereum addresses', () => {
      expect(Validators.isValidAddress('0x123')).toBe(false) // too short
      expect(Validators.isValidAddress('0x12345678901234567890123456789012345678900')).toBe(false) // too long
      expect(Validators.isValidAddress('1234567890123456789012345678901234567890')).toBe(false) // missing 0x
      expect(Validators.isValidAddress('0xGHIJKL7890123456789012345678901234567890')).toBe(false) // invalid characters
      expect(Validators.isValidAddress('')).toBe(false) // empty
      expect(Validators.isValidAddress('0x')).toBe(false) // just prefix
    })
  })

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(Validators.isValidUrl('https://example.com')).toBe(true)
      expect(Validators.isValidUrl('http://example.com')).toBe(true)
      expect(Validators.isValidUrl('https://sub.example.com/path?query=1')).toBe(true)
      expect(Validators.isValidUrl('ftp://example.com')).toBe(true)
      expect(Validators.isValidUrl('mailto:test@example.com')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(Validators.isValidUrl('not-a-url')).toBe(false)
      expect(Validators.isValidUrl('http://')).toBe(false)
      expect(Validators.isValidUrl('')).toBe(false)
      expect(Validators.isValidUrl('example.com')).toBe(false) // missing protocol
    })
  })

  describe('isValidDOI', () => {
    it('should validate correct DOI formats', () => {
      expect(Validators.isValidDOI('10.1234/example')).toBe(true)
      expect(Validators.isValidDOI('10.12345/example.paper')).toBe(true)
      expect(Validators.isValidDOI('10.1000/182')).toBe(true)
      expect(Validators.isValidDOI('10.1234/example-paper_v1')).toBe(true)
    })

    it('should reject invalid DOI formats', () => {
      expect(Validators.isValidDOI('10.123/example')).toBe(false) // too short prefix
      expect(Validators.isValidDOI('11.1234/example')).toBe(false) // wrong prefix
      expect(Validators.isValidDOI('10.1234/')).toBe(false) // empty suffix
      expect(Validators.isValidDOI('10.1234/ example')).toBe(false) // space in suffix
      expect(Validators.isValidDOI('')).toBe(false)
    })
  })

  describe('isValidISBN', () => {
    it('should validate ISBN-10 formats', () => {
      expect(Validators.isValidISBN('1234567890')).toBe(true)
      expect(Validators.isValidISBN('123456789X')).toBe(true)
      expect(Validators.isValidISBN('1-234-567-890')).toBe(true) // with hyphens
      expect(Validators.isValidISBN('1 234 567 890')).toBe(true) // with spaces
    })

    it('should validate ISBN-13 formats', () => {
      expect(Validators.isValidISBN('1234567890123')).toBe(true)
      expect(Validators.isValidISBN('978-1-234-567-890')).toBe(true) // with hyphens
      expect(Validators.isValidISBN('978 1 234 567 890')).toBe(true) // with spaces
    })

    it('should reject invalid ISBN formats', () => {
      expect(Validators.isValidISBN('123456789')).toBe(false) // too short
      expect(Validators.isValidISBN('12345678901')).toBe(false) // invalid length
      expect(Validators.isValidISBN('12345678901234')).toBe(false) // too long
      expect(Validators.isValidISBN('123456789Y')).toBe(false) // invalid check character
      expect(Validators.isValidISBN('')).toBe(false)
    })
  })

  describe('isValidFarcasterInput', () => {
    it('should validate Warpcast URLs', () => {
      expect(Validators.isValidFarcasterInput('https://warpcast.com/user/0x1234abcd')).toBe(true)
      expect(Validators.isValidFarcasterInput('https://warpcast.com/username/0xabcdef1234567890')).toBe(true)
    })

    it('should validate Farcaster.xyz URLs', () => {
      expect(Validators.isValidFarcasterInput('https://farcaster.xyz/user/0x1234abcd')).toBe(true)
    })

    it('should validate Supercast URLs', () => {
      expect(Validators.isValidFarcasterInput('https://supercast.xyz/user/0x1234abcd')).toBe(true)
    })

    it('should validate direct hashes', () => {
      expect(Validators.isValidFarcasterInput('0x1234abcd')).toBe(true)
      expect(Validators.isValidFarcasterInput('0x1234567890abcdef')).toBe(true)
      expect(Validators.isValidFarcasterInput('0x1234567890abcdef1234567890abcdef12345678')).toBe(true)
    })

    it('should reject invalid Farcaster inputs', () => {
      expect(Validators.isValidFarcasterInput('https://twitter.com/user/123')).toBe(false)
      expect(Validators.isValidFarcasterInput('https://warpcast.com/user')).toBe(false) // missing hash
      expect(Validators.isValidFarcasterInput('0x123')).toBe(false) // too short hash
      expect(Validators.isValidFarcasterInput('1234abcd')).toBe(false) // missing 0x
      expect(Validators.isValidFarcasterInput('')).toBe(false)
    })
  })

  describe('validateImageFile', () => {
    // Create mock File objects
    const createMockFile = (type: string, size: number): File => {
      return {
        type,
        size,
        name: 'test-file',
        lastModified: Date.now(),
        webkitRelativePath: '',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        slice: () => new Blob(),
        stream: () => new ReadableStream(),
        text: () => Promise.resolve('')
      } as File
    }

    it('should validate correct image files', () => {
      expect(Validators.validateImageFile(createMockFile('image/jpeg', 1024))).toEqual({
        isValid: true
      })
      expect(Validators.validateImageFile(createMockFile('image/png', 2048))).toEqual({
        isValid: true
      })
      expect(Validators.validateImageFile(createMockFile('image/gif', 4096))).toEqual({
        isValid: true
      })
      expect(Validators.validateImageFile(createMockFile('image/webp', 8192))).toEqual({
        isValid: true
      })
    })

    it('should reject invalid file types', () => {
      const result = Validators.validateImageFile(createMockFile('text/plain', 1024))
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Image must be JPEG, PNG, GIF, or WebP format')
    })

    it('should reject files that are too large', () => {
      const result = Validators.validateImageFile(createMockFile('image/jpeg', 11 * 1024 * 1024)) // 11MB
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Image must be less than 25MB')
    })

    it('should accept files at the size limit', () => {
      const result = Validators.validateImageFile(createMockFile('image/jpeg', 25 * 1024 * 1024)) // exactly 25MB
      expect(result.isValid).toBe(true)
    })
  })

  describe('sanitizeText', () => {
    it('should trim whitespace', () => {
      expect(Validators.sanitizeText('  hello world  ')).toBe('hello world')
      expect(Validators.sanitizeText('\n  text  \t')).toBe('text')
    })

    it('should collapse multiple spaces', () => {
      expect(Validators.sanitizeText('hello    world')).toBe('hello world')
      expect(Validators.sanitizeText('text  with\t\ttabs\nand\nnewlines')).toBe('text with tabs and newlines')
    })

    it('should handle empty and whitespace-only strings', () => {
      expect(Validators.sanitizeText('')).toBe('')
      expect(Validators.sanitizeText('   ')).toBe('')
      expect(Validators.sanitizeText('\n\t\r')).toBe('')
    })
  })

  describe('validateCustomFieldKey', () => {
    it('should validate correct custom field keys', () => {
      expect(Validators.validateCustomFieldKey('validKey')).toBe(true)
      expect(Validators.validateCustomFieldKey('key123')).toBe(true)
      expect(Validators.validateCustomFieldKey('field_name')).toBe(true)
      expect(Validators.validateCustomFieldKey('a')).toBe(true) // single character
    })

    it('should reject invalid custom field keys', () => {
      expect(Validators.validateCustomFieldKey('123key')).toBe(false) // starts with number
      expect(Validators.validateCustomFieldKey('_key')).toBe(false) // starts with underscore
      expect(Validators.validateCustomFieldKey('key-name')).toBe(false) // contains hyphen
      expect(Validators.validateCustomFieldKey('key name')).toBe(false) // contains space
      expect(Validators.validateCustomFieldKey('')).toBe(false) // empty
      expect(Validators.validateCustomFieldKey('a'.repeat(51))).toBe(false) // too long
    })
  })

  describe('validateTag', () => {
    it('should validate correct tags', () => {
      expect(Validators.validateTag('validTag')).toBe(true)
      expect(Validators.validateTag('tag123')).toBe(true)
      expect(Validators.validateTag('tag-name')).toBe(true)
      expect(Validators.validateTag('tag_name')).toBe(true)
      expect(Validators.validateTag('a')).toBe(true) // single character
    })

    it('should reject invalid tags', () => {
      expect(Validators.validateTag('tag name')).toBe(false) // contains space
      expect(Validators.validateTag('tag.name')).toBe(false) // contains period
      expect(Validators.validateTag('tag@name')).toBe(false) // contains special character
      expect(Validators.validateTag('')).toBe(false) // empty
      expect(Validators.validateTag('a'.repeat(31))).toBe(false) // too long
    })
  })
})

describe('EvermarkValidator', () => {
  describe('validateMetadata', () => {
    const createValidMetadata = () => ({
      title: 'Valid Title',
      description: 'Valid description',
      author: 'Valid Author',
      contentType: 'Article',
      sourceUrl: 'https://example.com',
      tags: ['tag1', 'tag2']
    })

    it('should validate correct metadata', () => {
      const result = EvermarkValidator.validateMetadata(createValidMetadata())
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should require title', () => {
      const metadata = { ...createValidMetadata(), title: '' }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'title',
        message: 'Title is required'
      })
    })

    it('should validate title length', () => {
      const metadata = { ...createValidMetadata(), title: 'a'.repeat(501) }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'title',
        message: 'Title must be 500 characters or less'
      })
    })

    it('should warn about short titles', () => {
      const metadata = { ...createValidMetadata(), title: 'ab' }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContainEqual({
        field: 'title',
        message: 'Title should be at least 3 characters'
      })
    })

    it('should validate description length', () => {
      const metadata = { ...createValidMetadata(), description: 'a'.repeat(1001) }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'description',
        message: 'Description must be 2000 characters or less'
      })
    })

    it('should warn about missing description', () => {
      const metadata = { ...createValidMetadata(), description: '' }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContainEqual({
        field: 'description',
        message: 'Description is recommended for better discoverability'
      })
    })

    it('should require author', () => {
      const metadata = { ...createValidMetadata(), author: '' }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'author',
        message: 'Author is required'
      })
    })

    it('should validate author length', () => {
      const metadata = { ...createValidMetadata(), author: 'a'.repeat(51) }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'author',
        message: 'Author name must be 50 characters or less'
      })
    })

    it('should validate source URL format', () => {
      const metadata = { ...createValidMetadata(), sourceUrl: 'not-a-url' }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'sourceUrl',
        message: 'Source URL must be a valid URL'
      })
    })

    it('should validate DOI for DOI content type', () => {
      const metadata = {
        ...createValidMetadata(),
        contentType: 'DOI',
        doi: 'invalid-doi'
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'doi',
        message: 'Invalid DOI format'
      })
    })

    it('should validate ISBN for ISBN content type', () => {
      const metadata = {
        ...createValidMetadata(),
        contentType: 'ISBN',
        isbn: 'invalid-isbn'
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'isbn',
        message: 'Invalid ISBN format'
      })
    })

    it('should validate Cast URL for Cast content type', () => {
      const metadata = {
        ...createValidMetadata(),
        contentType: 'Cast',
        castUrl: 'https://twitter.com/invalid'
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'castUrl',
        message: 'Invalid Farcaster cast URL or hash'
      })
    })

    it('should validate image file', () => {
      const mockFile = {
        type: 'text/plain',
        size: 1024
      } as File

      const metadata = {
        ...createValidMetadata(),
        imageFile: mockFile
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'imageFile',
        message: 'Image must be JPEG, PNG, GIF, or WebP format'
      })
    })

    it('should warn about too many tags', () => {
      const metadata = {
        ...createValidMetadata(),
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`)
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContainEqual({
        field: 'tags',
        message: 'Consider using fewer tags for better organization'
      })
    })

    it('should validate custom fields', () => {
      const metadata = {
        ...createValidMetadata(),
        customFields: [
          { key: 'validKey', value: 'validValue' },
          { key: '', value: 'value' }, // invalid key
          { key: 'validKey2', value: '' }, // invalid value
          { key: '123invalid', value: 'value' } // invalid key format
        ]
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'customFields.1.key',
        message: 'Custom field key is required'
      })
      expect(result.errors).toContainEqual({
        field: 'customFields.2.value',
        message: 'Custom field value is required'
      })
      expect(result.errors).toContainEqual({
        field: 'customFields.3.key',
        message: 'Invalid custom field key format'
      })
    })

    it('should handle null/undefined metadata', () => {
      const result = EvermarkValidator.validateMetadata({})
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      
      // Test with completely empty/null metadata
      const result2 = EvermarkValidator.validateMetadata(null as any)
      expect(result2.isValid).toBe(false)
      expect(result2.errors.length).toBeGreaterThan(0)
    })

    it('should handle metadata without warnings', () => {
      const metadata = createValidMetadata()
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.warnings).toBeUndefined()
    })

    it('should validate valid DOI content type', () => {
      const metadata = {
        ...createValidMetadata(),
        contentType: 'DOI',
        doi: '10.1234/valid.doi'
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(true)
    })

    it('should validate valid ISBN content type', () => {
      const metadata = {
        ...createValidMetadata(),
        contentType: 'ISBN',
        isbn: '1234567890'
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(true)
    })

    it('should validate valid Cast content type', () => {
      const metadata = {
        ...createValidMetadata(),
        contentType: 'Cast',
        castUrl: 'https://warpcast.com/user/0x1234abcd'
      }
      const result = EvermarkValidator.validateMetadata(metadata)
      expect(result.isValid).toBe(true)
    })
  })
})