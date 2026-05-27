// Data Validation and Quality Scoring System
// Ensures scraped listings are accurate and legitimate

import { ScrapedListing } from './scraper-types'
import { ScraperSource } from './scraper-sources'

export interface DataQualityScore {
  overall: number
  completeness: number
  consistency: number
  accuracy: number
  freshness: number
  issues: DataIssue[]
}

export interface DataIssue {
  field: string
  type: 'missing' | 'invalid' | 'suspicious' | 'inconsistent' | 'outdated'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  listing: ScrapedListing
  qualityScore: DataQualityScore
  normalizedData: Partial<ScrapedListing>
  duplicateMatch?: {
    propertyId: string
    confidence: number
    matchType: 'exact' | 'fuzzy' | 'address' | 'name'
  }
}

export interface CrossSourceComparison {
  propertyId: string
  sources: {
    source: string
    price: number | null
    units: number | null
    lastSeen: string
  }[]
  priceVariance: number
  mostReliableSource: string
  recommendation: 'use' | 'verify' | 'reject'
}

// Price reasonability bounds by region
const PRICE_BOUNDS: Record<string, { min: number; max: number; perUnit: { min: number; max: number } }> = {
  'Pacific': { min: 500000, max: 100000000, perUnit: { min: 30000, max: 500000 } },
  'Northeast': { min: 300000, max: 80000000, perUnit: { min: 25000, max: 400000 } },
  'Southeast': { min: 200000, max: 50000000, perUnit: { min: 15000, max: 200000 } },
  'Midwest': { min: 150000, max: 40000000, perUnit: { min: 10000, max: 150000 } },
  'Southwest': { min: 250000, max: 60000000, perUnit: { min: 20000, max: 250000 } },
  'Mountain': { min: 200000, max: 50000000, perUnit: { min: 15000, max: 200000 } },
  'Pacific NW': { min: 300000, max: 70000000, perUnit: { min: 25000, max: 350000 } },
  'default': { min: 100000, max: 100000000, perUnit: { min: 10000, max: 500000 } }
}

// Cap rate reasonability bounds
const CAP_RATE_BOUNDS = { min: 3, max: 15 }

// Lot rent reasonability bounds by region
const LOT_RENT_BOUNDS: Record<string, { min: number; max: number }> = {
  'Pacific': { min: 400, max: 2500 },
  'Northeast': { min: 300, max: 1500 },
  'Southeast': { min: 200, max: 1000 },
  'Midwest': { min: 150, max: 800 },
  'Southwest': { min: 250, max: 1200 },
  'Mountain': { min: 200, max: 1000 },
  'Pacific NW': { min: 350, max: 1500 },
  'default': { min: 100, max: 2500 }
}

// State to region mapping
const STATE_TO_REGION: Record<string, string> = {
  'CA': 'Pacific', 'HI': 'Pacific',
  'WA': 'Pacific NW', 'OR': 'Pacific NW', 'AK': 'Pacific NW',
  'MT': 'Mountain', 'ID': 'Mountain', 'WY': 'Mountain', 'CO': 'Mountain', 'UT': 'Mountain', 'NV': 'Mountain',
  'AZ': 'Southwest', 'NM': 'Southwest', 'TX': 'Southwest', 'OK': 'Southwest',
  'ND': 'Midwest', 'SD': 'Midwest', 'NE': 'Midwest', 'KS': 'Midwest', 'MN': 'Midwest', 'IA': 'Midwest',
  'MO': 'Midwest', 'WI': 'Midwest', 'IL': 'Midwest', 'MI': 'Midwest', 'IN': 'Midwest', 'OH': 'Midwest',
  'ME': 'Northeast', 'NH': 'Northeast', 'VT': 'Northeast', 'MA': 'Northeast', 'RI': 'Northeast',
  'CT': 'Northeast', 'NY': 'Northeast', 'NJ': 'Northeast', 'PA': 'Northeast',
  'DE': 'Southeast', 'MD': 'Southeast', 'VA': 'Southeast', 'WV': 'Southeast', 'NC': 'Southeast',
  'SC': 'Southeast', 'GA': 'Southeast', 'FL': 'Southeast', 'KY': 'Southeast', 'TN': 'Southeast',
  'AL': 'Southeast', 'MS': 'Southeast', 'AR': 'Southeast', 'LA': 'Southeast'
}

