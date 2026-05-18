import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Image source types and fallback priority
type ImageSource = 'street_view' | 'static_map' | 'satellite' | 'placeholder'

interface ImageResult {
  url: string
  source: ImageSource
  available: boolean
  metadata?: {
    date?: string
    panoId?: string
    heading?: number
    pitch?: number
  }
}

interface StreetViewMetadata {
  status: string
  date?: string
  pano_id?: string
  location?: {
    lat: number
    lng: number
  }
  copyright?: string
}

// Generate Google Street View URL with proper parameters
function getStreetViewUrl(
  address: string,
  city: string,
  state: string,
  apiKey: string,
  options: {
    size?: string
    heading?: number
    pitch?: number
    fov?: number
    source?: 'default' | 'outdoor'
  } = {}
): string {
  const {
    size = '800x600',
    heading = 0,
    pitch = 0,
    fov = 90,
    source = 'outdoor'
  } = options

  const location = encodeURIComponent(`${address}, ${city}, ${state}, USA`)
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${location}&heading=${heading}&pitch=${pitch}&fov=${fov}&source=${source}&key=${apiKey}`
}

// Generate Google Static Map URL (aerial view fallback)
function getStaticMapUrl(
  address: string,
  city: string,
  state: string,
  apiKey: string,
  options: {
    size?: string
    zoom?: number
    maptype?: 'roadmap' | 'satellite' | 'terrain' | 'hybrid'
  } = {}
): string {
  const {
    size = '800x600',
    zoom = 17,
    maptype = 'hybrid'
  } = options

  const location = encodeURIComponent(`${address}, ${city}, ${state}, USA`)
  return `https://maps.googleapis.com/maps/api/staticmap?center=${location}&zoom=${zoom}&size=${size}&maptype=${maptype}&key=${apiKey}`
}

// Generate satellite-only view URL
function getSatelliteUrl(
  address: string,
  city: string,
  state: string,
  apiKey: string
): string {
  return getStaticMapUrl(address, city, state, apiKey, {
    maptype: 'satellite',
    zoom: 18
  })
}

