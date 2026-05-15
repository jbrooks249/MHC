import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import {
  ScrapedListing,
  ScrapeJob,
  ScrapeSource,
  SCRAPE_SOURCES,
  parsePrice,
  parsePercent,
  parseUnits,
  extractCity,
  extractState,
  extractZipCode,
  calculateAIScore,
  getStreetViewUrl,
  generateSourceId,
  GeocodingResult,
  StreetViewMetadata,
  STATE_ABBREVIATIONS,
} from './scraper-types'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Rate limiting helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ============================================================================
// GEOCODING SERVICE
// ============================================================================

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  try {
    const encodedAddress = encodeURIComponent(address)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status !== 'OK' || !data.results?.[0]) {
      return null
    }
    
    const result = data.results[0]
    const components = result.address_components || []
    
    const getComponent = (type: string) => 
      components.find((c: { types: string[] }) => c.types.includes(type))?.long_name
    
    const getShortComponent = (type: string) => 
      components.find((c: { types: string[] }) => c.types.includes(type))?.short_name
    
    return {
      formatted_address: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      street_number: getComponent('street_number'),
      route: getComponent('route'),
      city: getComponent('locality') || getComponent('administrative_area_level_2'),
      state: getShortComponent('administrative_area_level_1'),
      zip_code: getComponent('postal_code'),
      country: getShortComponent('country'),
    }
  } catch (error) {
    console.error('[Scraper] Geocoding error:', error)
    return null
  }
}

// ============================================================================
// STREET VIEW SERVICE
// ============================================================================

