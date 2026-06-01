import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Firecrawl from '@mendable/firecrawl-js'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// MHP listing source configurations with improved patterns
const SOURCES = [
  {
    name: 'MobileHomeParkStore',
    url: 'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale',
    stateUrls: [
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/florida',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/texas',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/arizona',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/california',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/georgia',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/north-carolina',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/ohio',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/michigan',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/indiana',
      'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/tennessee',
    ],
    extractionPrompt: `Extract all mobile home park listings from this page. For each listing, provide:
- name: The property or park name
- location: City, State format
- price: The asking price (include full number or M/K notation)
- units: Number of lots/spaces/units
- lot_rent: Monthly lot rent if shown
- cap_rate: Cap rate percentage if shown
- property_url: The full URL to the listing detail page`
  },
  {
    name: 'LoopNet',
    url: 'https://www.loopnet.com/search/mobile-home-parks/usa/for-sale/',
    extractionPrompt: `Extract all mobile home park listings from this page. For each listing, provide:
- name: The property name or title
- address: Full street address if shown
- location: City, State format
- price: The asking price
- units: Number of units/spaces
- cap_rate: Cap rate if shown
- property_url: The full URL to the listing detail page
- image_url: Main property image URL if shown`
  },
  {
    name: 'Crexi',
    url: 'https://www.crexi.com/properties?propertyTypes=mobile-home-park',
    extractionPrompt: `Extract all mobile home park and manufactured housing community listings. For each listing, provide:
- name: Property name
- location: City, State
- price: Asking price
- units: Number of units/pads
- cap_rate: Cap rate percentage
- property_url: Link to listing details`
  }
]

// Improved extraction schema for Firecrawl
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    listings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Property name or title' },
          address: { type: 'string', description: 'Street address if available' },
          location: { type: 'string', description: 'City, State format' },
          price: { type: 'string', description: 'Asking price (can include $, M, K)' },
          units: { type: 'string', description: 'Number of units, lots, spaces, or pads' },
          cap_rate: { type: 'string', description: 'Cap rate percentage' },
          lot_rent: { type: 'string', description: 'Monthly lot rent' },
          occupancy: { type: 'string', description: 'Occupancy percentage' },
          property_url: { type: 'string', description: 'Full URL to listing detail page' },
          image_url: { type: 'string', description: 'Property image URL' },
        },
        required: ['name', 'location']
      }
    }
  }
}

// Parse price string to number - handles various formats
function parsePrice(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null
  
  // Remove currency symbols, commas, spaces
  const cleaned = priceStr.replace(/[$,\s]/g, '').trim().toUpperCase()
  
  // Match number with optional M/K/B suffix
  const match = cleaned.match(/^([\d.]+)\s*(M|K|B|MILLION|THOUSAND)?$/i)
  if (!match) {
    // Try to extract just the number
    const numMatch = cleaned.match(/[\d.]+/)
    if (numMatch) {
      return Math.round(parseFloat(numMatch[0]))
    }
    return null
  }
  
  let value = parseFloat(match[1])
  const suffix = match[2]?.toUpperCase()
  
  if (suffix === 'M' || suffix === 'MILLION') value *= 1000000
  else if (suffix === 'K' || suffix === 'THOUSAND') value *= 1000
  else if (suffix === 'B') value *= 1000000000
  
  return Math.round(value)
}

