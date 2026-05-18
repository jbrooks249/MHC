import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Real estate listing sources configuration
const LISTING_SOURCES = {
  mhvillage: {
    name: 'MHVillage',
    baseUrl: 'https://www.mhvillage.com',
    searchUrl: 'https://www.mhvillage.com/Search',
    description: 'Largest mobile home marketplace',
    type: 'marketplace'
  },
  loopnet: {
    name: 'LoopNet',
    baseUrl: 'https://www.loopnet.com',
    searchUrl: 'https://www.loopnet.com/search/mobile-home-parks',
    description: 'Commercial real estate marketplace',
    type: 'commercial'
  },
  crexi: {
    name: 'Crexi',
    baseUrl: 'https://www.crexi.com',
    searchUrl: 'https://www.crexi.com/properties',
    description: 'Commercial real estate platform',
    type: 'commercial'
  },
  mobilehomeparkstore: {
    name: 'MobileHomesParkStore',
    baseUrl: 'https://www.mobilehomeparkstore.com',
    searchUrl: 'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale',
    description: 'MHP-focused listing site',
    type: 'specialized'
  },
  land: {
    name: 'Land.com',
    baseUrl: 'https://www.land.com',
    searchUrl: 'https://www.land.com/mobile-home-parks',
    description: 'Land and property listings',
    type: 'general'
  },
  realtor: {
    name: 'Realtor.com',
    baseUrl: 'https://www.realtor.com',
    searchUrl: 'https://www.realtor.com/commercial',
    description: 'General real estate platform',
    type: 'general'
  },
  costar: {
    name: 'CoStar',
    baseUrl: 'https://www.costar.com',
    description: 'Commercial real estate analytics (subscription required)',
    type: 'premium'
  },
  reonomy: {
    name: 'Reonomy',
    baseUrl: 'https://www.reonomy.com',
    description: 'Commercial property intelligence',
    type: 'premium'
  }
}

// GET - List available sources and search for listings
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  if (action === 'sources') {
    return NextResponse.json({
      success: true,
      sources: Object.entries(LISTING_SOURCES).map(([id, source]) => ({
        id,
        ...source
      }))
    })
  }

  if (action === 'search') {
    const query = searchParams.get('query')
    const state = searchParams.get('state')
    const city = searchParams.get('city')

    const searchResults = generateSearchUrls(query, state, city)
    return NextResponse.json({
      success: true,
      searchUrls: searchResults
    })
  }

  // Default: return sources overview
  return NextResponse.json({
    success: true,
    sources: Object.entries(LISTING_SOURCES).map(([id, source]) => ({
      id,
      ...source
    })),
    endpoints: {
      sources: '/api/listings?action=sources',
      search: '/api/listings?action=search&query=<query>&state=<state>&city=<city>',
      findUrl: 'POST /api/listings - { action: "find_url", propertyId: "<id>" }',
      scrape: 'POST /api/listings - { action: "scrape", source: "<source>", state: "<state>" }'
    }
  })
}

// POST - Perform listing actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'find_url':
        return await handleFindUrl(body)
      case 'scrape':
        return await handleScrape(body)
      case 'validate_url':
        return await handleValidateUrl(body)
      case 'bulk_search':
        return await handleBulkSearch(body)
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Listing API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

// Generate search URLs for multiple platforms
function generateSearchUrls(query?: string | null, state?: string | null, city?: string | null) {
  const results: { source: string; name: string; url: string; type: string }[] = []
  
  const location = city && state 
    ? `${city}, ${state}` 
    : state || 'United States'

  // MHVillage
  results.push({
    source: 'mhvillage',
    name: 'MHVillage',
    url: `https://www.mhvillage.com/Search?location=${encodeURIComponent(location)}&type=community`,
    type: 'marketplace'
  })

  // LoopNet
  if (state) {
    results.push({
      source: 'loopnet',
      name: 'LoopNet',
      url: `https://www.loopnet.com/search/mobile-home-parks/${state.toLowerCase()}/for-sale/`,
      type: 'commercial'
    })
  }

  // Crexi
  results.push({
    source: 'crexi',
    name: 'Crexi',
    url: `https://www.crexi.com/properties?asset=Mobile%20Home%20Parks&location=${encodeURIComponent(location)}`,
    type: 'commercial'
  })

  // Mobile Home Park Store
  if (state) {
    results.push({
      source: 'mobilehomeparkstore',
      name: 'MobileHomeParkStore',
      url: `https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/${state.toLowerCase()}/`,
      type: 'specialized'
    })
  }

  // Land.com
  if (state) {
    results.push({
      source: 'land',
      name: 'Land.com',
      url: `https://www.land.com/mobile-home-parks/${state.toLowerCase()}/`,
      type: 'general'
    })
  }

  // Google search for specific property
  if (query) {
    results.push({
      source: 'google',
      name: 'Google Search',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} mobile home park for sale`)}`,
      type: 'search'
    })
  }

  return results
}

