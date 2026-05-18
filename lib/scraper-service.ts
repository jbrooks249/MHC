import { createClient } from '@supabase/supabase-js'
import {
  ScrapedListing,
  ScrapeJob,
  parsePrice,
  parsePercent,
  parseUnits,
  extractCity,
  extractState,
  calculateAIScore,
  getStreetViewUrl,
} from './scraper-types'
import {
  SCRAPER_SOURCES,
  ScraperSource,
  getSourcesByPriority,
  getSourceUrls,
  US_STATES,
  STATE_NAMES,
} from './scraper-sources'
import { verifyPropertyName } from './name-verification'
import {
  validateListing,
  validateListings,
  generateListingFingerprint,
  calculateListingSimilarity,
  SourceReliabilityTracker,
} from './data-validation'
import {
  normalizeAddress,
  geocodeAddress,
  getFallbackCoordinates,
} from './address-validator'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Source reliability tracker (persists in memory during runtime)
const reliabilityTracker = new SourceReliabilityTracker()

// Rate limiter state
const rateLimitState: Map<string, { lastRequest: number; requestCount: number }> = new Map()

// Check if we can make a request to a source
function canMakeRequest(source: ScraperSource): boolean {
  const state = rateLimitState.get(source.id)
  if (!state) return true

  const now = Date.now()
  const minuteAgo = now - 60000
  const hourAgo = now - 3600000

  // Reset minute counter if needed
  if (state.lastRequest < minuteAgo) {
    state.requestCount = 0
  }

  return state.requestCount < source.rateLimit.requestsPerMinute
}

// Record a request to a source
function recordRequest(source: ScraperSource) {
  const state = rateLimitState.get(source.id) || { lastRequest: 0, requestCount: 0 }
  state.lastRequest = Date.now()
  state.requestCount++
  rateLimitState.set(source.id, state)
}

// Wait for rate limit
async function waitForRateLimit(source: ScraperSource) {
  if (!canMakeRequest(source)) {
    const delay = source.rateLimit.delayBetweenRequests
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}

// Enhanced extraction schemas for different sources
const EXTRACTION_SCHEMAS = {
  default: {
    type: 'object',
    properties: {
      listings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Property name or title' },
            address: { type: 'string', description: 'Full street address' },
            city: { type: 'string', description: 'City name' },
            state: { type: 'string', description: 'State abbreviation (2 letters)' },
            location: { type: 'string', description: 'Full location string if separate city/state not available' },
            price: { type: 'string', description: 'Asking price' },
            cap_rate: { type: 'string', description: 'Cap rate percentage' },
            units: { type: 'string', description: 'Number of units/spaces/lots/pads' },
            lot_rent: { type: 'string', description: 'Monthly lot rent' },
            occupancy: { type: 'string', description: 'Occupancy percentage' },
            property_url: { type: 'string', description: 'URL to the listing detail page' },
            image_url: { type: 'string', description: 'Main property image URL' },
            broker: { type: 'string', description: 'Broker or agent name' },
            description: { type: 'string', description: 'Property description' },
          },
        },
      },
    },
  },
  mobilehomeparkstore: {
    type: 'object',
    properties: {
      listings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Park name' },
            location: { type: 'string', description: 'City, State' },
            price: { type: 'string', description: 'Asking price' },
            units: { type: 'string', description: 'Total number of lots/spaces' },
            lot_rent: { type: 'string', description: 'Average monthly lot rent' },
            occupancy: { type: 'string', description: 'Current occupancy percentage' },
            cap_rate: { type: 'string', description: 'Cap rate' },
            property_url: { type: 'string', description: 'URL to the listing' },
            image_url: { type: 'string', description: 'Property image' },
            toh: { type: 'string', description: 'Tenant-owned homes count' },
            poh: { type: 'string', description: 'Park-owned homes count' },
          },
        },
      },
    },
  },
  loopnet: {
    type: 'object',
    properties: {
      listings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Property name or title' },
            address: { type: 'string', description: 'Street address' },
            city: { type: 'string', description: 'City' },
            state: { type: 'string', description: 'State' },
            zip: { type: 'string', description: 'ZIP code' },
            price: { type: 'string', description: 'Asking price' },
            cap_rate: { type: 'string', description: 'Cap rate' },
            units: { type: 'string', description: 'Number of spaces/units' },
            property_url: { type: 'string', description: 'Listing URL' },
            image_url: { type: 'string', description: 'Image URL' },
            property_type: { type: 'string', description: 'Property type/subtype' },
            sqft: { type: 'string', description: 'Square footage' },
          },
        },
      },
    },
  },
  auction: {
    type: 'object',
    properties: {
      listings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Property name' },
            address: { type: 'string', description: 'Address' },
            city: { type: 'string', description: 'City' },
            state: { type: 'string', description: 'State' },
            starting_bid: { type: 'string', description: 'Starting bid or reserve price' },
            current_bid: { type: 'string', description: 'Current highest bid' },
            units: { type: 'string', description: 'Number of units' },
            auction_date: { type: 'string', description: 'Auction date' },
            property_url: { type: 'string', description: 'Auction listing URL' },
            image_url: { type: 'string', description: 'Property image' },
          },
        },
      },
    },
  },
  broker: {
    type: 'object',
    properties: {
      listings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Property name' },
            address: { type: 'string', description: 'Full address' },
            city: { type: 'string', description: 'City' },
            state: { type: 'string', description: 'State' },
            price: { type: 'string', description: 'Asking price or price guidance' },
            cap_rate: { type: 'string', description: 'Cap rate' },
            noi: { type: 'string', description: 'Net Operating Income' },
            units: { type: 'string', description: 'Number of units/pads' },
            property_url: { type: 'string', description: 'Listing URL' },
            image_url: { type: 'string', description: 'Property image' },
            broker_name: { type: 'string', description: 'Listing broker name' },
            broker_company: { type: 'string', description: 'Brokerage company' },
          },
        },
      },
    },
  },
}