// Validate a single listing
export function validateListing(listing: ScrapedListing, source?: ScraperSource): ValidationResult {
  const issues: DataIssue[] = []
  const normalizedData: Partial<ScrapedListing> = {}

  // 1. Check completeness
  const requiredFields: (keyof ScrapedListing)[] = ['name', 'city', 'state']
  const importantFields: (keyof ScrapedListing)[] = ['asking_price', 'units', 'address']

  for (const field of requiredFields) {
    if (!listing[field]) {
      issues.push({
        field,
        type: 'missing',
        severity: 'critical',
        message: `Required field '${field}' is missing`
      })
    }
  }

  for (const field of importantFields) {
    if (!listing[field]) {
      issues.push({
        field,
        type: 'missing',
        severity: 'medium',
        message: `Important field '${field}' is missing`
      })
    }
  }

  // 2. Validate and normalize state
  if (listing.state) {
    const normalizedState = normalizeState(listing.state)
    if (!normalizedState) {
      issues.push({
        field: 'state',
        type: 'invalid',
        severity: 'high',
        message: `Invalid state code: ${listing.state}`,
        suggestion: 'Use standard 2-letter US state abbreviation'
      })
    } else {
      normalizedData.state = normalizedState
    }
  }

  // 3. Validate price reasonability
  const region = listing.state ? STATE_TO_REGION[listing.state.toUpperCase()] || 'default' : 'default'
  const priceBounds = PRICE_BOUNDS[region]

  if (listing.asking_price) {
    if (listing.asking_price < priceBounds.min) {
      issues.push({
        field: 'asking_price',
        type: 'suspicious',
        severity: 'high',
        message: `Price $${listing.asking_price.toLocaleString()} seems too low for ${region} region`,
        suggestion: `Expected minimum: $${priceBounds.min.toLocaleString()}`
      })
    } else if (listing.asking_price > priceBounds.max) {
      issues.push({
        field: 'asking_price',
        type: 'suspicious',
        severity: 'medium',
        message: `Price $${listing.asking_price.toLocaleString()} seems unusually high for ${region} region`
      })
    }

    // Check price per unit if units available
    if (listing.units && listing.units > 0) {
      const pricePerUnit = listing.asking_price / listing.units
      if (pricePerUnit < priceBounds.perUnit.min) {
        issues.push({
          field: 'asking_price',
          type: 'suspicious',
          severity: 'high',
          message: `Price per unit $${pricePerUnit.toLocaleString()} seems too low`,
          suggestion: `Expected minimum: $${priceBounds.perUnit.min.toLocaleString()}/unit`
        })
      } else if (pricePerUnit > priceBounds.perUnit.max) {
        issues.push({
          field: 'asking_price',
          type: 'suspicious',
          severity: 'medium',
          message: `Price per unit $${pricePerUnit.toLocaleString()} is above typical range`
        })
      }
    }
  }

  // 4. Validate cap rate
  if (listing.cap_rate) {
    if (listing.cap_rate < CAP_RATE_BOUNDS.min) {
      issues.push({
        field: 'cap_rate',
        type: 'suspicious',
        severity: 'medium',
        message: `Cap rate ${listing.cap_rate}% is unusually low`,
        suggestion: `Typical range: ${CAP_RATE_BOUNDS.min}%-${CAP_RATE_BOUNDS.max}%`
      })
    } else if (listing.cap_rate > CAP_RATE_BOUNDS.max) {
      issues.push({
        field: 'cap_rate',
        type: 'suspicious',
        severity: 'high',
        message: `Cap rate ${listing.cap_rate}% is unusually high - verify accuracy`
      })
    }
  }

  // 5. Validate lot rent
  if (listing.lot_rent) {
    const rentBounds = LOT_RENT_BOUNDS[region]
    if (listing.lot_rent < rentBounds.min) {
      issues.push({
        field: 'lot_rent',
        type: 'suspicious',
        severity: 'medium',
        message: `Lot rent $${listing.lot_rent}/mo seems low for ${region}`,
        suggestion: `Expected range: $${rentBounds.min}-$${rentBounds.max}/mo`
      })
    } else if (listing.lot_rent > rentBounds.max) {
      issues.push({
        field: 'lot_rent',
        type: 'suspicious',
        severity: 'medium',
        message: `Lot rent $${listing.lot_rent}/mo seems high for ${region}`
      })
    }
  }

  // 6. Validate occupancy
  if (listing.occupancy !== null && listing.occupancy !== undefined) {
    if (listing.occupancy < 0 || listing.occupancy > 100) {
      issues.push({
        field: 'occupancy',
        type: 'invalid',
        severity: 'high',
        message: `Invalid occupancy: ${listing.occupancy}%`,
        suggestion: 'Occupancy must be between 0-100%'
      })
    } else if (listing.occupancy < 50) {
      issues.push({
        field: 'occupancy',
        type: 'suspicious',
        severity: 'low',
        message: `Very low occupancy: ${listing.occupancy}%`,
        suggestion: 'Verify this is accurate - may indicate distressed property'
      })
    }
  }

  // 7. Validate unit count
  if (listing.units) {
    if (listing.units < 1) {
      issues.push({
        field: 'units',
        type: 'invalid',
        severity: 'critical',
        message: `Invalid unit count: ${listing.units}`
      })
    } else if (listing.units > 2000) {
      issues.push({
        field: 'units',
        type: 'suspicious',
        severity: 'medium',
        message: `Very large park: ${listing.units} units - verify accuracy`
      })
    }
  }

  // 8. Validate URL
  if (listing.listing_url) {
    if (!isValidUrl(listing.listing_url)) {
      issues.push({
        field: 'listing_url',
        type: 'invalid',
        severity: 'low',
        message: 'Invalid listing URL format'
      })
    }
  }

  // 9. Normalize name
  if (listing.name) {
    normalizedData.name = normalizeName(listing.name)
  }

  // 10. Normalize city
  if (listing.city) {
    normalizedData.city = normalizeCity(listing.city)
  }

  // Calculate quality scores
  const qualityScore = calculateQualityScore(listing, issues, source)

  // Determine if valid (no critical issues)
  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const valid = criticalIssues.length === 0

  return {
    valid,
    listing,
    qualityScore,
    normalizedData
  }
}