// Find listing URL for a specific property
async function handleFindUrl(body: { propertyId?: string }) {
  const { propertyId } = body

  if (!propertyId) {
    return NextResponse.json(
      { success: false, error: 'Property ID required' },
      { status: 400 }
    )
  }

  // Fetch property
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (error || !property) {
    return NextResponse.json(
      { success: false, error: 'Property not found' },
      { status: 404 }
    )
  }

  // Generate search URLs
  const searchUrls = generateSearchUrls(
    property.name,
    property.state,
    property.city
  )

  // Use AI to suggest best search approach
  const { text: suggestion } = await generateText({
    model: 'anthropic/claude-sonnet-4-20250514',
    prompt: `Given this mobile home community:
Name: ${property.name}
Location: ${property.city}, ${property.state}
Address: ${property.address || 'Unknown'}
Units: ${property.units}

Suggest the most effective search strategy to find the original listing. Include:
1. Most likely source (MHVillage, LoopNet, Crexi, etc.)
2. Specific search terms to use
3. Alternative names the property might be listed under

Keep response to 100 words.`,
    maxOutputTokens: 200
  })

  return NextResponse.json({
    success: true,
    property: {
      id: property.id,
      name: property.name,
      location: `${property.city}, ${property.state}`
    },
    searchUrls,
    aiSuggestion: suggestion
  })
}

// Scrape listings from a source (placeholder - actual implementation would need proper scraping)
async function handleScrape(body: { source?: string; state?: string; limit?: number }) {
  const { source, state, limit = 20 } = body

  if (!source) {
    return NextResponse.json(
      { success: false, error: 'Source required' },
      { status: 400 }
    )
  }

  const sourceConfig = LISTING_SOURCES[source as keyof typeof LISTING_SOURCES]
  if (!sourceConfig) {
    return NextResponse.json(
      { success: false, error: `Unknown source: ${source}` },
      { status: 400 }
    )
  }

  // For now, return guidance on how to use the source
  // Actual scraping would require proper implementation with respect to robots.txt and ToS
  return NextResponse.json({
    success: true,
    message: `Scraping ${sourceConfig.name} is not directly implemented. Use the search URLs to manually find listings.`,
    source: {
      id: source,
      ...sourceConfig
    },
    searchUrl: generateSearchUrls(null, state, null).find(s => s.source === source),
    note: 'For production use, consider using official APIs where available or implementing proper scraping with rate limiting.',
    alternatives: [
      'Use MHVillage API (requires partnership)',
      'Use CoStar API (subscription required)',
      'Manual data entry through admin panel',
      'Import from CSV/Excel exports'
    ]
  })
}

// Validate a listing URL is still active
async function handleValidateUrl(body: { url?: string; propertyId?: string }) {
  const { url, propertyId } = body

  if (!url && !propertyId) {
    return NextResponse.json(
      { success: false, error: 'URL or property ID required' },
      { status: 400 }
    )
  }

  let listingUrl = url

  if (propertyId && !url) {
    const { data: property } = await supabase
      .from('properties')
      .select('listing_url')
      .eq('id', propertyId)
      .single()

    if (property?.listing_url) {
      listingUrl = property.listing_url
    }
  }

  if (!listingUrl) {
    return NextResponse.json({
      success: true,
      valid: false,
      reason: 'No listing URL found'
    })
  }

  // Try to fetch the URL
  try {
    const response = await fetch(listingUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MHC-Bot/1.0)'
      }
    })

    const isValid = response.ok
    const status = response.status

    // Update property if we have an ID
    if (propertyId) {
      await supabase
        .from('properties')
        .update({
          listing_url_valid: isValid,
          listing_url_checked_at: new Date().toISOString()
        })
        .eq('id', propertyId)
    }

    return NextResponse.json({
      success: true,
      valid: isValid,
      status,
      url: listingUrl
    })
  } catch {
    return NextResponse.json({
      success: true,
      valid: false,
      reason: 'Failed to fetch URL',
      url: listingUrl
    })
  }
}

// Bulk search for multiple properties
async function handleBulkSearch(body: { propertyIds?: string[]; limit?: number }) {
  const { propertyIds, limit = 10 } = body

  if (!propertyIds?.length) {
    return NextResponse.json(
      { success: false, error: 'Property IDs required' },
      { status: 400 }
    )
  }

  // Fetch properties
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, name, city, state, address, listing_url')
    .in('id', propertyIds.slice(0, limit))

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }

  const results = properties?.map(property => ({
    property: {
      id: property.id,
      name: property.name,
      location: `${property.city}, ${property.state}`
    },
    hasUrl: !!property.listing_url,
    searchUrls: !property.listing_url 
      ? generateSearchUrls(property.name, property.state, property.city).slice(0, 3)
      : []
  })) || []

  return NextResponse.json({
    success: true,
    results,
    summary: {
      total: results.length,
      withUrl: results.filter(r => r.hasUrl).length,
      needsUrl: results.filter(r => !r.hasUrl).length
    }
  })
}
