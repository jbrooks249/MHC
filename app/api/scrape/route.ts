import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import FirecrawlApp from '@mendable/firecrawl-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// MHP listing source configurations
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
    ]
  },
  {
    name: 'LoopNet',
    url: 'https://www.loopnet.com/search/mobile-home-parks/usa/for-sale/',
  },
  {
    name: 'Crexi',
    url: 'https://www.crexi.com/properties/mobile-home-parks',
  }
]

// Extract structured data from scraped content
function extractListingData(content: string, source: string, url: string) {
  const listings: any[] = []
  
  // Parse patterns based on source - this extracts property details from page content
  const pricePattern = /\$[\d,]+(?:\.\d{2})?(?:\s*(?:M|K|Million|Thousand))?/gi
  const unitsPattern = /(\d+)\s*(?:units?|lots?|sites?|spaces?|pads?)/gi
  const addressPattern = /(\d+[^,]+),\s*([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?/g
  
  // Extract prices
  const prices = content.match(pricePattern) || []
  
  // Extract units
  const unitsMatches = [...content.matchAll(unitsPattern)]
  
  // Extract addresses
  const addressMatches = [...content.matchAll(addressPattern)]
  
  // Try to pair data together (simplified - real implementation would be more sophisticated)
  addressMatches.forEach((match, index) => {
    const listing = {
      name: `MHP at ${match[1].trim()}`,
      address: match[1].trim(),
      city: match[2].trim(),
      state: match[3].trim(),
      asking_price: prices[index] ? parsePrice(prices[index]) : null,
      units: unitsMatches[index] ? parseInt(unitsMatches[index][1]) : null,
      source: source,
      listing_url: url,
      status: 'active',
      scraped_at: new Date().toISOString()
    }
    
    if (listing.city && listing.state) {
      listings.push(listing)
    }
  })
  
  return listings
}

function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null
  
  const cleaned = priceStr.replace(/[$,]/g, '').trim()
  let value = parseFloat(cleaned)
  
  if (priceStr.toLowerCase().includes('m') || priceStr.toLowerCase().includes('million')) {
    value *= 1000000
  } else if (priceStr.toLowerCase().includes('k') || priceStr.toLowerCase().includes('thousand')) {
    value *= 1000
  }
  
  return isNaN(value) ? null : value
}

// Get Google Street View image URL
function getStreetViewUrl(address: string, city: string, state: string): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return ''
  
  const location = encodeURIComponent(`${address}, ${city}, ${state}`)
  return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${location}&key=${apiKey}`
}

// Calculate AI score based on property metrics
function calculateAIScore(listing: any): number {
  let score = 70 // Base score
  
  // Units scoring
  if (listing.units) {
    if (listing.units >= 50 && listing.units <= 150) score += 10
    else if (listing.units >= 20 && listing.units < 50) score += 5
    else if (listing.units > 150) score += 3
  }
  
  // Price per unit scoring
  if (listing.asking_price && listing.units) {
    const pricePerUnit = listing.asking_price / listing.units
    if (pricePerUnit < 50000) score += 15
    else if (pricePerUnit < 75000) score += 10
    else if (pricePerUnit < 100000) score += 5
  }
  
  // Cap rate scoring
  if (listing.cap_rate) {
    if (listing.cap_rate >= 8) score += 10
    else if (listing.cap_rate >= 7) score += 5
  }
  
  // Ensure score is between 0-100
  return Math.min(100, Math.max(0, score))
}

// Get region from state
function getRegion(state: string): string {
  const regions: Record<string, string> = {
    'FL': 'Southeast', 'GA': 'Southeast', 'SC': 'Southeast', 'NC': 'Southeast',
    'AL': 'Southeast', 'MS': 'Southeast', 'TN': 'Southeast', 'KY': 'Southeast',
    'TX': 'Southwest', 'AZ': 'Southwest', 'NM': 'Southwest', 'OK': 'Southwest',
    'CA': 'Pacific', 'NV': 'Southwest',
    'OR': 'Pacific NW', 'WA': 'Pacific NW',
    'CO': 'Mountain', 'UT': 'Mountain', 'ID': 'Mountain', 'MT': 'Mountain', 'WY': 'Mountain',
    'OH': 'Midwest', 'IN': 'Midwest', 'MI': 'Midwest', 'IL': 'Midwest',
    'WI': 'Midwest', 'MN': 'Midwest', 'IA': 'Midwest', 'MO': 'Midwest',
    'KS': 'Midwest', 'NE': 'Midwest', 'SD': 'Midwest', 'ND': 'Midwest',
    'NY': 'Northeast', 'PA': 'Northeast', 'NJ': 'Northeast', 'MA': 'Northeast',
    'CT': 'Northeast', 'RI': 'Northeast', 'VT': 'Northeast', 'NH': 'Northeast', 'ME': 'Northeast',
    'MD': 'Northeast', 'DE': 'Northeast', 'VA': 'Southeast', 'WV': 'Southeast',
  }
  return regions[state] || 'Other'
}

// State coordinates for geocoding fallback
const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  'FL': { lat: 28.0, lng: -81.5 }, 'TX': { lat: 31.0, lng: -100.0 },
  'AZ': { lat: 34.0, lng: -111.0 }, 'CA': { lat: 36.7, lng: -119.4 },
  'GA': { lat: 33.0, lng: -83.5 }, 'NC': { lat: 35.5, lng: -79.0 },
  'OH': { lat: 40.4, lng: -82.9 }, 'MI': { lat: 44.3, lng: -85.6 },
  'IN': { lat: 40.0, lng: -86.0 }, 'TN': { lat: 35.5, lng: -86.0 },
  'CO': { lat: 39.0, lng: -105.5 }, 'OR': { lat: 44.0, lng: -120.5 },
  'WA': { lat: 47.5, lng: -120.5 }, 'NV': { lat: 39.0, lng: -117.0 },
}

export async function POST(request: NextRequest) {
  try {
    // Verify authorization (simple API key check)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // Allow cron jobs or admin requests
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Check if it's an admin request from the dashboard
      const body = await request.json().catch(() => ({}))
      if (!body.adminTrigger) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlKey) {
      return NextResponse.json({ 
        error: 'FIRECRAWL_API_KEY not configured',
        message: 'Please add your Firecrawl API key to continue'
      }, { status: 500 })
    }

    const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey })
    
    const results = {
      total_scraped: 0,
      total_added: 0,
      total_updated: 0,
      sources: [] as any[],
      errors: [] as string[]
    }

    // Process each source
    for (const source of SOURCES) {
      const urls = source.stateUrls || [source.url]
      
      for (const url of urls) {
        // Create job record
        const { data: job } = await supabase
          .from('scrape_jobs')
          .insert({
            source: source.name,
            url: url,
            status: 'running',
            started_at: new Date().toISOString()
          })
          .select()
          .single()

        try {
          // Scrape the page using Firecrawl
          const scrapeResult = await firecrawl.scrapeUrl(url, {
            formats: ['markdown', 'html'],
          })

          if (!scrapeResult.success) {
            throw new Error(scrapeResult.error || 'Scrape failed')
          }

          const content = scrapeResult.markdown || scrapeResult.html || ''
          const listings = extractListingData(content, source.name, url)
          
          let added = 0
          let updated = 0

          // Process each listing
          for (const listing of listings) {
            // Check for existing listing by address + city + state
            const { data: existing } = await supabase
              .from('properties')
              .select('id')
              .eq('city', listing.city)
              .eq('state', listing.state)
              .ilike('address', `%${listing.address}%`)
              .single()

            // Add AI score, region, and coordinates
            listing.ai_score = calculateAIScore(listing)
            listing.region = getRegion(listing.state)
            
            // Add coordinates
            const coords = STATE_COORDS[listing.state]
            if (coords) {
              listing.latitude = coords.lat + (Math.random() - 0.5) * 2
              listing.longitude = coords.lng + (Math.random() - 0.5) * 2
            }

            // Add Street View image
            if (process.env.GOOGLE_MAPS_API_KEY && listing.address) {
              listing.image_url = getStreetViewUrl(listing.address, listing.city, listing.state)
            }

            if (existing) {
              // Update existing
              await supabase
                .from('properties')
                .update({
                  asking_price: listing.asking_price,
                  units: listing.units,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
              updated++
            } else {
              // Insert new
              await supabase
                .from('properties')
                .insert(listing)
              added++
            }
          }

          // Update job status
          await supabase
            .from('scrape_jobs')
            .update({
              status: 'completed',
              listings_found: listings.length,
              listings_added: added,
              listings_updated: updated,
              completed_at: new Date().toISOString()
            })
            .eq('id', job?.id)

          results.total_scraped += listings.length
          results.total_added += added
          results.total_updated += updated
          results.sources.push({
            source: source.name,
            url,
            found: listings.length,
            added,
            updated
          })

        } catch (error: any) {
          results.errors.push(`${source.name}: ${error.message}`)
          
          await supabase
            .from('scrape_jobs')
            .update({
              status: 'failed',
              error_message: error.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', job?.id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json({ 
      error: 'Scrape failed', 
      message: error.message 
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
        totalProperties,
        activeProperties,
        lastScrape: recentJobs?.[0]?.created_at
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