// Calculate comprehensive quality score
function calculateQualityScore(
  listing: ScrapedListing,
  issues: DataIssue[],
  source?: ScraperSource
): DataQualityScore {
  // Completeness score (0-100)
  const allFields: (keyof ScrapedListing)[] = [
    'name', 'address', 'city', 'state', 'asking_price',
    'units', 'cap_rate', 'lot_rent', 'occupancy', 'listing_url', 'image_url'
  ]
  const filledFields = allFields.filter(f => listing[f] !== null && listing[f] !== undefined)
  const completeness = Math.round((filledFields.length / allFields.length) * 100)

  // Accuracy score based on issues
  let accuracy = 100
  for (const issue of issues) {
    if (issue.type === 'invalid') {
      accuracy -= issue.severity === 'critical' ? 30 : issue.severity === 'high' ? 20 : 10
    } else if (issue.type === 'suspicious') {
      accuracy -= issue.severity === 'high' ? 15 : issue.severity === 'medium' ? 10 : 5
    }
  }
  accuracy = Math.max(0, accuracy)

  // Consistency score (placeholder - would compare against known data)
  const consistency = 85 // Default, would be calculated from cross-source comparison

  // Freshness score based on source
  let freshness = 80
  if (source) {
    if (source.dataFreshness === 'realtime') freshness = 100
    else if (source.dataFreshness === 'daily') freshness = 90
    else if (source.dataFreshness === 'weekly') freshness = 70
    else if (source.dataFreshness === 'monthly') freshness = 50
  }

  // Overall score (weighted average)
  const overall = Math.round(
    completeness * 0.25 +
    accuracy * 0.35 +
    consistency * 0.25 +
    freshness * 0.15
  )

  return {
    overall,
    completeness,
    consistency,
    accuracy,
    freshness,
    issues
  }
}

// Normalize state code
function normalizeState(state: string): string | null {
  const cleaned = state.trim().toUpperCase()
  
  // Already a valid 2-letter code
  const validStates = Object.keys(STATE_TO_REGION)
  if (validStates.includes(cleaned)) {
    return cleaned
  }

  // Try to match full state name
  const stateNames: Record<string, string> = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY'
  }

  return stateNames[cleaned] || null
}

// Normalize property name
function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/MHP|MHC|Mobile Home Park|Manufactured Housing Community/gi, '')
    .trim()
    || name.trim()
}

