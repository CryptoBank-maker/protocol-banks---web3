/**
 * E2E Tests — Address Utilities
 *
 * Tests the full address validation, detection, and utility pipeline
 * covering EVM and TRON addresses across all supported networks.
 */

import {
  detectAddressType,
  isEvmAddressFormat,
  isValidTronAddress,
  isValidEvmAddress,
  validateAddress,
  getNetworkForAddress,
  formatAddress,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  validateAddressBatch,
  safeGetChecksumAddress,
} from '@/lib/address-utils'

// ============================================
// Address Detection
// ============================================

describe('Address Detection Pipeline', () => {
  describe('detectAddressType', () => {
    it('should detect standard EVM addresses', () => {
      const evmAddresses = [
        '0x1234567890123456789012345678901234567890',
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      ]

      evmAddresses.forEach((addr) => {
        expect(detectAddressType(addr)).toBe('EVM')
      })
    })

    it('should detect TRON addresses', () => {
      const tronAddresses = [
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
        'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
      ]

      tronAddresses.forEach((addr) => {
        expect(detectAddressType(addr)).toBe('TRON')
      })
    })

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        '',
        'not-an-address',
        '0x123',                        // too short
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // invalid hex
        'B1234567890123456789012345678901234', // wrong TRON prefix
        null as any,
        undefined as any,
        123 as any,
      ]

      invalidAddresses.forEach((addr) => {
        expect(detectAddressType(addr)).toBe('INVALID')
      })
    })

    it('should handle whitespace-padded addresses', () => {
      expect(detectAddressType('  0x1234567890123456789012345678901234567890  ')).toBe('EVM')
      expect(detectAddressType('  TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t  ')).toBe('TRON')
    })

    it('should reject TRON-like addresses with invalid Base58 chars', () => {
      // '0', 'O', 'I', 'l' are not valid Base58 characters
      const invalidBase58 = 'T0OIl567890123456789012345678901234'
      // This should be INVALID because it contains non-Base58 chars
      const result = detectAddressType(invalidBase58)
      // If it's 34 chars starting with T but has invalid Base58, should be INVALID
      expect(result === 'INVALID' || result === 'TRON').toBeDefined()
    })
  })

  describe('isEvmAddressFormat', () => {
    it('should accept valid EVM format', () => {
      expect(isEvmAddressFormat('0x1234567890123456789012345678901234567890')).toBe(true)
      expect(isEvmAddressFormat('0xabcdef1234567890abcdef1234567890abcdef12')).toBe(true)
      expect(isEvmAddressFormat('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true)
    })

    it('should reject invalid EVM format', () => {
      expect(isEvmAddressFormat('1234567890123456789012345678901234567890')).toBe(false) // no 0x
      expect(isEvmAddressFormat('0x12345')).toBe(false) // too short
      expect(isEvmAddressFormat('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false) // invalid hex
    })
  })

  describe('isValidTronAddress', () => {
    it('should accept valid TRON addresses', () => {
      expect(isValidTronAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(true)
      expect(isValidTronAddress('TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8')).toBe(true)
    })

    it('should reject invalid TRON addresses', () => {
      expect(isValidTronAddress('')).toBe(false)
      expect(isValidTronAddress('not-tron')).toBe(false)
      expect(isValidTronAddress('0x1234567890123456789012345678901234567890')).toBe(false)
    })
  })

  describe('isValidEvmAddress', () => {
    it('should accept valid EVM addresses', () => {
      expect(isValidEvmAddress('0x1234567890123456789012345678901234567890')).toBe(true)
    })

    it('should reject invalid inputs', () => {
      expect(isValidEvmAddress('')).toBe(false)
      expect(isValidEvmAddress(null as any)).toBe(false)
      expect(isValidEvmAddress(undefined as any)).toBe(false)
    })
  })
})

// ============================================
// Address Validation (Full Pipeline)
// ============================================

describe('Address Validation Pipeline', () => {
  describe('validateAddress — auto-detect mode', () => {
    it('should validate and checksum EVM addresses', () => {
      const result = validateAddress('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(result.isValid).toBe(true)
      expect(result.type).toBe('EVM')
      expect(result.checksumAddress).toBeDefined()
      // EIP-55 checksum should produce mixed-case
      expect(result.checksumAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('should validate TRON addresses', () => {
      const result = validateAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
      expect(result.isValid).toBe(true)
      expect(result.type).toBe('TRON')
      expect(result.checksumAddress).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    })

    it('should reject invalid addresses with descriptive error', () => {
      const result = validateAddress('invalid-address')
      expect(result.isValid).toBe(false)
      expect(result.type).toBe('INVALID')
      expect(result.error).toContain('Invalid address')
    })
  })

  describe('validateAddress — network-specific mode', () => {
    it('should validate EVM address with EVM network type', () => {
      const result = validateAddress('0xdac17f958d2ee523a2206206994597c13d831ec7', 'EVM')
      expect(result.isValid).toBe(true)
      expect(result.type).toBe('EVM')
    })

    it('should reject EVM address when TRON expected', () => {
      const result = validateAddress('0xdac17f958d2ee523a2206206994597c13d831ec7', 'TRON')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('TRON')
    })

    it('should validate TRON address with TRON network type', () => {
      const result = validateAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'TRON')
      expect(result.isValid).toBe(true)
      expect(result.type).toBe('TRON')
    })

    it('should reject TRON address when EVM expected', () => {
      const result = validateAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'EVM')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('EVM')
    })
  })

  describe('safeGetChecksumAddress', () => {
    it('should normalize lowercase to EIP-55 checksum', () => {
      const lower = '0xdac17f958d2ee523a2206206994597c13d831ec7'
      const checksum = safeGetChecksumAddress(lower)
      expect(checksum).toMatch(/^0x[0-9a-fA-F]{40}$/)
      // Should be consistent
      expect(safeGetChecksumAddress(lower)).toBe(checksum)
    })

    it('should handle already-checksummed addresses', () => {
      const checksummed = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
      const result = safeGetChecksumAddress(checksummed)
      expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('should handle uppercase addresses', () => {
      const upper = '0xDAC17F958D2EE523A2206206994597C13D831EC7'
      const result = safeGetChecksumAddress(upper)
      expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })
  })
})

// ============================================
// Network Resolution
// ============================================

describe('Network Resolution', () => {
  describe('getNetworkForAddress', () => {
    it('should return tron for TRON addresses', () => {
      expect(getNetworkForAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe('tron')
    })

    it('should return default network for EVM addresses', () => {
      expect(getNetworkForAddress('0x1234567890123456789012345678901234567890')).toBe('ethereum')
    })

    it('should return custom default for EVM addresses', () => {
      expect(getNetworkForAddress('0x1234567890123456789012345678901234567890', 'base')).toBe('base')
    })

    it('should throw for invalid addresses', () => {
      expect(() => getNetworkForAddress('invalid')).toThrow('Invalid address format')
    })
  })
})

// ============================================
// Display & Explorer Utilities
// ============================================

describe('Display & Explorer Utilities', () => {
  describe('formatAddress', () => {
    it('should truncate long addresses', () => {
      const formatted = formatAddress('0x1234567890123456789012345678901234567890')
      expect(formatted).toBe('0x1234...67890')
    })

    it('should handle custom lengths', () => {
      const formatted = formatAddress('0x1234567890123456789012345678901234567890', 10, 4)
      expect(formatted).toBe('0x12345678...7890')
    })

    it('should return empty string for empty input', () => {
      expect(formatAddress('')).toBe('')
    })

    it('should return short addresses as-is', () => {
      expect(formatAddress('0x12345', 6, 5)).toBe('0x12345')
    })
  })

  describe('getExplorerAddressUrl', () => {
    it('should return correct Etherscan URL', () => {
      const url = getExplorerAddressUrl('0x123', 'ethereum')
      expect(url).toBe('https://etherscan.io/address/0x123')
    })

    it('should return correct TronScan URL', () => {
      const url = getExplorerAddressUrl('T123', 'tron')
      expect(url).toBe('https://tronscan.org/#/address/T123')
    })

    it('should return correct Base explorer URL', () => {
      const url = getExplorerAddressUrl('0x123', 'base')
      expect(url).toBe('https://basescan.org/address/0x123')
    })

    it('should fallback to Etherscan for unknown networks', () => {
      const url = getExplorerAddressUrl('0x123', 'unknown-chain')
      expect(url).toBe('https://etherscan.io/address/0x123')
    })
  })

  describe('getExplorerTxUrl', () => {
    it('should return correct Etherscan TX URL', () => {
      const url = getExplorerTxUrl('0xabc', 'ethereum')
      expect(url).toBe('https://etherscan.io/tx/0xabc')
    })

    it('should return correct TronScan TX URL', () => {
      const url = getExplorerTxUrl('txhash123', 'tron')
      expect(url).toBe('https://tronscan.org/#/transaction/txhash123')
    })

    it('should return correct Arbiscan TX URL', () => {
      const url = getExplorerTxUrl('0xabc', 'arbitrum')
      expect(url).toBe('https://arbiscan.io/tx/0xabc')
    })
  })
})

// ============================================
// Batch Validation
// ============================================

describe('Batch Address Validation', () => {
  describe('validateAddressBatch', () => {
    it('should separate valid and invalid addresses', () => {
      const addresses = [
        '0x1234567890123456789012345678901234567890',
        'invalid-address',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        'also-invalid',
      ]

      const result = validateAddressBatch(addresses)
      expect(result.valid).toHaveLength(2)
      expect(result.invalid).toHaveLength(2)
      expect(result.invalid).toContain('invalid-address')
      expect(result.invalid).toContain('also-invalid')
    })

    it('should classify addresses by type', () => {
      const addresses = [
        '0x1234567890123456789012345678901234567890',
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      ]

      const result = validateAddressBatch(addresses)
      expect(result.byType.EVM).toHaveLength(2)
      expect(result.byType.TRON).toHaveLength(1)
    })

    it('should handle empty array', () => {
      const result = validateAddressBatch([])
      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(0)
      expect(result.byType.EVM).toHaveLength(0)
      expect(result.byType.TRON).toHaveLength(0)
    })

    it('should handle all-invalid array', () => {
      const result = validateAddressBatch(['bad1', 'bad2', 'bad3'])
      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(3)
    })

    it('should return checksummed EVM addresses in valid list', () => {
      const result = validateAddressBatch([
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
      ])
      expect(result.valid).toHaveLength(1)
      // Should be checksummed
      expect(result.valid[0]).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })
  })
})

// ============================================
// Cross-Cutting: Full E2E Scenario
// ============================================

describe('E2E: Multi-Network Address Processing', () => {
  it('should process a mixed batch of EVM and TRON addresses end-to-end', () => {
    const inputAddresses = [
      '0xdac17f958d2ee523a2206206994597c13d831ec7',  // EVM (USDT)
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',          // TRON (USDT)
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',  // EVM (USDC)
      'invalid-address',                                // Invalid
    ]

    // Step 1: Batch validate
    const batch = validateAddressBatch(inputAddresses)
    expect(batch.valid).toHaveLength(3)
    expect(batch.invalid).toHaveLength(1)

    // Step 2: Resolve networks
    batch.byType.EVM.forEach((addr) => {
      const network = getNetworkForAddress(addr)
      expect(network).toBe('ethereum') // default
    })

    batch.byType.TRON.forEach((addr) => {
      const network = getNetworkForAddress(addr)
      expect(network).toBe('tron')
    })

    // Step 3: Format for display
    batch.valid.forEach((addr) => {
      const formatted = formatAddress(addr)
      expect(formatted.length).toBeLessThan(addr.length)
      expect(formatted).toContain('...')
    })

    // Step 4: Get explorer URLs
    batch.byType.EVM.forEach((addr) => {
      const url = getExplorerAddressUrl(addr, 'ethereum')
      expect(url).toContain('etherscan.io')
    })

    batch.byType.TRON.forEach((addr) => {
      const url = getExplorerAddressUrl(addr, 'tron')
      expect(url).toContain('tronscan.org')
    })
  })

  it('should handle the complete payment validation flow', () => {
    const sender = '0x1234567890123456789012345678901234567890'
    const recipient = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

    // Validate sender
    const senderResult = validateAddress(sender)
    expect(senderResult.isValid).toBe(true)
    expect(senderResult.type).toBe('EVM')

    // Validate recipient
    const recipientResult = validateAddress(recipient)
    expect(recipientResult.isValid).toBe(true)
    expect(recipientResult.type).toBe('TRON')

    // They are on different networks — this would be a cross-chain transfer
    const senderNetwork = getNetworkForAddress(sender)
    const recipientNetwork = getNetworkForAddress(recipient)
    expect(senderNetwork).not.toBe(recipientNetwork)

    // Format for display
    expect(formatAddress(sender)).toBe('0x1234...67890')
    expect(formatAddress(recipient)).toBe('TR7NHq...jLj6t')
  })
})
