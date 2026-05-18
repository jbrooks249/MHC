// Types for the MHP listing scraper system

export interface ScrapedListing {
  name: string
  address: string | null
  city: string
  state: string
  units: number | null
  asking_price: number | null
  cap_rate: number | null
  lot_rent: number | null
  occupancy: number | null
  notes: string | null
  source: string
  listing_url: string
  image_url: string | null
  raw_data: Record<string, unknown>
}

export interface ScrapeJob {
  id: string
  source: string
  url: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  listings_found: number
  listings_added: number
  listings_updated: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ScrapeSource {
  name: string
  base_url: string
  listing_pattern: string
  enabled: boolean
}

export const SCRAPE_SOURCES: ScrapeSource[] = [
  {
    name: 'LoopNet',
    base_url: 'https://www.loopnet.com',
    listing_pattern: '/search/mobile-home-parks/usa/for-sale/',
    enabled: true,
  },
  {
    name: 'MobileHomeParkStore',
    base_url: 'https://www.mobilehomeparkstore.com',
    listing_pattern: '/mobile-home-parks-for-sale',
    enabled: true,
  },
  {
    name: 'Crexi',
    base_url: 'https://www.crexi.com',
    listing_pattern: '/properties/mobile-home-parks',
    enabled: true,
  },
  {
    name: 'CommercialSearch',
    base_url: 'https://commercialsearch.com',
    listing_pattern: '/for-sale/mobile-home-parks/us',
    enabled: true,
  },
]

// Street View image URL generator
export function getStreetViewUrl(address: string, apiKey: string): string {
  const encodedAddress = encodeURIComponent(address)
  return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodedAddress}&key=${apiKey}`
}

// Parse price from string (handles $1.5M, $500K, etc.)
export function parsePrice(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null
  
  const cleaned = priceStr.replace(/[^0-9.KMB]/gi, '').toUpperCase()
  const match = cleaned.match(/^([\d.]+)([KMB])?$/i)
  
  if (!match) return null
  
  let value = parseFloat(match[1])
  const suffix = match[2]
  
  if (suffix === 'K') value *= 1000
  else if (suffix === 'M') value *= 1000000
  else if (suffix === 'B') value *= 1000000000
  
  return Math.round(value)
}

// Parse percentage from string
export function parsePercent(percentStr: string | null | undefined): number | null {
  if (!percentStr) return null
  const match = percentStr.match(/([\d.]+)/)
  return match ? parseFloat(match[1]) : null
}

// Parse unit count from string
export function parseUnits(unitsStr: string | null | undefined): number | null {
  if (!unitsStr) return null
  const match = unitsStr.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

// Extract state abbreviation from location string
export function extractState(location: string): string | null {
  const stateMatch = location.match(/,\s*([A-Z]{2})\s*(?:\d{5})?$/i)
  return stateMatch ? stateMatch[1].toUpperCase() : null
}

// Extract city from location string
export function extractCity(location: string): string | null {
  const parts = location.split(',')
  return parts.length > 0 ? parts[0].trim() : null
}

// Generate a simple AI score based on property attributes
export function calculateAIScore(listing: Partial<ScrapedListing>): number {
  let score = 70 // Base score
  
  // Cap rate bonus (higher is better for value)
  if (listing.cap_rate) {
    if (listing.cap_rate >= 8) score += 15
    else if (listing.cap_rate >= 7) score += 10
    else if (listing.cap_rate >= 6) score += 5
  }
  
  // Occupancy bonus
  if (listing.occupancy) {
    if (listing.occupancy >= 95) score += 10
    else if (listing.occupancy >= 90) score += 7
    else if (listing.occupancy >= 85) score += 3
  }
  
  // Unit count sweet spot (50-150 is ideal for operators)
  if (listing.units) {
    if (listing.units >= 50 && listing.units <= 150) score += 5
    else if (listing.units >= 30 && listing.units <= 200) score += 2
  }
  
  // Price per unit analysis
  if (listing.asking_price && listing.units && listing.units > 0) {
    const pricePerUnit = listing.asking_price / listing.units
    if (pricePerUnit < 50000) score += 10
    else if (pricePerUnit < 75000) score += 5
    else if (pricePerUnit > 150000) score -= 5
  }
  
  return Math.min(100, Math.max(0, score))
}