// Get schema for a source
function getSchemaForSource(source: ScraperSource): object {
  if (source.id in EXTRACTION_SCHEMAS) {
    return EXTRACTION_SCHEMAS[source.id as keyof typeof EXTRACTION_SCHEMAS]
  }
  if (source.type === 'auction') {
    return EXTRACTION_SCHEMAS.auction
  }
  if (source.type === 'broker') {
    return EXTRACTION_SCHEMAS.broker
  }
  return EXTRACTION_SCHEMAS.default
}

// Build extraction prompt for a source
function buildExtractionPrompt(source: ScraperSource): string {
  const basePrompt = `Extract all mobile home park, manufactured housing community, and RV park listings from this page.
For each listing, capture all available information including:
- Property name/title
- Full address (street, city, state, ZIP if available)
- Asking price or starting bid
- Number of units, lots, spaces, or pads
- Cap rate if shown
- Monthly lot rent if available
- Occupancy percentage
- URL to the listing detail page
- Property image URL
- Any additional metrics like NOI, TOH/POH counts

Important: 
- Extract ALL listings on the page, not just the first few
- Preserve exact URLs - do not modify or truncate them
- If price contains K, M, or B suffix, preserve it (e.g., "$1.5M")
- Extract state as 2-letter abbreviation when possible`

  // Add source-specific instructions
  switch (source.type) {
    case 'auction':
      return basePrompt + `\n\nThis is an auction site. Also capture:
- Starting bid and current bid amounts
- Auction date/time
- Auction status (upcoming, active, ended)`
    case 'broker':
      return basePrompt + `\n\nThis is a broker website. Also capture:
- Broker/agent name
- Brokerage company
- NOI (Net Operating Income) if available`
    case 'news':
      return basePrompt + `\n\nThis is a news/transaction site. Extract:
- Recently sold or listed properties
- Transaction prices and dates
- Buyer/seller names if mentioned`
    default:
      return basePrompt
  }
}