// Parse units from string
function parseUnits(unitsStr: string | null | undefined): number | null {
  if (!unitsStr) return null
  const match = unitsStr.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

// Parse percentage from string
function parsePercent(percentStr: string | null | undefined): number | null {
  if (!percentStr) return null
  const match = percentStr.match(/([\d.]+)/)
  return match ? parseFloat(match[1]) : null
}

// Extract city from location string
function extractCity(location: string): string {
  if (!location) return 'Unknown'
  const parts = location.split(',')
  return parts[0]?.trim() || 'Unknown'
}

// Extract state from location string
function extractState(location: string): string {
  if (!location) return 'XX'
  
  // Try to find state abbreviation
  const stateMatch = location.match(/\b([A-Z]{2})\b/)
  if (stateMatch) return stateMatch[1]
  
  // Try to find state name
  const stateNames: Record<string, string> = {
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
    'wisconsin': 'WI', 'wyoming': 'WY'
  }
  
  const locationLower = location.toLowerCase()
  for (const [name, abbr] of Object.entries(stateNames)) {
    if (locationLower.includes(name)) return abbr
  }
  
  return 'XX'
}

// Get region from state
function getRegion(state: string): string {
  const regions: Record<string, string> = {
    'FL': 'Southeast', 'GA': 'Southeast', 'SC': 'Southeast', 'NC': 'Southeast',
    'AL': 'Southeast', 'MS': 'Southeast', 'TN': 'Southeast', 'KY': 'Southeast',
    'VA': 'Southeast', 'WV': 'Southeast',
    'TX': 'Southwest', 'AZ': 'Southwest', 'NM': 'Southwest', 'OK': 'Southwest',
    'AR': 'Southwest', 'LA': 'Southwest',
    'CA': 'Pacific', 'HI': 'Pacific',
    'OR': 'Pacific NW', 'WA': 'Pacific NW', 'AK': 'Pacific NW',
    'NV': 'Mountain', 'CO': 'Mountain', 'UT': 'Mountain', 'ID': 'Mountain', 
    'MT': 'Mountain', 'WY': 'Mountain',
    'OH': 'Midwest', 'IN': 'Midwest', 'MI': 'Midwest', 'IL': 'Midwest',
    'WI': 'Midwest', 'MN': 'Midwest', 'IA': 'Midwest', 'MO': 'Midwest',
    'KS': 'Midwest', 'NE': 'Midwest', 'SD': 'Midwest', 'ND': 'Midwest',
    'NY': 'Northeast', 'PA': 'Northeast', 'NJ': 'Northeast', 'MA': 'Northeast',
    'CT': 'Northeast', 'RI': 'Northeast', 'VT': 'Northeast', 'NH': 'Northeast', 
    'ME': 'Northeast', 'MD': 'Northeast', 'DE': 'Northeast',
  }
  return regions[state] || 'Other'
}

// State coordinates for map display
const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  'FL': { lat: 28.0, lng: -81.5 }, 'TX': { lat: 31.0, lng: -100.0 },
  'AZ': { lat: 34.0, lng: -111.0 }, 'CA': { lat: 36.7, lng: -119.4 },
  'GA': { lat: 33.0, lng: -83.5 }, 'NC': { lat: 35.5, lng: -79.0 },
  'OH': { lat: 40.4, lng: -82.9 }, 'MI': { lat: 44.3, lng: -85.6 },
  'IN': { lat: 40.0, lng: -86.0 }, 'TN': { lat: 35.5, lng: -86.0 },
  'CO': { lat: 39.0, lng: -105.5 }, 'OR': { lat: 44.0, lng: -120.5 },
  'WA': { lat: 47.5, lng: -120.5 }, 'NV': { lat: 39.0, lng: -117.0 },
  'AL': { lat: 32.8, lng: -86.8 }, 'SC': { lat: 34.0, lng: -81.0 },
  'KY': { lat: 37.8, lng: -85.8 }, 'MO': { lat: 38.6, lng: -92.6 },
  'IL': { lat: 40.0, lng: -89.4 }, 'PA': { lat: 41.0, lng: -77.5 },
  'NY': { lat: 43.0, lng: -75.5 }, 'NJ': { lat: 40.2, lng: -74.7 },
  'VA': { lat: 37.5, lng: -78.8 }, 'WI': { lat: 44.5, lng: -89.8 },
  'MN': { lat: 46.3, lng: -94.3 }, 'IA': { lat: 42.0, lng: -93.5 },
  'OK': { lat: 35.5, lng: -97.5 }, 'AR': { lat: 34.8, lng: -92.2 },
  'LA': { lat: 31.0, lng: -92.0 }, 'MS': { lat: 32.7, lng: -89.7 },
  'NM': { lat: 34.5, lng: -106.0 }, 'UT': { lat: 39.3, lng: -111.7 },
  'ID': { lat: 44.0, lng: -114.7 }, 'MT': { lat: 47.0, lng: -110.0 },
  'WY': { lat: 43.0, lng: -107.5 }, 'KS': { lat: 38.5, lng: -98.8 },
  'NE': { lat: 41.5, lng: -99.8 }, 'SD': { lat: 44.4, lng: -100.2 },
  'ND': { lat: 47.5, lng: -100.5 }, 'MA': { lat: 42.4, lng: -71.4 },
  'CT': { lat: 41.6, lng: -72.7 }, 'RI': { lat: 41.7, lng: -71.5 },
  'NH': { lat: 43.2, lng: -71.6 }, 'VT': { lat: 44.0, lng: -72.7 },
  'ME': { lat: 45.3, lng: -69.0 }, 'MD': { lat: 39.0, lng: -76.6 },
  'DE': { lat: 39.0, lng: -75.5 }, 'WV': { lat: 38.9, lng: -80.5 },
}