// Normalize city name
function normalizeCity(city: string): string {
  return city
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Validate URL format
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Generate fingerprint for deduplication
export function generateListingFingerprint(listing: ScrapedListing): string {
  const parts = [
    (listing.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
    (listing.city || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
    (listing.state || '').toUpperCase(),
    listing.units?.toString() || '',
    listing.asking_price?.toString() || ''
  ]
  return parts.join('|')
}

// Calculate similarity between two listings for fuzzy matching
export function calculateListingSimilarity(a: ScrapedListing, b: ScrapedListing): number {
  let score = 0
  let weights = 0

  // Name similarity (high weight)
  if (a.name && b.name) {
    const nameSim = stringSimilarity(a.name.toLowerCase(), b.name.toLowerCase())
    score += nameSim * 30
    weights += 30
  }

  // City/State match (high weight)
  if (a.city && b.city && a.state && b.state) {
    if (a.city.toLowerCase() === b.city.toLowerCase() && a.state.toUpperCase() === b.state.toUpperCase()) {
      score += 25
    }
    weights += 25
  }

  // Address similarity
  if (a.address && b.address) {
    const addrSim = stringSimilarity(a.address.toLowerCase(), b.address.toLowerCase())
    score += addrSim * 20
    weights += 20
  }

  // Unit count proximity
  if (a.units && b.units) {
    const diff = Math.abs(a.units - b.units) / Math.max(a.units, b.units)
    score += (1 - diff) * 10
    weights += 10
  }

  // Price proximity
  if (a.asking_price && b.asking_price) {
    const diff = Math.abs(a.asking_price - b.asking_price) / Math.max(a.asking_price, b.asking_price)
    score += (1 - diff) * 15
    weights += 15
  }

  return weights > 0 ? score / weights : 0
}

// Simple string similarity (Jaccard index on words)
function stringSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))
  
  if (wordsA.size === 0 && wordsB.size === 0) return 1
  if (wordsA.size === 0 || wordsB.size === 0) return 0

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])
  
  return intersection.size / union.size
}

// Batch validation for multiple listings
export function validateListings(
  listings: ScrapedListing[],
  source?: ScraperSource
): {
  valid: ValidationResult[]
  invalid: ValidationResult[]
  duplicates: { original: ScrapedListing; duplicate: ScrapedListing; similarity: number }[]
} {
  const results: ValidationResult[] = []
  const duplicates: { original: ScrapedListing; duplicate: ScrapedListing; similarity: number }[] = []

  // Validate each listing
  for (const listing of listings) {
    results.push(validateListing(listing, source))
  }

  // Check for duplicates within the batch
  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const similarity = calculateListingSimilarity(listings[i], listings[j])
      if (similarity > 0.8) {
        duplicates.push({
          original: listings[i],
          duplicate: listings[j],
          similarity
        })
      }
    }
  }

  return {
    valid: results.filter(r => r.valid),
    invalid: results.filter(r => !r.valid),
    duplicates
  }
}

// Source reliability tracker
export class SourceReliabilityTracker {
  private history: Map<string, { successes: number; failures: number; qualityScores: number[] }> = new Map()

  recordScrape(sourceId: string, success: boolean, qualityScore?: number) {
    const record = this.history.get(sourceId) || { successes: 0, failures: 0, qualityScores: [] }
    
    if (success) {
      record.successes++
      if (qualityScore !== undefined) {
        record.qualityScores.push(qualityScore)
        // Keep only last 100 scores
        if (record.qualityScores.length > 100) {
          record.qualityScores.shift()
        }
      }
    } else {
      record.failures++
    }

    this.history.set(sourceId, record)
  }

  getReliabilityScore(sourceId: string): number {
    const record = this.history.get(sourceId)
    if (!record) return 0.5 // Default for unknown sources

    const total = record.successes + record.failures
    if (total === 0) return 0.5

    // Success rate (0-1)
    const successRate = record.successes / total

    // Average quality score (0-1)
    const avgQuality = record.qualityScores.length > 0
      ? record.qualityScores.reduce((a, b) => a + b, 0) / record.qualityScores.length / 100
      : 0.5

    // Combined score (weighted)
    return successRate * 0.6 + avgQuality * 0.4
  }

  getStats(sourceId: string) {
    return this.history.get(sourceId) || { successes: 0, failures: 0, qualityScores: [] }
  }
}
