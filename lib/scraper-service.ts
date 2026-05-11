import { createClient } from '@supabase/supabase-js'
import {
  ScrapedListing,
  ScrapeJob,
  SCRAPE_SOURCES,
  parsePrice,
  parsePercent,
  parseUnits,
  extractCity,
  extractState,
  calculateAIScore,
  getStreetViewUrl,
} from './scraper-types'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Firecrawl extraction schemas for different sources
const EXTRACTION_SCHEMAS = {
  LoopNet: {
    type: 'object',
    properties: {
      listings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Property name or title' },
            address: { type: 'string', description: 'Full street address' },
            location: { type: 'string', description: 'City, State ZIP' },
            price: { type: 'string', description: 'Asking price' },
            cap_rate: { type: 'string', description: 'Cap rate percentage' },
            units: { type: 'string', description: 'Number of units/spaces/lots' },
            property_url: { type: 'string', description: 'URL to the listing detail page' },
            image_url: { type: 'string', description: 'Main property image URL' },
          },
        },
      },
    },
  },
  MobileHomeParkStore: {
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
            units: { type: 'string', description: 'Number of lots/spaces' },
            lot_rent: { type: 'string', description: 'Monthly lot rent' },
            occupancy: { type: 'string', description: 'Occupancy percentage' },
            property_url: { type: 'string', description: 'URL to the listing' },
          },
        },
      },
    },
  },
  Generic: {
    type: 'object',
    properties: {
      listings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Property name' },
            address: { type: 'string', description: 'Property address' },
            location: { type: 'string', description: 'City, State' },
            price: { type: 'string', description: 'Price' },
            cap_rate: { type: 'string', description: 'Cap rate' },
            units: { type: 'string', description: 'Number of units' },
            lot_rent: { type: 'string', description: 'Lot rent' },
            property_url: { type: 'string', description: 'Listing URL' },
            image_url: { type: 'string', description: 'Image URL' },
          },
        },
      },
    },
  },
}