// Calculate AI score based on property metrics
function calculateAIScore(listing: {
  asking_price?: number | null
  units?: number | null
  cap_rate?: number | null
  occupancy?: number | null
  lot_rent?: number | null
}): number {
  let score = 70 // Base score
  
  // Cap rate scoring (higher is better)
  if (listing.cap_rate) {
    if (listing.cap_rate >= 8) score += 15
    else if (listing.cap_rate >= 7) score += 10
    else if (listing.cap_rate >= 6) score += 5
    else if (listing.cap_rate < 5) score -= 5
  }
  
  // Occupancy scoring
  if (listing.occupancy) {
    if (listing.occupancy >= 95) score += 10
    else if (listing.occupancy >= 90) score += 7
    else if (listing.occupancy >= 85) score += 3
    else if (listing.occupancy < 70) score -= 5
  }
  
  // Units scoring (50-150 is ideal for operators)
  if (listing.units) {
    if (listing.units >= 50 && listing.units <= 150) score += 5
    else if (listing.units >= 30 && listing.units <= 200) score += 2
    else if (listing.units < 20) score -= 3
  }
  
  // Price per unit analysis
  if (listing.asking_price && listing.units && listing.units > 0) {
    const pricePerUnit = listing.asking_price / listing.units
    if (pricePerUnit < 50000) score += 10
    else if (pricePerUnit < 75000) score += 5
    else if (pricePerUnit > 150000) score -= 5
  }
  
  // Lot rent scoring (higher is better)
  if (listing.lot_rent) {
    if (listing.lot_rent >= 500) score += 5
    else if (listing.lot_rent >= 400) score += 3
    else if (listing.lot_rent < 250) score -= 3
  }
  
  return Math.min(100, Math.max(0, score))
}

