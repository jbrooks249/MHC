// Name Verification and Correction System
// Ensures MHC names are accurate and properly formatted

export interface NameVerificationResult {
  originalName: string
  correctedName: string
  confidence: number
  source: 'original' | 'address' | 'city' | 'generated' | 'lookup'
  issues: string[]
}

// Common MHC name patterns that should be preserved
const MHC_SUFFIXES = [
  'Mobile Home Park',
  'Mobile Home Community',
  'Manufactured Home Community',
  'Manufactured Housing Community',
  'MHP',
  'MHC',
  'RV Park',
  'RV Resort',
  'Trailer Park',
  'Mobile Estates',
  'Mobile Village',
  'Mobile Manor',
  'Mobile Terrace',
  'Mobile Gardens',
  'Trailer Court',
  'Trailer Estates'
]

// Generic/placeholder names that need replacement
// These must be EXACT matches (case-insensitive) to the full name, not partial matches
const GENERIC_NAMES = [
  'unnamed property',
  'unknown',
  'mobile home park',
  'mhp',
  'mhc',
  'property',
  'listing',
  'n/a',
  'tbd',
  'not available',
  'mobile home community',
  'manufactured housing',
  'trailer park',
  'manufactured home community'
]

// Common name prefixes to look for
const NAME_PREFIXES = [
  'Sunny', 'Shady', 'Pleasant', 'Green', 'Golden', 'Silver', 'Oak', 'Pine', 'Cedar',
  'Palm', 'Lake', 'River', 'Valley', 'Mountain', 'Country', 'Royal', 'Crown',
  'Paradise', 'Leisure', 'Sunset', 'Sunrise', 'Holiday', 'Colonial', 'Heritage',
  'Fairway', 'Rolling', 'Whispering', 'Meadow', 'Spring', 'Forest', 'Garden',
  'Woodland', 'Vista', 'Hilltop', 'Creekside', 'Lakeside', 'Riverside', 'Parkview'
]

// Verify and correct a property name
export function verifyPropertyName(
  name: string | null,
  address: string | null,
  city: string,
  state: string
): NameVerificationResult {
  const issues: string[] = []
  let correctedName = name?.trim() || ''
  let confidence = 100
  let source: NameVerificationResult['source'] = 'original'

  // Check if name is empty or EXACTLY matches a generic placeholder
  // Don't flag names like "Oak Crest Mobile Home Park" - only flag "Mobile Home Park" alone
  const normalizedName = correctedName.toLowerCase().trim()
  const isGeneric = !correctedName || 
    GENERIC_NAMES.some(g => normalizedName === g.toLowerCase())

  if (isGeneric) {
    issues.push('Name is generic or missing')
    confidence -= 30
    
    // Try to generate a name from address
    if (address) {
      const generatedFromAddress = generateNameFromAddress(address)
      if (generatedFromAddress) {
        correctedName = generatedFromAddress
        source = 'address'
        confidence = 60
      }
    }
    
    // If still no good name, generate from city
    if (!correctedName || GENERIC_NAMES.some(g => correctedName.toLowerCase().includes(g.toLowerCase()))) {
      correctedName = generateNameFromCity(city, state)
      source = 'city'
      confidence = 40
    }
  }

  // Clean up the name
  correctedName = cleanPropertyName(correctedName)

  // Ensure name has proper suffix if it doesn't already
  if (!hasMHCSuffix(correctedName)) {
    // Only add suffix if the name doesn't end with common location words
    if (!correctedName.match(/(Park|Community|Village|Estates|Manor|Gardens|Court|Resort|Place|Terrace|Heights|Acres)$/i)) {
      correctedName = `${correctedName} MHP`
      issues.push('Added MHP suffix')
    }
  }

  // Validate the corrected name
  if (correctedName.length < 3) {
    issues.push('Name too short')
    confidence -= 20
    correctedName = `${city} Mobile Home Park`
    source = 'city'
  }

  if (correctedName.length > 100) {
    issues.push('Name too long - truncated')
    correctedName = correctedName.substring(0, 100).trim()
  }

  // Check for suspicious patterns
  if (correctedName.match(/\d{5,}/)) {
    issues.push('Name contains long number sequence')
    confidence -= 15
  }

  if (correctedName.match(/http|www\.|\.com|\.net/i)) {
    issues.push('Name contains URL')
    correctedName = correctedName.replace(/https?:\/\/[^\s]+/gi, '').trim()
    confidence -= 20
  }

  // Ensure proper capitalization
  correctedName = properCapitalization(correctedName)

  return {
    originalName: name || '',
    correctedName,
    confidence: Math.max(0, confidence),
    source,
    issues
  }
}