export async function checkStreetViewAvailability(
  location: string | { lat: number; lng: number }
): Promise<StreetViewMetadata | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  try {
    const locationParam = typeof location === 'string'
      ? `location=${encodeURIComponent(location)}`
      : `location=${location.lat},${location.lng}`
    
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?${locationParam}&key=${apiKey}`
    
    const response = await fetch(url)
    return await response.json()
  } catch (error) {
    console.error('[Scraper] Street View metadata error:', error)
    return null
  }
}

export async function getVerifiedStreetViewUrl(
  address: string,
  apiKey: string
): Promise<{ url: string | null; verified: boolean }> {
  const metadata = await checkStreetViewAvailability(address)
  
  if (metadata?.status === 'OK') {
    return {
      url: getStreetViewUrl(address, apiKey),
      verified: true,
    }
  }
  
  return { url: null, verified: false }
}

// ============================================================================
// FIRECRAWL EXTRACTION SCHEMAS
// ============================================================================

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    listings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Property name or title' },
          address: { type: 'string', description: 'Full street address including number and street name' },
          city: { type: 'string', description: 'City name' },
          state: { type: 'string', description: 'State name or abbreviation' },
          zip_code: { type: 'string', description: 'ZIP code' },
          location: { type: 'string', description: 'Full location string if separate fields not available' },
          price: { type: 'string', description: 'Asking price' },
          cap_rate: { type: 'string', description: 'Cap rate percentage' },
          units: { type: 'string', description: 'Number of units/lots/spaces/pads' },
          lot_rent: { type: 'string', description: 'Monthly lot rent' },
          occupancy: { type: 'string', description: 'Occupancy percentage' },
          property_url: { type: 'string', description: 'URL to the listing detail page' },
          image_url: { type: 'string', description: 'Main property image URL' },
          listing_id: { type: 'string', description: 'Unique listing ID or reference number' },
          description: { type: 'string', description: 'Property description or notes' },
        },
      },
    },
    next_page_url: { type: 'string', description: 'URL to the next page of listings if pagination exists' },
    total_listings: { type: 'string', description: 'Total number of listings if shown' },
  },
}

const AGGRESSIVE_EXTRACTION_PROMPT = `
You are an expert data extractor specializing in mobile home park and manufactured housing community listings.

EXTRACT EVERY SINGLE LISTING on this page. Be AGGRESSIVE - do not miss any properties.

For EACH listing, capture:
1. Property name/title (REQUIRED)
2. FULL street address with number - this is CRITICAL for Street View images
3. City (REQUIRED)
4. State (REQUIRED) 
5. ZIP code
6. Asking price
7. Number of units/lots/spaces/pads
8. Cap rate (if shown)
9. Monthly lot rent (if shown)
10. Occupancy rate (if shown)
11. URL to the individual listing page (REQUIRED - construct full URL if relative)
12. Property image URL
13. Any unique listing ID or reference number
14. Key details from description

IMPORTANT:
- Extract the COMPLETE street address, not just city/state
- If you see "123 Main St, Springfield, IL 62701" extract ALL parts
- Look for addresses in various formats: "Located at 123 Main St" or "Address: 123 Main St"
- Convert relative URLs to absolute URLs using the base domain
- Extract ALL listings visible on the page, even partial ones
- If price shows as "$1.5M" convert understanding to "1500000" or keep as "$1.5M"
`

// ============================================================================
// MAIN SCRAPER FUNCTION
// ============================================================================

export async function scrapeSource(
  source: ScrapeSource,
  options: {
    maxPages?: number
    deepCrawl?: boolean
    includeStateUrls?: boolean
  } = {}
): Promise<{
  listings: ScrapedListing[]
  pagesScraped: number
  error: string | null
}> {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
  
  if (!firecrawlApiKey) {
    return { listings: [], pagesScraped: 0, error: 'FIRECRAWL_API_KEY not configured' }
  }

  const allListings: ScrapedListing[] = []
  let pagesScraped = 0
  const seenIds = new Set<string>()
  
  // Collect all URLs to scrape
  const urlsToScrape: string[] = []
  
  // Add main listing URL
  urlsToScrape.push(`${source.base_url}${source.listing_pattern}`)
  
  // Add state-specific URLs if available and requested
  if (options.includeStateUrls && source.state_urls) {
    for (const stateUrl of source.state_urls) {
      urlsToScrape.push(`${source.base_url}${stateUrl}`)
    }
  }

  const maxPages = options.maxPages || source.max_pages || 10

  for (const baseUrl of urlsToScrape) {
    let currentPage = 1
    let hasMorePages = true

    while (hasMorePages && currentPage <= maxPages) {
      // Construct paginated URL
      let url = baseUrl
      if (currentPage > 1 && source.pagination_pattern) {
        url = baseUrl + source.pagination_pattern.replace('{PAGE}', String(currentPage))
      }

      try {
        console.log(`[Scraper] Scraping ${source.name} page ${currentPage}: ${url}`)
        
        // Use Firecrawl's extract endpoint for structured data
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlApiKey}`,
          },
          body: JSON.stringify({
            url,
            formats: ['extract', 'html'],
            extract: {
              schema: EXTRACTION_SCHEMA,
              prompt: AGGRESSIVE_EXTRACTION_PROMPT,
            },
            waitFor: source.requires_js ? 5000 : 2000,
            timeout: 30000,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[Scraper] Firecrawl API error: ${response.status} - ${errorText}`)
          hasMorePages = false
          continue
        }

        const data = await response.json()
        
        if (!data.success) {
          console.error(`[Scraper] Firecrawl failed for ${url}`)
          hasMorePages = false
          continue
        }

        const extractedData = data.data?.extract
        const rawListings = extractedData?.listings || []
        
        console.log(`[Scraper] Found ${rawListings.length} listings on page ${currentPage}`)

        if (rawListings.length === 0) {
          hasMorePages = false
          continue
        }

        // Process each listing
        for (const raw of rawListings) {
          const listing = await processRawListing(raw, source, url)
          if (listing) {
            const sourceId = generateSourceId(source.name, listing)
            if (!seenIds.has(sourceId)) {
              seenIds.add(sourceId)
              allListings.push(listing)
            }
          }
        }

        pagesScraped++
        currentPage++
        
        // Check for next page
        if (extractedData?.next_page_url) {
          // Could follow this for deep crawling
        } else if (rawListings.length < 10) {
          // Probably last page if very few results
          hasMorePages = false
        }
        
        // Rate limiting between pages
        await delay(1500)

      } catch (err) {
        console.error(`[Scraper] Error scraping ${url}:`, err)
        hasMorePages = false
      }
    }
  }

  return { 
    listings: allListings, 
    pagesScraped,
    error: null 
  }
}

// ============================================================================
// PROCESS RAW LISTING
// ============================================================================

async function processRawListing(
  raw: Record<string, string>,
  source: ScrapeSource,
  pageUrl: string
): Promise<ScrapedListing | null> {
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
  
  // Extract location components
  let city = raw.city || extractCity(raw.location || raw.address || '')
  let state = raw.state || extractState(raw.location || raw.address || '')
  let zipCode = raw.zip_code || extractZipCode(raw.location || raw.address || '')
  let address = raw.address || null
  
  // Try to parse state from full state names in URL
  if (!state && pageUrl) {
    for (const [stateName, abbr] of Object.entries(STATE_ABBREVIATIONS)) {
      if (pageUrl.toLowerCase().includes(stateName.replace(/\s+/g, '-'))) {
        state = abbr
        break
      }
    }
  }
  
  // Skip if we don't have minimum required data
  if (!raw.name || (!city && !state)) {
    return null
  }
  
  // Build the listing
  const listing: ScrapedListing = {
    name: raw.name || 'Unnamed Property',
    address: address,
    city: city || 'Unknown',
    state: state || 'XX',
    zip_code: zipCode,
    units: parseUnits(raw.units),
    asking_price: parsePrice(raw.price),
    cap_rate: parsePercent(raw.cap_rate),
    lot_rent: parsePrice(raw.lot_rent),
    occupancy: parsePercent(raw.occupancy),
    notes: raw.description || null,
    source: source.name,
    source_id: raw.listing_id || null,
    listing_url: buildFullUrl(raw.property_url, source.base_url, pageUrl),
    image_url: raw.image_url || null,
    street_view_url: null,
    raw_data: raw,
    latitude: null,
    longitude: null,
    formatted_address: null,
    address_verified: false,
    image_verified: false,
  }
  
  // If we have an address and Google API key, geocode it
  if (googleApiKey && (address || (city && state))) {
    const fullAddress = address 
      ? `${address}, ${city}, ${state}${zipCode ? ` ${zipCode}` : ''}`
      : `${city}, ${state}`
    
    const geocoded = await geocodeAddress(fullAddress)
    
    if (geocoded) {
      listing.latitude = geocoded.latitude
      listing.longitude = geocoded.longitude
      listing.formatted_address = geocoded.formatted_address
      listing.address_verified = true
      
      // Update city/state/zip with verified data
      if (geocoded.city) listing.city = geocoded.city
      if (geocoded.state) listing.state = geocoded.state
      if (geocoded.zip_code) listing.zip_code = geocoded.zip_code
      
      // Build proper street address
      if (geocoded.street_number && geocoded.route) {
        listing.address = `${geocoded.street_number} ${geocoded.route}`
      }
      
      // Try to get Street View image
      const streetView = await getVerifiedStreetViewUrl(geocoded.formatted_address, googleApiKey)
      if (streetView.verified && streetView.url) {
        listing.street_view_url = streetView.url
        listing.image_url = streetView.url // Prefer Street View over scraped images
        listing.image_verified = true
      }
      
      // Rate limit geocoding requests
      await delay(100)
    }
  }
  
  return listing
}

// ============================================================================
// URL HELPERS
// ============================================================================

function buildFullUrl(url: string | undefined, baseUrl: string, pageUrl: string): string {
  if (!url) return pageUrl
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  if (url.startsWith('//')) {
    return 'https:' + url
  }
  
  if (url.startsWith('/')) {
    return baseUrl + url
  }
  
  // Relative URL
  const pageBase = pageUrl.substring(0, pageUrl.lastIndexOf('/'))
  return `${pageBase}/${url}`
}

// ============================================================================
// SAVE LISTINGS TO DATABASE
// ============================================================================

export async function saveListings(listings: ScrapedListing[]): Promise<{
  added: number
  updated: number
  errors: string[]
}> {
  const supabase = getSupabase()
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
  
  let added = 0
  let updated = 0
  const errors: string[] = []

  for (const listing of listings) {
    try {
      // Generate deduplication key
      const sourceId = generateSourceId(listing.source, listing)
      
      // Check for existing listing
      const { data: existing } = await supabase
        .from('properties')
        .select('id, name, asking_price, image_url, address, source')
        .or(`and(name.eq.${listing.name},city.eq.${listing.city},state.eq.${listing.state}),source_id.eq.${sourceId}`)
        .limit(1)
        .single()

      // Determine region based on state
      const region = getRegionFromState(listing.state)
      
      // Calculate AI score
      const aiScore = calculateAIScore(listing)
      
      // Determine best image
      let imageUrl = listing.image_url
      if (listing.street_view_url && listing.image_verified) {
        imageUrl = listing.street_view_url
      } else if (!imageUrl && googleApiKey && listing.address) {
        // Try to get Street View as fallback
        const fullAddress = `${listing.address}, ${listing.city}, ${listing.state}`
        const streetView = await getVerifiedStreetViewUrl(fullAddress, googleApiKey)
        if (streetView.verified && streetView.url) {
          imageUrl = streetView.url
        }
      }

      const propertyData = {
        name: listing.name,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        region,
        units: listing.units,
        asking_price: listing.asking_price,
        cap_rate: listing.cap_rate,
        lot_rent: listing.lot_rent,
        occupancy: listing.occupancy,
        notes: listing.notes,
        source: listing.source,
        source_id: sourceId,
        listing_url: listing.listing_url,
        image_url: imageUrl,
        latitude: listing.latitude,
        longitude: listing.longitude,
        ai_score: aiScore,
        status: 'active' as const,
        mom_pop: true, // Default assumption
        address_verified: listing.address_verified,
        image_verified: listing.image_verified,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        // Update existing listing if key data changed
        const shouldUpdate = 
          existing.asking_price !== listing.asking_price ||
          (!existing.address && listing.address) ||
          (!existing.image_url?.includes('streetview') && imageUrl?.includes('streetview'))
        
        if (shouldUpdate) {
          await supabase
            .from('properties')
            .update(propertyData)
            .eq('id', existing.id)
          updated++
        }
      } else {
        // Insert new listing
        const { error: insertError } = await supabase
          .from('properties')
          .insert({
            ...propertyData,
            created_at: new Date().toISOString(),
          })
        
        if (insertError) {
          errors.push(`Failed to insert ${listing.name}: ${insertError.message}`)
        } else {
          added++
        }
      }
    } catch (err) {
      errors.push(`Error processing ${listing.name}: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  return { added, updated, errors }
}

// ============================================================================
// SCRAPE JOB MANAGEMENT
// ============================================================================

export async function createScrapeJob(source: string, url: string): Promise<string | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({
      source,
      url,
      status: 'pending',
      listings_found: 0,
      listings_added: 0,
      listings_updated: 0,
      pages_scraped: 0,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Scraper] Failed to create scrape job:', error)
    return null
  }

  return data.id
}