// Check if Street View is available for a location
async function checkStreetViewAvailability(
  address: string,
  city: string,
  state: string,
  apiKey: string
): Promise<{ available: boolean; metadata: StreetViewMetadata | null }> {
  try {
    const location = encodeURIComponent(`${address}, ${city}, ${state}, USA`)
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${location}&key=${apiKey}`

    const response = await fetch(metadataUrl)
    const data: StreetViewMetadata = await response.json()

    return {
      available: data.status === 'OK',
      metadata: data.status === 'OK' ? data : null
    }
  } catch (error) {
    console.error('Street View metadata check failed:', error)
    return { available: false, metadata: null }
  }
}

// Check if Street View metadata indicates a real image (not a grey placeholder)
async function verifyStreetViewImage(
  address: string,
  city: string,
  state: string,
  apiKey: string
): Promise<{ valid: boolean; metadata: StreetViewMetadata | null; imageAge?: string }> {
  const { available, metadata } = await checkStreetViewAvailability(address, city, state, apiKey)

  if (!available || !metadata) {
    return { valid: false, metadata: null }
  }

  // Check if the image is reasonably recent (within last 10 years)
  let imageAge: string | undefined
  if (metadata.date) {
    const [year, month] = metadata.date.split('-').map(Number)
    const imageDate = new Date(year, month - 1)
    const now = new Date()
    const ageYears = (now.getTime() - imageDate.getTime()) / (1000 * 60 * 60 * 24 * 365)

    if (ageYears > 10) {
      // Image is quite old - might want to flag this
      imageAge = `${Math.round(ageYears)} years old`
    } else {
      imageAge = metadata.date
    }
  }

  return {
    valid: true,
    metadata,
    imageAge
  }
}

// Get the best available image for a property with fallbacks
async function getBestImage(
  address: string | null,
  city: string,
  state: string,
  apiKey: string
): Promise<ImageResult> {
  // Priority 1: Street View if address is available
  if (address) {
    const verification = await verifyStreetViewImage(address, city, state, apiKey)

    if (verification.valid) {
      return {
        url: getStreetViewUrl(address, city, state, apiKey),
        source: 'street_view',
        available: true,
        metadata: {
          date: verification.imageAge,
          panoId: verification.metadata?.pano_id
        }
      }
    }

    // Priority 2: Satellite/Hybrid map view
    return {
      url: getStaticMapUrl(address, city, state, apiKey, { maptype: 'hybrid', zoom: 18 }),
      source: 'satellite',
      available: true
    }
  }

  // Priority 3: City-level satellite view (no specific address)
  return {
    url: getStaticMapUrl('', city, state, apiKey, { maptype: 'satellite', zoom: 13 }),
    source: 'satellite',
    available: true
  }
}

// Placeholder images for when no image is available
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop', // Mobile home park aerial
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop', // Residential
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop', // Housing
]

function getPlaceholderImage(): string {
  return PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)]
}

// POST: Update properties with the best available images
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'GOOGLE_MAPS_API_KEY not configured',
        message: 'Please add your Google Maps API key to continue'
      }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { propertyId, updateAll, forceRefresh, limit = 100 } = body

    let properties: Array<{
      id: string
      address: string | null
      city: string
      state: string
      image_url: string | null
    }> = []

    if (propertyId) {
      // Update single property
      const { data } = await supabase
        .from('properties')
        .select('id, address, city, state, image_url')
        .eq('id', propertyId)
        .single()

      if (data) properties = [data]
    } else if (updateAll) {
      // Update all properties without proper images or with placeholder images
      let query = supabase
        .from('properties')
        .select('id, address, city, state, image_url')

      if (!forceRefresh) {
        // Only update properties without images or with unsplash placeholders
        query = query.or('image_url.is.null,image_url.like.%unsplash%')
      }

      const { data } = await query.limit(limit)
      properties = data || []
    }

    const results = {
      processed: 0,
      streetView: 0,
      satellite: 0,
      placeholder: 0,
      failed: 0,
      details: [] as Array<{
        id: string
        source: ImageSource
        imageAge?: string
      }>
    }

    for (const property of properties) {
      results.processed++

      if (!property.city || !property.state) {
        results.failed++
        continue
      }

      try {
        const imageResult = await getBestImage(
          property.address,
          property.city,
          property.state,
          apiKey
        )

        // Track source statistics
        if (imageResult.source === 'street_view') results.streetView++
        else if (imageResult.source === 'satellite') results.satellite++
        else results.placeholder++

        results.details.push({
          id: property.id,
          source: imageResult.source,
          imageAge: imageResult.metadata?.date
        })

        // Update the property
        const { error } = await supabase
          .from('properties')
          .update({
            image_url: imageResult.url,
            updated_at: new Date().toISOString()
          })
          .eq('id', property.id)

        if (error) {
          console.error(`Failed to update property ${property.id}:`, error)
          results.failed++
        }
      } catch (error) {
        console.error(`Error processing property ${property.id}:`, error)
        results.failed++
      }

      // Rate limiting - Google allows 100 requests per second
      // We'll be conservative to avoid quota issues
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    return NextResponse.json({
      success: true,
      ...results,
      summary: {
        streetViewRate: results.processed > 0 ? Math.round((results.streetView / results.processed) * 100) : 0,
        satelliteRate: results.processed > 0 ? Math.round((results.satellite / results.processed) * 100) : 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Street View update error:', error)
    return NextResponse.json({
      error: 'Update failed',
      message: errorMessage
    }, { status: 500 })
  }
}

// GET: Generate Street View URL for a single address with availability check
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const city = searchParams.get('city')
  const state = searchParams.get('state')
  const checkOnly = searchParams.get('checkOnly') === 'true'

  if (!city || !state) {
    return NextResponse.json({
      error: 'Missing parameters',
      required: ['city', 'state'],
      optional: ['address', 'checkOnly']
    }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'GOOGLE_MAPS_API_KEY not configured'
    }, { status: 500 })
  }

  try {
    if (checkOnly && address) {
      // Just check availability
      const verification = await verifyStreetViewImage(address, city, state, apiKey)
      return NextResponse.json({
        available: verification.valid,
        imageAge: verification.imageAge,
        metadata: verification.metadata
      })
    }

    // Get the best available image
    const result = await getBestImage(address, city, state, apiKey)

    return NextResponse.json({
      success: true,
      ...result,
      alternatives: {
        streetView: address ? getStreetViewUrl(address, city, state, apiKey) : null,
        satellite: getStaticMapUrl(address || '', city, state, apiKey, { maptype: 'satellite' }),
        hybrid: getStaticMapUrl(address || '', city, state, apiKey, { maptype: 'hybrid' }),
        roadmap: getStaticMapUrl(address || '', city, state, apiKey, { maptype: 'roadmap' })
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: 'Failed to generate image',
      message: errorMessage
    }, { status: 500 })
  }
}