// Generate a name from the street address
function generateNameFromAddress(address: string): string | null {
  // Try to extract a meaningful name from the address
  const cleaned = address.trim()
  
  // Look for named roads/streets that could be park names
  const streetMatch = cleaned.match(/^[\d-]+\s+(.+?)(?:\s+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Highway|Hwy|Route|Rt)\.?)?$/i)
  
  if (streetMatch && streetMatch[1]) {
    const streetName = streetMatch[1].trim()
    // Don't use generic street names
    if (!streetName.match(/^(Main|First|Second|Third|1st|2nd|3rd|North|South|East|West|Center|Central)$/i)) {
      return `${streetName} Mobile Home Park`
    }
  }

  // Look for named locations in the address
  for (const prefix of NAME_PREFIXES) {
    if (cleaned.toLowerCase().includes(prefix.toLowerCase())) {
      const match = cleaned.match(new RegExp(`(${prefix}\\s+\\w+)`, 'i'))
      if (match) {
        return `${match[1]} Mobile Home Park`
      }
    }
  }

  return null
}

// Generate a name from city/state
function generateNameFromCity(city: string, state: string): string {
  const cleanCity = city.trim().replace(/[^a-zA-Z\s]/g, '')
  return `${cleanCity} Mobile Home Park`
}

// Clean up property name
function cleanPropertyName(name: string): string {
  return name
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing punctuation
    .replace(/^[^\w]+|[^\w]+$/g, '')
    // Remove common junk
    .replace(/\s*-\s*$/, '')
    .replace(/^\s*-\s*/, '')
    // Remove duplicate suffixes
    .replace(/(Mobile Home Park|MHP|MHC)\s+(Mobile Home Park|MHP|MHC)/gi, '$1')
    .trim()
}

// Check if name already has an MHC-related suffix
function hasMHCSuffix(name: string): boolean {
  const lowerName = name.toLowerCase()
  return MHC_SUFFIXES.some(suffix => lowerName.includes(suffix.toLowerCase()))
}

// Apply proper capitalization
function properCapitalization(name: string): string {
  // Split by spaces and capitalize each word
  return name.split(' ').map(word => {
    // Keep common abbreviations uppercase
    if (['MHP', 'MHC', 'RV', 'LLC', 'LP', 'INC'].includes(word.toUpperCase())) {
      return word.toUpperCase()
    }
    // Keep common lowercase words
    if (['of', 'the', 'at', 'in', 'on', 'and', 'or'].includes(word.toLowerCase()) && name.split(' ').indexOf(word) > 0) {
      return word.toLowerCase()
    }
    // Capitalize first letter
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }).join(' ')
}

// Batch verify names for multiple properties
export function batchVerifyNames(
  properties: Array<{
    id: string
    name: string | null
    address: string | null
    city: string
    state: string
  }>
): Array<{
  id: string
  verification: NameVerificationResult
}> {
  return properties.map(prop => ({
    id: prop.id,
    verification: verifyPropertyName(prop.name, prop.address, prop.city, prop.state)
  }))
}

// Calculate overall name quality for a dataset
export function calculateNameQuality(
  verifications: NameVerificationResult[]
): {
  averageConfidence: number
  originalNames: number
  generatedNames: number
  issueCount: number
  commonIssues: Array<{ issue: string; count: number }>
} {
  if (verifications.length === 0) {
    return {
      averageConfidence: 0,
      originalNames: 0,
      generatedNames: 0,
      issueCount: 0,
      commonIssues: []
    }
  }

  const averageConfidence = verifications.reduce((sum, v) => sum + v.confidence, 0) / verifications.length
  const originalNames = verifications.filter(v => v.source === 'original').length
  const generatedNames = verifications.filter(v => v.source !== 'original').length

  // Count issues
  const issueCounts: Record<string, number> = {}
  let totalIssues = 0

  for (const v of verifications) {
    totalIssues += v.issues.length
    for (const issue of v.issues) {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1
    }
  }

  const commonIssues = Object.entries(issueCounts)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    averageConfidence: Math.round(averageConfidence),
    originalNames,
    generatedNames,
    issueCount: totalIssues,
    commonIssues
  }
}