export async function updateScrapeJob(
  jobId: string, 
  updates: Partial<ScrapeJob>
): Promise<void> {
  const supabase = getSupabase()
  
  await supabase
    .from('scrape_jobs')
    .update(updates)
    .eq('id', jobId)
}

// ============================================================================
// RUN FULL AGGRESSIVE SCRAPE
// ============================================================================

export async function runFullScrape(options: {
  deepCrawl?: boolean
  maxPagesPerSource?: number
  includeStateUrls?: boolean
  priorityThreshold?: number
} = {}): Promise<{
  totalFound: number
  totalAdded: number
  totalUpdated: number
  totalPages: number
  sourcesProcessed: number
  errors: string[]
}> {
  const {
    deepCrawl = true,
    maxPagesPerSource = 20,
    includeStateUrls = true,
    priorityThreshold = 0,
  } = options

  let totalFound = 0
  let totalAdded = 0
  let totalUpdated = 0
  let totalPages = 0
  let sourcesProcessed = 0
  const errors: string[] = []

  // Sort sources by priority (highest first)
  const sortedSources = [...SCRAPE_SOURCES]
    .filter(s => s.enabled && s.priority >= priorityThreshold)
    .sort((a, b) => b.priority - a.priority)

  console.log(`[Scraper] Starting aggressive scrape of ${sortedSources.length} sources`)

  for (const source of sortedSources) {
    const jobId = await createScrapeJob(source.name, `${source.base_url}${source.listing_pattern}`)
    if (!jobId) {
      errors.push(`Failed to create job for ${source.name}`)
      continue
    }

    await updateScrapeJob(jobId, { 
      status: 'running', 
      started_at: new Date().toISOString() 
    })

    console.log(`[Scraper] Processing ${source.name} (priority: ${source.priority})`)

    const { listings, pagesScraped, error } = await scrapeSource(source, {
      maxPages: maxPagesPerSource,
      deepCrawl,
      includeStateUrls,
    })
    
    if (error) {
      await updateScrapeJob(jobId, {
        status: 'failed',
        error_message: error,
        completed_at: new Date().toISOString(),
      })
      errors.push(`${source.name}: ${error}`)
      continue
    }

    console.log(`[Scraper] ${source.name}: Found ${listings.length} listings across ${pagesScraped} pages`)

    totalFound += listings.length
    totalPages += pagesScraped
    
    const { added, updated, errors: saveErrors } = await saveListings(listings)
    
    totalAdded += added
    totalUpdated += updated
    errors.push(...saveErrors)
    sourcesProcessed++

    await updateScrapeJob(jobId, {
      status: 'completed',
      listings_found: listings.length,
      listings_added: added,
      listings_updated: updated,
      pages_scraped: pagesScraped,
      completed_at: new Date().toISOString(),
    })

    // Rate limiting between sources
    await delay(2000)
  }

  console.log(`[Scraper] Completed: ${totalFound} found, ${totalAdded} added, ${totalUpdated} updated`)

  return { 
    totalFound, 
    totalAdded, 
    totalUpdated, 
    totalPages,
    sourcesProcessed,
    errors 
  }
}

