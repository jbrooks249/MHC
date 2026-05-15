import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate Google Street View URL for a location
function getStreetViewUrl(
  location: string | { lat: number; lng: number }, 
  apiKey: string,
  size: string = '800x600'
): string {
  const locationParam = typeof location === 'string'
    ? encodeURIComponent(location)
    : `${location.lat},${location.lng}`
  
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${locationParam}&key=${apiKey}&source=outdoor&pitch=5`
}

// Check if Street View is available for a location
async function checkStreetViewAvailability(
  location: string | { lat: number; lng: number }
): Promise<{ available: boolean; panoId?: string; date?: string }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return { available: false }
  
  try {
    const locationParam = typeof location === 'string'
      ? `location=${encodeURIComponent(location)}`
      : `location=${location.lat},${location.lng}`
    
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?${locationParam}&key=${apiKey}`
    
    const response = await fetch(metadataUrl)
    const data = await response.json()
    
    return {
      available: data.status === 'OK',
      panoId: data.pano_id,
      date: data.date,
    }
  } catch {
    return { available: false }
  }
}

// Geocode an address to get coordinates
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === 'OK' && data.results?.[0]) {
      return data.results[0].geometry.location
    }
    return null
  } catch {
    return null
  }
}

// POST: Update properties with Street View images (batch)
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'GOOGLE_MAPS_API_KEY not configured',
        message: 'Please add your Google Maps API key in Settings > Vars'
      }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { propertyId, updateAll, limit = 100 } = body

    let properties: { id: string; address: string | null; city: string; state: string; latitude?: number; longitude?: number }[] = []

    if (propertyId) {
      // Update single property
      const { data } = await supabase
        .from('properties')
        .select('id, address, city, state, latitude, longitude')
        .eq('id', propertyId)
        .single()
      
      if (data) properties = [data]
    } else if (updateAll) {
      // Update properties without verified Street View images
      const { data } = await supabase
        .from('properties')
        .select('id, address, city, state, latitude, longitude, image_url')
        .or('image_verified.is.null,image_verified.eq.false')
        .not('address', 'is', null)
        .limit(limit)
      
      properties = data || []
    }

    let updated = 0
    let failed = 0
    const results: { id: string; success: boolean; url?: string; error?: string }[] = []

    for (const property of properties) {
      try {
        // Try with coordinates first if available
        let checkLocation: string | { lat: number; lng: number } = 
          property.latitude && property.longitude
            ? { lat: property.latitude, lng: property.longitude }
            : `${property.address}, ${property.city}, ${property.state}, USA`

        let availability = await checkStreetViewAvailability(checkLocation)

        // If no Street View at coordinates, try with address
        if (!availability.available && property.latitude && property.longitude) {
          checkLocation = `${property.address}, ${property.city}, ${property.state}, USA`
          availability = await checkStreetViewAvailability(checkLocation)
        }

        // If still no Street View, try geocoding and checking nearby
        if (!availability.available && property.address) {
          const coords = await geocodeAddress(`${property.address}, ${property.city}, ${property.state}`)
          if (coords) {
            availability = await checkStreetViewAvailability(coords)
            checkLocation = coords
          }
        }

        if (availability.available) {
          const imageUrl = getStreetViewUrl(checkLocation, apiKey)
          
          const { error } = await supabase
            .from('properties')
            .update({ 
              image_url: imageUrl,
              image_verified: true,
            })
            .eq('id', property.id)

          if (error) {
            failed++
            results.push({ id: property.id, success: false, error: error.message })
          } else {
            updated++
            results.push({ id: property.id, success: true, url: imageUrl })
          }
        } else {
          failed++
          results.push({ id: property.id, success: false, error: 'No Street View coverage' })
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (err) {
        failed++
        results.push({ 
          id: property.id, 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        })
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      failed,
      total: properties.length,
      results: results.slice(0, 20), // Only return first 20 for response size
    })

  } catch (error: unknown) {
    console.error('Street View update error:', error)
    return NextResponse.json({ 
      error: 'Update failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Check Street View availability for an address or generate URL
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const city = searchParams.get('city')
  const state = searchParams.get('state')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const checkOnly = searchParams.get('check') === 'true'

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'GOOGLE_MAPS_API_KEY not configured'
    }, { status: 500 })
  }

  // Determine location to check
  let location: string | { lat: number; lng: number }
  
  if (lat && lng) {
    location = { lat: parseFloat(lat), lng: parseFloat(lng) }
  } else if (address && city && state) {
    location = `${address}, ${city}, ${state}, USA`
  } else if (city && state) {
    location = `${city}, ${state}, USA`
  } else {
    return NextResponse.json({ 
      error: 'Missing parameters',
      required: ['address, city, state OR lat, lng']
    }, { status: 400 })
  }

  const availability = await checkStreetViewAvailability(location)
  
  if (checkOnly) {
    return NextResponse.json({
      available: availability.available,
      date: availability.date,
      panoId: availability.panoId,
    })
  }

  const imageUrl = availability.available ? getStreetViewUrl(location, apiKey) : null

  return NextResponse.json({
    available: availability.available,
    imageUrl,
    date: availability.date,
  })
}
