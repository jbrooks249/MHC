// Types for the MHP listing scraper system - AGGRESSIVE EDITION

export interface ScrapedListing {
  name: string
  address: string | null
  city: string
  state: string
  zip_code: string | null
  units: number | null
  asking_price: number | null
  cap_rate: number | null
  lot_rent: number | null
  occupancy: number | null
  notes: string | null
  source: string
  source_id: string | null  // Unique ID from source for deduplication
  listing_url: string
  image_url: string | null
  street_view_url: string | null
  raw_data: Record<string, unknown>
  // Geocoding data
  latitude: number | null
  longitude: number | null
  formatted_address: string | null
  // Verification
  address_verified: boolean
  image_verified: boolean
}

export interface ScrapeJob {
  id: string
  source: string
  url: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  listings_found: number
  listings_added: number
  listings_updated: number
  pages_scraped: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ScrapeSource {
  name: string
  base_url: string
  listing_pattern: string
  pagination_pattern?: string  // Pattern for pagination (e.g., ?page={PAGE})
  max_pages?: number
  state_urls?: string[]  // State-specific URLs for deeper crawling
  enabled: boolean
  priority: number  // Higher priority = scraped first
  requires_js: boolean  // Needs JavaScript rendering
}

// COMPREHENSIVE LIST OF MHP LISTING SOURCES
export const SCRAPE_SOURCES: ScrapeSource[] = [
  // PRIMARY SOURCES - High quality, reliable
  {
    name: 'MobileHomeParkStore',
    base_url: 'https://www.mobilehomeparkstore.com',
    listing_pattern: '/mobile-home-parks-for-sale',
    pagination_pattern: '/page/{PAGE}',
    max_pages: 50,
    state_urls: [
      '/mobile-home-parks-for-sale/alabama',
      '/mobile-home-parks-for-sale/arizona',
      '/mobile-home-parks-for-sale/arkansas',
      '/mobile-home-parks-for-sale/california',
      '/mobile-home-parks-for-sale/colorado',
      '/mobile-home-parks-for-sale/connecticut',
      '/mobile-home-parks-for-sale/delaware',
      '/mobile-home-parks-for-sale/florida',
      '/mobile-home-parks-for-sale/georgia',
      '/mobile-home-parks-for-sale/idaho',
      '/mobile-home-parks-for-sale/illinois',
      '/mobile-home-parks-for-sale/indiana',
      '/mobile-home-parks-for-sale/iowa',
      '/mobile-home-parks-for-sale/kansas',
      '/mobile-home-parks-for-sale/kentucky',
      '/mobile-home-parks-for-sale/louisiana',
      '/mobile-home-parks-for-sale/maine',
      '/mobile-home-parks-for-sale/maryland',
      '/mobile-home-parks-for-sale/massachusetts',
      '/mobile-home-parks-for-sale/michigan',
      '/mobile-home-parks-for-sale/minnesota',
      '/mobile-home-parks-for-sale/mississippi',
      '/mobile-home-parks-for-sale/missouri',
      '/mobile-home-parks-for-sale/montana',
      '/mobile-home-parks-for-sale/nebraska',
      '/mobile-home-parks-for-sale/nevada',
      '/mobile-home-parks-for-sale/new-hampshire',
      '/mobile-home-parks-for-sale/new-jersey',
      '/mobile-home-parks-for-sale/new-mexico',
      '/mobile-home-parks-for-sale/new-york',
      '/mobile-home-parks-for-sale/north-carolina',
      '/mobile-home-parks-for-sale/north-dakota',
      '/mobile-home-parks-for-sale/ohio',
      '/mobile-home-parks-for-sale/oklahoma',
      '/mobile-home-parks-for-sale/oregon',
      '/mobile-home-parks-for-sale/pennsylvania',
      '/mobile-home-parks-for-sale/rhode-island',
      '/mobile-home-parks-for-sale/south-carolina',
      '/mobile-home-parks-for-sale/south-dakota',
      '/mobile-home-parks-for-sale/tennessee',
      '/mobile-home-parks-for-sale/texas',
      '/mobile-home-parks-for-sale/utah',
      '/mobile-home-parks-for-sale/vermont',
      '/mobile-home-parks-for-sale/virginia',
      '/mobile-home-parks-for-sale/washington',
      '/mobile-home-parks-for-sale/west-virginia',
      '/mobile-home-parks-for-sale/wisconsin',
      '/mobile-home-parks-for-sale/wyoming',
    ],
    enabled: true,
    priority: 10,
    requires_js: false,
  },
  {
    name: 'LoopNet',
    base_url: 'https://www.loopnet.com',
    listing_pattern: '/search/mobile-home-parks/usa/for-sale/',
    pagination_pattern: '{PAGE}/',
    max_pages: 100,
    enabled: true,
    priority: 10,
    requires_js: true,
  },
  {
    name: 'Crexi',
    base_url: 'https://www.crexi.com',
    listing_pattern: '/properties/us/mobile-home-parks',
    pagination_pattern: '?page={PAGE}',
    max_pages: 50,
    enabled: true,
    priority: 9,
    requires_js: true,
  },
  {
    name: 'CREXi Commercial',
    base_url: 'https://www.crexi.com',
    listing_pattern: '/properties/us/manufactured-housing',
    pagination_pattern: '?page={PAGE}',
    max_pages: 50,
    enabled: true,
    priority: 9,
    requires_js: true,
  },
  {
    name: 'CommercialCafe',
    base_url: 'https://www.commercialcafe.com',
    listing_pattern: '/mobile-home-parks-for-sale',
    pagination_pattern: '/page-{PAGE}',
    max_pages: 30,
    enabled: true,
    priority: 8,
    requires_js: true,
  },
  
  // SECONDARY SOURCES - Good data, moderate reliability
  {
    name: 'BizBuySell',
    base_url: 'https://www.bizbuysell.com',
    listing_pattern: '/mobile-home-rv-parks-for-sale/',
    pagination_pattern: '?q={PAGE}',
    max_pages: 20,
    enabled: true,
    priority: 7,
    requires_js: false,
  },
  {
    name: 'BizQuest',
    base_url: 'https://www.bizquest.com',
    listing_pattern: '/mobile-home-park-businesses-for-sale/',
    pagination_pattern: '?page={PAGE}',
    max_pages: 20,
    enabled: true,
    priority: 7,
    requires_js: false,
  },
  {
    name: 'TenX Commercial',
    base_url: 'https://www.ten-x.com',
    listing_pattern: '/commercial-real-estate/mobile-home-parks-for-sale',
    pagination_pattern: '?page={PAGE}',
    max_pages: 15,
    enabled: true,
    priority: 7,
    requires_js: true,
  },
  {
    name: 'CommercialSearch',
    base_url: 'https://commercialsearch.com',
    listing_pattern: '/for-sale/mobile-home-parks/us',
    pagination_pattern: '?page={PAGE}',
    max_pages: 30,
    enabled: true,
    priority: 7,
    requires_js: false,
  },
  
  // TERTIARY SOURCES - Supplementary data
  {
    name: 'RealtyTrac',
    base_url: 'https://www.realtytrac.com',
    listing_pattern: '/mobileHomePark/for-sale/',
    max_pages: 10,
    enabled: true,
    priority: 6,
    requires_js: false,
  },
  {
    name: 'PropertyShark',
    base_url: 'https://www.propertyshark.com',
    listing_pattern: '/commercial-real-estate/mobile-home-parks-for-sale',
    max_pages: 15,
    enabled: true,
    priority: 6,
    requires_js: true,
  },
  {
    name: 'Reonomy',
    base_url: 'https://www.reonomy.com',
    listing_pattern: '/properties/mobile-home-parks',
    max_pages: 20,
    enabled: true,
    priority: 5,
    requires_js: true,
  },
  {
    name: 'CoStar',
    base_url: 'https://www.costar.com',
    listing_pattern: '/properties/mobile-home-parks-for-sale',
    max_pages: 30,
    enabled: true,
    priority: 5,
    requires_js: true,
  },
  
  // BROKER SITES - Often have exclusive listings
  {
    name: 'MarcusMillichap',
    base_url: 'https://www.marcusmillichap.com',
    listing_pattern: '/properties/mobile-home-parks',
    max_pages: 20,
    enabled: true,
    priority: 8,
    requires_js: true,
  },
  {
    name: 'CBRE',
    base_url: 'https://www.cbre.com',
    listing_pattern: '/properties/mobile-home-parks-for-sale',
    max_pages: 15,
    enabled: true,
    priority: 8,
    requires_js: true,
  },
  {
    name: 'JLL',
    base_url: 'https://www.jll.com',
    listing_pattern: '/real-estate/mobile-home-parks-for-sale',
    max_pages: 15,
    enabled: true,
    priority: 7,
    requires_js: true,
  },
  {
    name: 'Cushman',
    base_url: 'https://www.cushmanwakefield.com',
    listing_pattern: '/properties/mobile-home-parks',
    max_pages: 15,
    enabled: true,
    priority: 7,
    requires_js: true,
  },
  
  // REGIONAL/NICHE SOURCES
  {
    name: 'LandWatch',
    base_url: 'https://www.landwatch.com',
    listing_pattern: '/mobile-home-parks/united-states/for-sale',
    pagination_pattern: '/page-{PAGE}',
    max_pages: 30,
    enabled: true,
    priority: 6,
    requires_js: false,
  },
  {
    name: 'LandAndFarm',
    base_url: 'https://www.landandfarm.com',
    listing_pattern: '/search/mobile-home-parks-for-sale',
    max_pages: 20,
    enabled: true,
    priority: 6,
    requires_js: false,
  },
  {
    name: 'RVParkStore',
    base_url: 'https://www.rvparkstore.com',
    listing_pattern: '/rv-parks-for-sale',
    max_pages: 30,
    enabled: true,
    priority: 5,
    requires_js: false,
  },
  {
    name: 'CampgroundForSale',
    base_url: 'https://www.campgroundsforsale.com',
    listing_pattern: '/listings',
    max_pages: 20,
    enabled: true,
    priority: 4,
    requires_js: false,
  },
  
  // AUCTION SITES
  {
    name: 'Auction.com',
    base_url: 'https://www.auction.com',
    listing_pattern: '/commercial/mobile-home-parks',
    max_pages: 10,
    enabled: true,
    priority: 6,
    requires_js: true,
  },
  {
    name: 'Hubzu',
    base_url: 'https://www.hubzu.com',
    listing_pattern: '/commercial-properties/mobile-home-parks',
    max_pages: 10,
    enabled: true,
    priority: 5,
    requires_js: true,
  },
]

// State abbreviations mapping
export const STATE_ABBREVIATIONS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
}