// ============================================================================
// BULK STREET VIEW UPDATE
// ============================================================================

export async function updateAllStreetViewImages(limit: number = 100): Promise<{
  updated: number
  failed: number
}> {
  const supabase = getSupabase()
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
  
  if (!googleApiKey) {
    console.error('[Scraper] GOOGLE_MAPS_API_KEY not configured')
    return { updated: 0, failed: 0 }
  }

  // Get properties without verified images
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, address, city, state')
    .or('image_verified.is.null,image_verified.eq.false')
    .not('address', 'is', null)
    .limit(limit)

  if (error || !properties) {
    console.error('[Scraper] Failed to fetch properties:', error)
    return { updated: 0, failed: 0 }
  }

  let updated = 0
  let failed = 0

  for (const prop of properties) {
    const fullAddress = `${prop.address}, ${prop.city}, ${prop.state}`
    
    const { url, verified } = await getVerifiedStreetViewUrl(fullAddress, googleApiKey)
    
    if (verified && url) {
      await supabase
        .from('properties')
        .update({ 
          image_url: url,
          image_verified: true 
        })
        .eq('id', prop.id)
      updated++
    } else {
      failed++
    }
    
    // Rate limiting
    await delay(100)
  }

  return { updated, failed }
}

// ============================================================================
// HELPER: MAP STATE TO REGION
// ============================================================================