// Scrape a single URL using Firecrawl
async function scrapeUrl(
  url: string,
  source: ScraperSource
): Promise<{ listings: ScrapedListing[]; error: string | null }> {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY

  if (!firecrawlApiKey) {
    return { listings: [], error: 'FIRECRAWL_API_KEY not configured' }
  }

  try {
    await waitForRateLimit(source)
    recordRequest(source)

    const schema = getSchemaForSource(source)
    const prompt = buildExtractionPrompt(source)

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: {
          schema,
          prompt,
        },
        waitFor: source.extractionMethod === 'deep_crawl' ? 5000 : 3000,
        timeout: 30000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { listings: [], error: `Firecrawl API error: ${response.status} - ${errorText}` }
    }

    const data = await response.json()

    if (!data.success || !data.data?.extract?.listings) {
      return { listings: [], error: 'No listings found in response' }
    }

    // Transform raw listings to our format
    const listings: ScrapedListing[] = data.data.extract.listings.map((raw: Record<string, string>) => {
      // Extract city and state from location or separate fields
      let city = raw.city || ''
      let state = raw.state || ''

      if (!city || !state) {
        const location = raw.location || raw.address || ''
        city = city || extractCity(location) || ''
        state = state || extractState(location) || ''
      }

      // Clean up state
      if (state && state.length > 2) {
        // Try to extract 2-letter abbreviation
        const stateMatch = state.match(/\b([A-Z]{2})\b/i)
        if (stateMatch) {
          state = stateMatch[1].toUpperCase()
        }
      }

      // Verify and correct the property name
      const nameVerification = verifyPropertyName(
        raw.name || raw.title || null,
        raw.address || raw.street_address || null,
        city || 'Unknown',
        state || 'XX'
      )
      const verifiedName = nameVerification.correctedName

      // Build listing URL
      let listingUrl = raw.property_url || raw.url || raw.link || ''
      if (listingUrl && !listingUrl.startsWith('http')) {
        listingUrl = `${source.baseUrl}${listingUrl.startsWith('/') ? '' : '/'}${listingUrl}`
      }

      const listing: ScrapedListing = {
        name: verifiedName,
        address: raw.address || raw.street_address || null,
        city: city || 'Unknown',
        state: state || 'XX',
        units: parseUnits(raw.units || raw.lots || raw.spaces || raw.pads),
        asking_price: parsePrice(raw.price || raw.asking_price || raw.starting_bid),
        cap_rate: parsePercent(raw.cap_rate),
        lot_rent: parsePrice(raw.lot_rent || raw.space_rent),
        occupancy: parsePercent(raw.occupancy),
        notes: raw.description || null,
        source: source.name,
        listing_url: listingUrl || url,
        image_url: raw.image_url || null,
        raw_data: raw,
      }

      return listing
    })

    return { listings, error: null }
  } catch (err) {
    return {
      listings: [],
      error: `Scrape failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

// Scrape a source (potentially multiple URLs)
export async function scrapeSource(sourceId: string): Promise<{
  listings: ScrapedListing[]
  validListings: ScrapedListing[]
  errors: string[]
  stats: {
    totalScraped: number
    validCount: number
    invalidCount: number
    duplicateCount: number
  }
}> {
  const source = SCRAPER_SOURCES.find(s => s.id === sourceId)
  if (!source) {
    return {
      listings: [],
      validListings: [],
      errors: [`Unknown source: ${sourceId}`],
      stats: { totalScraped: 0, validCount: 0, invalidCount: 0, duplicateCount: 0 },
    }
  }

  const allListings: ScrapedListing[] = []
  const errors: string[] = []

  // Get all URLs for this source
  const urls = getSourceUrls(source)

  // Scrape each URL
  for (const url of urls) {
    const { listings, error } = await scrapeUrl(url, source)

    if (error) {
      errors.push(`${url}: ${error}`)
      reliabilityTracker.recordScrape(source.id, false)
    } else {
      allListings.push(...listings)
      reliabilityTracker.recordScrape(source.id, true, listings.length > 0 ? 80 : 50)
    }

    // Add delay between URLs from same source
    await new Promise(resolve => setTimeout(resolve, source.rateLimit.delayBetweenRequests))
  }

  // Validate all listings
  const validation = validateListings(allListings, source)

  return {
    listings: allListings,
    validListings: validation.valid.map(v => ({
      ...v.listing,
      ...v.normalizedData,
    })),
    errors,
    stats: {
      totalScraped: allListings.length,
      validCount: validation.valid.length,
      invalidCount: validation.invalid.length,
      duplicateCount: validation.duplicates.length,
    },
  }
}

// Save scraped listings to database with enhanced deduplication
export async function saveListings(listings: ScrapedListing[]): Promise<{
  added: number
  updated: number
  skipped: number
  errors: string[]
}> {
  const supabase = getSupabase()
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY

  let added = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  // Generate fingerprints for all incoming listings
  const fingerprints = new Map<string, ScrapedListing>()
  for (const listing of listings) {
    const fp = generateListingFingerprint(listing)
    // If we already have this fingerprint, keep the one with more data
    if (!fingerprints.has(fp)) {
      fingerprints.set(fp, listing)
    }
  }

  // Process unique listings
  const uniqueListings = Array.from(fingerprints.values())

  for (const listing of uniqueListings) {
    try {
      // Check for existing listing by multiple criteria
      const { data: existing } = await supabase
        .from('properties')
        .select('id, name, asking_price, address, city, state, updated_at')
        .or(`and(name.ilike.%${listing.name.slice(0, 30)}%,city.eq.${listing.city},state.eq.${listing.state}),and(address.ilike.%${(listing.address || '').slice(0, 20)}%,city.eq.${listing.city},state.eq.${listing.state})`)
        .limit(5)

      // Find best match among existing
      let bestMatch: { id: string; name: string; asking_price: number | null; address: string | null; city: string; state: string; updated_at: string } | null = null
      let bestSimilarity = 0

      for (const ex of existing || []) {
        const similarity = calculateListingSimilarity(listing, {
          name: ex.name,
          address: ex.address,
          city: ex.city,
          state: ex.state,
          units: null,
          asking_price: ex.asking_price,
          cap_rate: null,
          lot_rent: null,
          occupancy: null,
          notes: null,
          source: '',
          listing_url: '',
          image_url: null,
          raw_data: {},
        })

        if (similarity > bestSimilarity && similarity > 0.75) {
          bestMatch = ex
          bestSimilarity = similarity
        }
      }

      // Determine region based on state
      const region = getRegionFromState(listing.state)

      // Calculate AI score
      const aiScore = calculateAIScore(listing)

      // Normalize address
      const normalizedAddr = normalizeAddress(listing.address, listing.city, listing.state)

      // Get coordinates
      let latitude: number | null = null
      let longitude: number | null = null

      if (googleApiKey && listing.address) {
        const geocode = await geocodeAddress(listing.address, listing.city, listing.state, googleApiKey)
        if (geocode) {
          latitude = geocode.latitude
          longitude = geocode.longitude
        }
      }

      // Fallback to state center
      if (!latitude || !longitude) {
        const fallback = getFallbackCoordinates(listing.state)
        if (fallback) {
          latitude = fallback.lat + (Math.random() - 0.5) * 1
          longitude = fallback.lng + (Math.random() - 0.5) * 1
        }
      }

      // Get Street View image if we have an address
      let imageUrl = listing.image_url
      if (googleApiKey && listing.address && !imageUrl) {
        const fullAddress = `${listing.address}, ${listing.city}, ${listing.state}`
        imageUrl = getStreetViewUrl(fullAddress, googleApiKey)
      }

      const propertyData = {
        name: listing.name,
        address: normalizedAddr.normalizedAddress.split(',')[0] || listing.address,
        city: normalizedAddr.city,
        state: normalizedAddr.state,
        region,
        units: listing.units,
        asking_price: listing.asking_price,
        cap_rate: listing.cap_rate,
        lot_rent: listing.lot_rent,
        occupancy: listing.occupancy,
        notes: listing.notes,
        source: listing.source,
        listing_url: listing.listing_url,
        image_url: imageUrl,
        ai_score: aiScore,
        latitude,
        longitude,
        status: 'active' as const,
        mom_pop: true,
        updated_at: new Date().toISOString(),
      }

      if (bestMatch) {
        // Update existing listing if data is newer or more complete
        const shouldUpdate =
          listing.asking_price !== bestMatch.asking_price ||
          (listing.address && !bestMatch.address) ||
          new Date(bestMatch.updated_at || 0) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days old

        if (shouldUpdate) {
          await supabase.from('properties').update(propertyData).eq('id', bestMatch.id)
          updated++
        } else {
          skipped++
        }
      } else {
        // Insert new listing
        const { error: insertError } = await supabase.from('properties').insert({
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

  return { added, updated, skipped, errors }
}

// Create a scrape job record
export async function createScrapeJob(sourceId: string, url: string): Promise<string | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({
      source: sourceId,
      url,
      status: 'pending',
      listings_found: 0,
      listings_added: 0,
      listings_updated: 0,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create scrape job:', error)
    return null
  }

  return data.id
}

// Update scrape job status
export async function updateScrapeJob(jobId: string, updates: Partial<ScrapeJob>): Promise<void> {
  const supabase = getSupabase()

  await supabase.from('scrape_jobs').update(updates).eq('id', jobId)
}

// Run comprehensive scrape across all enabled sources
export async function runFullScrape(options: {
  sourceTypes?: ScraperSource['type'][]
  maxSources?: number
  parallel?: boolean
} = {}): Promise<{
  totalFound: number
  totalAdded: number
  totalUpdated: number
  totalSkipped: number
  sourceResults: Array<{
    source: string
    found: number
    added: number
    updated: number
    errors: string[]
  }>
  errors: string[]
}> {
  const { sourceTypes, maxSources = 50, parallel = false } = options

  let totalFound = 0
  let totalAdded = 0
  let totalUpdated = 0
  let totalSkipped = 0
  const errors: string[] = []
  const sourceResults: Array<{
    source: string
    found: number
    added: number
    updated: number
    errors: string[]
  }> = []

  // Get sources sorted by priority
  let sources = getSourcesByPriority()

  // Filter by type if specified
  if (sourceTypes && sourceTypes.length > 0) {
    sources = sources.filter(s => sourceTypes.includes(s.type))
  }

  // Limit number of sources
  sources = sources.slice(0, maxSources)

  const processSource = async (source: ScraperSource) => {
    const jobId = await createScrapeJob(source.id, source.baseUrl)
    if (!jobId) {
      errors.push(`Failed to create job for ${source.name}`)
      return
    }

    await updateScrapeJob(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
    })

    const { validListings, errors: scrapeErrors, stats } = await scrapeSource(source.id)

    if (scrapeErrors.length > 0) {
      errors.push(...scrapeErrors.map(e => `${source.name}: ${e}`))
    }

    if (validListings.length > 0) {
      const { added, updated, skipped, errors: saveErrors } = await saveListings(validListings)

      totalFound += stats.totalScraped
      totalAdded += added
      totalUpdated += updated
      totalSkipped += skipped
      errors.push(...saveErrors)

      sourceResults.push({
        source: source.name,
        found: stats.totalScraped,
        added,
        updated,
        errors: [...scrapeErrors, ...saveErrors],
      })

      await updateScrapeJob(jobId, {
        status: 'completed',
        listings_found: stats.totalScraped,
        listings_added: added,
        listings_updated: updated,
        completed_at: new Date().toISOString(),
      })
    } else {
      await updateScrapeJob(jobId, {
        status: stats.totalScraped > 0 ? 'completed' : 'failed',
        listings_found: stats.totalScraped,
        error_message: scrapeErrors.join('; '),
        completed_at: new Date().toISOString(),
      })

      sourceResults.push({
        source: source.name,
        found: 0,
        added: 0,
        updated: 0,
        errors: scrapeErrors,
      })
    }
  }

  if (parallel) {
    // Process sources in parallel batches
    const batchSize = 3
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize)
      await Promise.all(batch.map(processSource))
    }
  } else {
    // Process sources sequentially
    for (const source of sources) {
      await processSource(source)
    }
  }

  return {
    totalFound,
    totalAdded,
    totalUpdated,
    totalSkipped,
    sourceResults,
    errors,
  }
}

// Get scraping statistics
export async function getScrapeStats(): Promise<{
  totalSources: number
  enabledSources: number
  sourcesByType: Record<string, number>
  sourceReliability: Array<{ source: string; score: number }>
  recentJobs: ScrapeJob[]
}> {
  const supabase = getSupabase()

  const enabledSources = SCRAPER_SOURCES.filter(s => s.enabled)

  // Count by type
  const sourcesByType: Record<string, number> = {}
  for (const source of enabledSources) {
    sourcesByType[source.type] = (sourcesByType[source.type] || 0) + 1
  }

  // Get reliability scores
  const sourceReliability = enabledSources.map(s => ({
    source: s.name,
    score: reliabilityTracker.getReliabilityScore(s.id),
  }))

  // Get recent jobs
  const { data: recentJobs } = await supabase
    .from('scrape_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return {
    totalSources: SCRAPER_SOURCES.length,
    enabledSources: enabledSources.length,
    sourcesByType,
    sourceReliability,
    recentJobs: recentJobs || [],
  }
}

// Helper: Map state to region
function getRegionFromState(state: string): string {
  const regionMap: Record<string, string> = {
    ME: 'Northeast', NH: 'Northeast', VT: 'Northeast', MA: 'Northeast',
    RI: 'Northeast', CT: 'Northeast', NY: 'Northeast', NJ: 'Northeast', PA: 'Northeast',
    DE: 'Southeast', MD: 'Southeast', VA: 'Southeast', WV: 'Southeast',
    NC: 'Southeast', SC: 'Southeast', GA: 'Southeast', FL: 'Southeast',
    KY: 'Southeast', TN: 'Southeast', AL: 'Southeast', MS: 'Southeast',
    OH: 'Midwest', IN: 'Midwest', IL: 'Midwest', MI: 'Midwest',
    WI: 'Midwest', MN: 'Midwest', IA: 'Midwest', MO: 'Midwest',
    ND: 'Midwest', SD: 'Midwest', NE: 'Midwest', KS: 'Midwest',
    TX: 'Southwest', OK: 'Southwest', AR: 'Southwest', LA: 'Southwest',
    AZ: 'Southwest', NM: 'Southwest',
    MT: 'Mountain', ID: 'Mountain', WY: 'Mountain', CO: 'Mountain',
    UT: 'Mountain', NV: 'Mountain',
    CA: 'Pacific', HI: 'Pacific',
    WA: 'Pacific NW', OR: 'Pacific NW', AK: 'Pacific NW',
  }

  return regionMap[state.toUpperCase()] || 'Unknown'
}

// Export source list for external use
export { SCRAPER_SOURCES, getSourcesByPriority, getSourceUrls }