// Get Street View image URL
function getStreetViewUrl(address: string, city: string, state: string): string | null {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null
  
  const location = encodeURIComponent(`${address}, ${city}, ${state}`)
  return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${location}&key=${apiKey}`
}

interface RawListing {
  name?: string
  address?: string
  location?: string
  price?: string
  units?: string
  cap_rate?: string
  lot_rent?: string
  occupancy?: string
  property_url?: string
  image_url?: string
}

// Process raw scraped data into a standardized listing format
function processRawListing(raw: RawListing, source: string, sourceUrl: string) {
  const city = extractCity(raw.location || raw.address || '')
  const state = extractState(raw.location || raw.address || '')
  
  const listing = {
    name: raw.name || 'Unnamed Property',
    address: raw.address || null,
    city,
    state,
    region: getRegion(state),
    units: parseUnits(raw.units),
    asking_price: parsePrice(raw.price),
    cap_rate: parsePercent(raw.cap_rate),
    lot_rent: parsePrice(raw.lot_rent),
    occupancy: parsePercent(raw.occupancy),
    source,
    listing_url: raw.property_url?.startsWith('http') 
      ? raw.property_url 
      : raw.property_url 
        ? new URL(raw.property_url, sourceUrl).href
        : sourceUrl,
    image_url: raw.image_url || null,
    ai_score: 0,
    status: 'active' as const,
    mom_pop: true,
    latitude: null as number | null,
    longitude: null as number | null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  
  // Calculate AI score
  listing.ai_score = calculateAIScore(listing)
  
  // Add approximate coordinates for map display (jittered around state center)
  const coords = STATE_COORDS[state]
  if (coords) {
    listing.latitude = coords.lat + (Math.random() - 0.5) * 2
    listing.longitude = coords.lng + (Math.random() - 0.5) * 2
  }
  
  // Add Street View image if we have address and no image
  if (!listing.image_url && listing.address) {
    const streetViewUrl = getStreetViewUrl(listing.address, listing.city, listing.state)
    if (streetViewUrl) {
      listing.image_url = streetViewUrl
    }
  }
  
  return listing
}

// Scrape a single URL with retry logic (Firecrawl v4 API)
async function scrapeUrlWithRetry(
  firecrawl: Firecrawl, 
  url: string, 
  extractionPrompt: string,
  maxRetries = 2
): Promise<{ success: boolean; listings: RawListing[]; error?: string }> {
  let lastError = ''
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Use the v4 scrape API with a JSON format for structured extraction
      const doc = await firecrawl.scrape(url, {
        formats: [
          {
            type: 'json',
            prompt: extractionPrompt,
            schema: EXTRACTION_SCHEMA,
          },
          'markdown',
        ],
        onlyMainContent: true,
        waitFor: 3000,
        timeout: 60000,
      })

      // The structured data lives on doc.json
      const json = doc?.json as { listings?: RawListing[] } | undefined
      if (json?.listings && json.listings.length > 0) {
        return { success: true, listings: json.listings }
      }
      
      // Fallback: parse the markdown content manually
      if (doc?.markdown) {
        const manualListings = parseMarkdownContent(doc.markdown, url)
        if (manualListings.length > 0) {
          return { success: true, listings: manualListings }
        }
      }
      
      lastError = 'No listings found in response'
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[v0] Scrape attempt ${attempt + 1} failed for ${url}:`, lastError)
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
      }
    }
  }
  
  return { success: false, listings: [], error: lastError }
}

// Parse markdown content as fallback
function parseMarkdownContent(markdown: string, sourceUrl: string): RawListing[] {
  const listings: RawListing[] = []
  
  // Pattern to find property listings in markdown
  const pricePattern = /\$[\d,]+(?:\.\d{2})?(?:\s*(?:M|K|Million|Thousand))?/gi
  const unitsPattern = /(\d+)\s*(?:units?|lots?|sites?|spaces?|pads?)/gi
  const locationPattern = /([A-Za-z\s]+),\s*([A-Z]{2})/g
  
  // Extract all matches
  const prices = markdown.match(pricePattern) || []
  const unitsMatches = [...markdown.matchAll(unitsPattern)]
  const locationMatches = [...markdown.matchAll(locationPattern)]
  
  // Try to build listings from extracted data
  const count = Math.min(locationMatches.length, 20) // Limit to prevent runaway
  
  for (let i = 0; i < count; i++) {
    const locationMatch = locationMatches[i]
    if (locationMatch) {
      listings.push({
        name: `MHP in ${locationMatch[1].trim()}`,
        location: `${locationMatch[1].trim()}, ${locationMatch[2]}`,
        price: prices[i] || undefined,
        units: unitsMatches[i]?.[1] || undefined,
        property_url: sourceUrl,
      })
    }
  }
  
  return listings
}