function getRegionFromState(state: string): string {
  const regionMap: Record<string, string> = {
    // Northeast
    ME: 'Northeast', NH: 'Northeast', VT: 'Northeast', MA: 'Northeast',
    RI: 'Northeast', CT: 'Northeast', NY: 'Northeast', NJ: 'Northeast',
    PA: 'Northeast',
    // Southeast
    DE: 'Southeast', MD: 'Southeast', VA: 'Southeast', WV: 'Southeast',
    NC: 'Southeast', SC: 'Southeast', GA: 'Southeast', FL: 'Southeast',
    KY: 'Southeast', TN: 'Southeast', AL: 'Southeast', MS: 'Southeast',
    // Midwest
    OH: 'Midwest', IN: 'Midwest', IL: 'Midwest', MI: 'Midwest',
    WI: 'Midwest', MN: 'Midwest', IA: 'Midwest', MO: 'Midwest',
    ND: 'Midwest', SD: 'Midwest', NE: 'Midwest', KS: 'Midwest',
    // Southwest
    TX: 'Southwest', OK: 'Southwest', AR: 'Southwest', LA: 'Southwest',
    AZ: 'Southwest', NM: 'Southwest',
    // Mountain
    MT: 'Mountain', ID: 'Mountain', WY: 'Mountain', CO: 'Mountain',
    UT: 'Mountain', NV: 'Mountain',
    // Pacific
    CA: 'Pacific', HI: 'Pacific',
    // Pacific NW
    WA: 'Pacific NW', OR: 'Pacific NW', AK: 'Pacific NW',
  }
  
  return regionMap[state.toUpperCase()] || 'Unknown'
}
