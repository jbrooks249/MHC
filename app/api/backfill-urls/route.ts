import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SCRAPER_SOURCES } from '@/lib/scraper-sources'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate listing URLs based on source
function generateListingUrl(property: {
  name: string
  city: string
  state: string
  source: string | null
}): string | null {
  const source = SCRAPER_SOURCES.find(s => s.name === property.source)
  
  if (!source) {
    // Generate search URL for common sources based on source name
    const sourceName = property.source?.toLowerCase() || ''
    const searchQuery = encodeURIComponent(`${property.name} ${property.city} ${property.state} mobile home park`)
    
    if (sourceName.includes('loopnet')) {
      return `https://www.loopnet.com/search/mobile-home-parks/${property.state}/${property.city}/`
    }
    if (sourceName.includes('crexi')) {
      return `https://www.crexi.com/properties?q=${searchQuery}`
    }
    if (sourceName.includes('mobilehomeparkstore')) {
      return `https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/${property.state.toLowerCase()}/`
    }
    if (sourceName.includes('commercialcafe')) {
      return `https://www.commercialcafe.com/mobile-home-parks-for-sale/${property.state.toLowerCase()}/${property.city.toLowerCase().replace(/\s+/g, '-')}/`
    }
    
    // Default to Google search
    return `https://www.google.com/search?q=${searchQuery}`
  }
  
  // Generate URL based on source base URL
  const searchQuery = encodeURIComponent(`${property.name} ${property.city}`)
  return `${source.baseUrl}/search?q=${searchQuery}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { limit = 100, onlyMissing = true, propertyId } = body

    let query = supabase
      .from('properties')
      .select('id, name, city, state, source, listing_url')

    if (propertyId) {
      query = query.eq('id', propertyId)
    } else if (onlyMissing) {
      query = query.or('listing_url.is.null,listing_url.eq.')
    }

    const { data: properties, error } = await query.limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{ id: string; name: string; url: string | null; status: string }>
    }

    for (const property of properties || []) {
      results.processed++

      // Skip if already has a valid URL
      if (property.listing_url && property.listing_url.startsWith('http')) {
        results.skipped++
        results.details.push({
          id: property.id,
          name: property.name,
          url: property.listing_url,
          status: 'skipped - already has URL'
        })
        continue
      }

      // Generate URL
      const generatedUrl = generateListingUrl(property)

      if (generatedUrl) {
        const { error: updateError } = await supabase
          .from('properties')
          .update({
            listing_url: generatedUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', property.id)

        if (updateError) {
          results.failed++
          results.details.push({
            id: property.id,
            name: property.name,
            url: null,
            status: `failed: ${updateError.message}`
          })
        } else {
          results.updated++
          results.details.push({
            id: property.id,
            name: property.name,
            url: generatedUrl,
            status: 'updated'
          })
        }
      } else {
        results.failed++
        results.details.push({
          id: property.id,
          name: property.name,
          url: null,
          status: 'no URL could be generated'
        })
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// GET: Check properties without listing URLs
export async function GET() {
  try {
    const { count: totalProperties } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })

    const { count: withUrls } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .not('listing_url', 'is', null)
      .neq('listing_url', '')

    const { count: withoutUrls } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .or('listing_url.is.null,listing_url.eq.')

    return NextResponse.json({
      totalProperties,
      withUrls,
      withoutUrls,
      coverage: totalProperties ? Math.round(((withUrls || 0) / totalProperties) * 100) : 0
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