export async function POST(request: NextRequest) {
  try {
    // Allow admin requests from dashboard
    let isAdminRequest = false
    try {
      const body = await request.json()
      isAdminRequest = body?.adminTrigger === true
    } catch {
      // No body or invalid JSON - that's fine for cron jobs
    }

    // Verify authorization for non-admin requests
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!isAdminRequest && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlKey) {
      return NextResponse.json({ 
        error: 'FIRECRAWL_API_KEY not configured',
        message: 'Please add your Firecrawl API key in the project settings'
      }, { status: 500 })
    }

    const firecrawl = new Firecrawl({ apiKey: firecrawlKey })
    
    const results = {
      total_scraped: 0,
      total_added: 0,
      total_updated: 0,
      sources: [] as Array<{ source: string; url: string; found: number; added: number; updated: number }>,
      errors: [] as string[]
    }

    // Process each source
    for (const source of SOURCES) {
      const urls = source.stateUrls || [source.url]
      
      for (const url of urls) {
        // Create job record for tracking
        const { data: job } = await supabase
          .from('scrape_jobs')
          .insert({
            source: source.name,
            url: url,
            status: 'running',
            started_at: new Date().toISOString(),
            listings_found: 0,
            listings_added: 0,
            listings_updated: 0,
          })
          .select()
          .single()

        try {
          const { success, listings: rawListings, error } = await scrapeUrlWithRetry(
            firecrawl,
            url,
            source.extractionPrompt
          )

          if (!success || rawListings.length === 0) {
            throw new Error(error || 'No listings found')
          }

          let added = 0
          let updated = 0

          // Process each listing
          for (const raw of rawListings) {
            // Skip invalid listings
            if (!raw.name && !raw.location) continue
            
            const listing = processRawListing(raw, source.name, url)
            
            // Skip if we couldn't determine location
            if (listing.state === 'XX' || listing.city === 'Unknown') continue

            // Check for existing listing by name + city + state (deduplication)
            const { data: existing } = await supabase
              .from('properties')
              .select('id, asking_price')
              .eq('name', listing.name)
              .eq('city', listing.city)
              .eq('state', listing.state)
              .single()

            if (existing) {
              // Update only if price changed
              if (existing.asking_price !== listing.asking_price) {
                await supabase
                  .from('properties')
                  .update({
                    asking_price: listing.asking_price,
                    cap_rate: listing.cap_rate,
                    lot_rent: listing.lot_rent,
                    occupancy: listing.occupancy,
                    ai_score: listing.ai_score,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existing.id)
                updated++
              }
            } else {
              // Insert new listing
              const { error: insertError } = await supabase
                .from('properties')
                .insert(listing)
              
              if (!insertError) {
                added++
              } else {
                console.error(`[v0] Insert error for ${listing.name}:`, insertError.message)
              }
            }
          }

          // Update job status
          await supabase
            .from('scrape_jobs')
            .update({
              status: 'completed',
              listings_found: rawListings.length,
              listings_added: added,
              listings_updated: updated,
              completed_at: new Date().toISOString()
            })
            .eq('id', job?.id)

          results.total_scraped += rawListings.length
          results.total_added += added
          results.total_updated += updated
          results.sources.push({
            source: source.name,
            url,
            found: rawListings.length,
            added,
            updated
          })

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`${source.name} (${url}): ${errorMessage}`)
          
          await supabase
            .from('scrape_jobs')
            .update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString()
            })
            .eq('id', job?.id)
        }
        
        // Small delay between URLs to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[v0] Scrape error:', error)
    return NextResponse.json({ 
      error: 'Scrape failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check scrape status and recent jobs
export async function GET() {
  try {
    const { data: recentJobs } = await supabase
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    const { count: totalProperties } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })

    const { count: activeProperties } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    return NextResponse.json({
      recentJobs: recentJobs || [],
      stats: {
        totalProperties: totalProperties || 0,
        activeProperties: activeProperties || 0,
        lastScrape: recentJobs?.[0]?.created_at || null
      }
    })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