// Main scraper function using Firecrawl
export async function scrapeSource(sourceName: string): Promise<{
  listings: ScrapedListing[]
  error: string | null
}> {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
  
  if (!firecrawlApiKey) {
    return { listings: [], error: 'FIRECRAWL_API_KEY not configured' }
  }

  const source = SCRAPE_SOURCES.find(s => s.name === sourceName)
  if (!source) {
    return { listings: [], error: `Unknown source: ${sourceName}` }
  }

  const url = `${source.base_url}${source.listing_pattern}`
  const schema = EXTRACTION_SCHEMAS[sourceName as keyof typeof EXTRACTION_SCHEMAS] || EXTRACTION_SCHEMAS.Generic

  try {
    // Use Firecrawl's extract endpoint for structured data
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
          prompt: `Extract all mobile home park and manufactured housing community listings from this page. 
                   For each listing, capture the property name, location (city, state), asking price, 
                   number of units/lots/spaces, cap rate if shown, lot rent if available, and the URL to the listing detail page.
                   Also extract any property image URLs shown.`,
        },
        waitFor: 3000, // Wait for dynamic content
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
      const city = extractCity(raw.location || raw.address || '')
      const state = extractState(raw.location || raw.address || '')
      
      const listing: ScrapedListing = {
        name: raw.name || 'Unnamed Property',
        address: raw.address || null,
        city: city || 'Unknown',
        state: state || 'XX',
        units: parseUnits(raw.units),
        asking_price: parsePrice(raw.price),
        cap_rate: parsePercent(raw.cap_rate),
        lot_rent: parsePrice(raw.lot_rent),
        occupancy: parsePercent(raw.occupancy),
        notes: null,
        source: sourceName,
        listing_url: raw.property_url?.startsWith('http') 
          ? raw.property_url 
          : raw.property_url 
            ? `${source.base_url}${raw.property_url}`
            : url,
        image_url: raw.image_url || null,
        raw_data: raw,
      }
      
      return listing
    })

    return { listings, error: null }
  } catch (err) {
    return { listings: [], error: `Scrape failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }
}

// Add Street View images to properties
export async function addStreetViewImages(propertyIds: string[]): Promise<number> {
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!googleApiKey) {
    console.error('GOOGLE_MAPS_API_KEY not configured')
    return 0
  }

  const supabase = getSupabase()
  let updated = 0

  // Get properties that need images
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, address, city, state')
    .in('id', propertyIds)
    .or('image_url.is.null,image_url.like.%unsplash%')

  if (error || !properties) {
    console.error('Failed to fetch properties for Street View:', error)
    return 0
  }

  for (const prop of properties) {
    const fullAddress = prop.address 
      ? `${prop.address}, ${prop.city}, ${prop.state}`
      : `${prop.city}, ${prop.state}`
    
    const streetViewUrl = getStreetViewUrl(fullAddress, googleApiKey)
    
    // Verify the image exists (Street View returns a grey image if no coverage)
    try {
      const checkResponse = await fetch(
        `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(fullAddress)}&key=${googleApiKey}`
      )
      const metadata = await checkResponse.json()
      
      if (metadata.status === 'OK') {
        await supabase
          .from('properties')
          .update({ image_url: streetViewUrl })
          .eq('id', prop.id)
        updated++
      }
    } catch (err) {
      console.error(`Failed to get Street View for ${prop.id}:`, err)
    }
  }

  return updated
}

// Save scraped listings to database with deduplication
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
      // Check for existing listing by name + city + state (deduplication)
      const { data: existing } = await supabase
        .from('properties')
        .select('id, name, asking_price')
        .eq('name', listing.name)
        .eq('city', listing.city)
        .eq('state', listing.state)
        .single()

      // Determine region based on state
      const region = getRegionFromState(listing.state)
      
      // Calculate AI score
      const aiScore = calculateAIScore(listing)
      
      // Get Street View image if we have an address and API key
      let imageUrl = listing.image_url
      if (googleApiKey && listing.address && !imageUrl) {
        const fullAddress = `${listing.address}, ${listing.city}, ${listing.state}`
        const streetViewUrl = getStreetViewUrl(fullAddress, googleApiKey)
        
        // Check if Street View coverage exists
        try {
          const checkResponse = await fetch(
            `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(fullAddress)}&key=${googleApiKey}`
          )
          const metadata = await checkResponse.json()
          if (metadata.status === 'OK') {
            imageUrl = streetViewUrl
          }
        } catch {
          // Keep existing image or null
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
        listing_url: listing.listing_url,
        image_url: imageUrl,
        ai_score: aiScore,
        status: 'active',
        mom_pop: true, // Default assumption, can be refined
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        // Update existing listing if price changed
        if (existing.asking_price !== listing.asking_price) {
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

// Create a scrape job record
export async function createScrapeJob(source: string): Promise<string | null> {
  const supabase = getSupabase()
  
  const sourceConfig = SCRAPE_SOURCES.find(s => s.name === source)
  if (!sourceConfig) return null
  
  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({
      source,
      url: `${sourceConfig.base_url}${sourceConfig.listing_pattern}`,
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

// Run full scrape for all sources
export async function runFullScrape(): Promise<{
  totalFound: number
  totalAdded: number
  totalUpdated: number
  errors: string[]
}> {
  let totalFound = 0
  let totalAdded = 0
  let totalUpdated = 0
  const errors: string[] = []

  for (const source of SCRAPE_SOURCES) {
    if (!source.enabled) continue

    const jobId = await createScrapeJob(source.name)
    if (!jobId) {
      errors.push(`Failed to create job for ${source.name}`)
      continue
    }

    await updateScrapeJob(jobId, { 
      status: 'running', 
      started_at: new Date().toISOString() 
    })

    const { listings, error } = await scrapeSource(source.name)
    
    if (error) {
      await updateScrapeJob(jobId, {
        status: 'failed',
        error_message: error,
        completed_at: new Date().toISOString(),
      })
      errors.push(`${source.name}: ${error}`)
      continue
    }

    totalFound += listings.length
    
    const { added, updated, errors: saveErrors } = await saveListings(listings)
    
    totalAdded += added
    totalUpdated += updated
    errors.push(...saveErrors)

    await updateScrapeJob(jobId, {
      status: 'completed',
      listings_found: listings.length,
      listings_added: added,
      listings_updated: updated,
      completed_at: new Date().toISOString(),
    })
  }

  return { totalFound, totalAdded, totalUpdated, errors }
}

// Helper: Map state to region
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