// Reverse mapping
export const STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBREVIATIONS).map(([name, abbr]) => [abbr, name])
)

// Street View image URL generator
export function getStreetViewUrl(address: string, apiKey: string, size: string = '800x600'): string {
  const encodedAddress = encodeURIComponent(address)
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${encodedAddress}&key=${apiKey}&source=outdoor`
}

// Parse price from string (handles $1.5M, $500K, $1,500,000, etc.)
export function parsePrice(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null
  
  // Remove all non-numeric characters except . and letters for suffixes
  const cleaned = priceStr.replace(/[$,\s]/g, '').toUpperCase()
  const match = cleaned.match(/^([\d.]+)\s*([KMB]|MILLION|THOUSAND|BILLION)?$/i)
  
  if (!match) {
    // Try to extract just numbers
    const numMatch = priceStr.replace(/[^0-9.]/g, '').match(/^[\d.]+/)
    if (numMatch) {
      const val = parseFloat(numMatch[0])
      // If it's a small number, it's likely in millions
      if (val < 100 && priceStr.toLowerCase().includes('m')) return val * 1000000
      if (val < 10000 && priceStr.toLowerCase().includes('k')) return val * 1000
      return val
    }
    return null
  }
  
  let value = parseFloat(match[1])
  const suffix = match[2]?.toUpperCase()
  
  if (suffix === 'K' || suffix === 'THOUSAND') value *= 1000
  else if (suffix === 'M' || suffix === 'MILLION') value *= 1000000
  else if (suffix === 'B' || suffix === 'BILLION') value *= 1000000000
  
  return Math.round(value)
}

// Parse percentage from string
export function parsePercent(percentStr: string | null | undefined): number | null {
  if (!percentStr) return null
  const match = percentStr.match(/([\d.]+)\s*%?/)
  return match ? parseFloat(match[1]) : null
}

// Parse unit count from string
export function parseUnits(unitsStr: string | null | undefined): number | null {
  if (!unitsStr) return null
  // Match various patterns: "50 units", "50 lots", "50 spaces", "50-unit", etc.
  const match = unitsStr.match(/(\d+)\s*(?:units?|lots?|sites?|spaces?|pads?|homes?)?/i)
  return match ? parseInt(match[1], 10) : null
}

// Extract state abbreviation from location string
export function extractState(location: string): string | null {
  if (!location) return null
  
  // Try to find state abbreviation
  const abbrMatch = location.match(/\b([A-Z]{2})\b/)
  if (abbrMatch && STATE_NAMES[abbrMatch[1]]) {
    return abbrMatch[1]
  }
  
  // Try to find full state name
  const locationLower = location.toLowerCase()
  for (const [name, abbr] of Object.entries(STATE_ABBREVIATIONS)) {
    if (locationLower.includes(name)) {
      return abbr
    }
  }
  
  // Try comma-separated pattern
  const commaMatch = location.match(/,\s*([A-Za-z\s]+)(?:\s+\d{5})?$/)
  if (commaMatch) {
    const potentialState = commaMatch[1].trim().toUpperCase()
    if (potentialState.length === 2 && STATE_NAMES[potentialState]) {
      return potentialState
    }
    const stateLower = commaMatch[1].trim().toLowerCase()
    if (STATE_ABBREVIATIONS[stateLower]) {
      return STATE_ABBREVIATIONS[stateLower]
    }
  }
  
  return null
}

// Extract city from location string
export function extractCity(location: string): string | null {
  if (!location) return null
  
  // Split by comma and take first part
  const parts = location.split(',')
  if (parts.length > 0) {
    // Clean up the city name
    let city = parts[0].trim()
    // Remove any leading numbers (street addresses)
    city = city.replace(/^\d+\s+[\w\s]+(?:st|nd|rd|th|street|ave|avenue|blvd|boulevard|road|rd|drive|dr|lane|ln|way|court|ct|place|pl)\s*/i, '')
    return city || parts[0].trim()
  }
  return null
}

// Extract ZIP code
export function extractZipCode(location: string): string | null {
  if (!location) return null
  const match = location.match(/\b(\d{5})(?:-\d{4})?\b/)
  return match ? match[1] : null
}

// Generate a unique source ID for deduplication
export function generateSourceId(source: string, listing: Partial<ScrapedListing>): string {
  const parts = [
    source,
    listing.name?.toLowerCase().replace(/\s+/g, '-').slice(0, 50),
    listing.city?.toLowerCase(),
    listing.state?.toUpperCase(),
  ].filter(Boolean)
  return parts.join('_')
}

// Generate a simple AI score based on property attributes
export function calculateAIScore(listing: Partial<ScrapedListing>): number {
  let score = 70 // Base score
  
  // Cap rate bonus (higher is better for value)
  if (listing.cap_rate) {
    if (listing.cap_rate >= 10) score += 20
    else if (listing.cap_rate >= 8) score += 15
    else if (listing.cap_rate >= 7) score += 10
    else if (listing.cap_rate >= 6) score += 5
  }
  
  // Occupancy bonus
  if (listing.occupancy) {
    if (listing.occupancy >= 95) score += 10
    else if (listing.occupancy >= 90) score += 7
    else if (listing.occupancy >= 85) score += 3
    else if (listing.occupancy < 70) score -= 5
  }
  
  // Unit count sweet spot (50-150 is ideal for operators)
  if (listing.units) {
    if (listing.units >= 50 && listing.units <= 150) score += 8
    else if (listing.units >= 30 && listing.units <= 200) score += 4
    else if (listing.units >= 20) score += 2
    else if (listing.units < 15) score -= 3
  }
  
  // Price per unit analysis
  if (listing.asking_price && listing.units && listing.units > 0) {
    const pricePerUnit = listing.asking_price / listing.units
    if (pricePerUnit < 30000) score += 15
    else if (pricePerUnit < 50000) score += 10
    else if (pricePerUnit < 75000) score += 5
    else if (pricePerUnit > 150000) score -= 5
    else if (pricePerUnit > 200000) score -= 10
  }
  
  // Lot rent analysis
  if (listing.lot_rent) {
    if (listing.lot_rent >= 400) score += 5
    else if (listing.lot_rent >= 300) score += 3
    else if (listing.lot_rent < 200) score -= 2
  }
  
  // Address verification bonus
  if (listing.address_verified) score += 3
  if (listing.image_verified) score += 2
  
  return Math.min(100, Math.max(0, Math.round(score)))
}

// Geocoding result type
export interface GeocodingResult {
  formatted_address: string
  latitude: number
  longitude: number
  street_number?: string
  route?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
}

// Street View metadata result
export interface StreetViewMetadata {
  status: 'OK' | 'ZERO_RESULTS' | 'NOT_FOUND' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'INVALID_REQUEST' | 'UNKNOWN_ERROR'
  location?: {
    lat: number
    lng: number
  }
  date?: string
  pano_id?: string
}
