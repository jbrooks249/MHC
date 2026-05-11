import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate Google Street View URL for a location
function getStreetViewUrl(address: string, city: string, state: string): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return ''
  
  const location = encodeURIComponent(`${address}, ${city}, ${state}, USA`)
  return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${location}&key=${apiKey}&source=outdoor`
}

// Check if Street View is available for a location
async function checkStreetViewAvailability(address: string, city: string, state: string): Promise<boolean> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return false
  
  try {
    const location = encodeURIComponent(`${address}, ${city}, ${state}, USA`)
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${location}&key=${apiKey}`
    
    const response = await fetch(metadataUrl)
    const data = await response.json()
    
    return data.status === 'OK'
  } catch {
    return false
  }
}

// POST: Update properties with Street View images
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
    const { propertyId, updateAll } = body

    let properties: any[] = []

    if (propertyId) {
      // Update single property
      const { data } = await supabase
        .from('properties')
        .select('id, address, city, state')
        .eq('id', propertyId)
        .single()
      
      if (data) properties = [data]
    } else if (updateAll) {
      // Update all properties without proper images
      const { data } = await supabase
        .from('properties')
        .select('id, address, city, state, image_url')
        .or('image_url.is.null,image_url.like.%unsplash%')
        .limit(100) // Limit to avoid API quota issues
      
      properties = data || []
    }

    let updated = 0
    let failed = 0

    for (const property of properties) {
      if (!property.address || !property.city || !property.state) {
        failed++
        continue
      }

      // Check availability first to avoid wasting quota
      const isAvailable = await checkStreetViewAvailability(
        property.address, 
        property.city, 
        property.state
      )

      if (isAvailable) {
        const imageUrl = getStreetViewUrl(property.address, property.city, property.state)
        
        const { error } = await supabase
          .from('properties')
          .update({ image_url: imageUrl })
          .eq('id', property.id)

        if (error) {
          failed++
        } else {
          updated++
        }
      } else {
        failed++
      }

      // Rate limiting - Google allows 100 requests per second
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return NextResponse.json({
      success: true,
      updated,
      failed,
      total: properties.length
    })

  } catch (error: any) {
    console.error('Street View update error:', error)
    return NextResponse.json({ 
      error: 'Update failed', 
      message: error.message 
    }, { status: 500 })
  }
}

// GET: Generate Street View URL for a single address
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const city = searchParams.get('city')
  const state = searchParams.get('state')

  if (!address || !city || !state) {
    return NextResponse.json({ 
      error: 'Missing parameters',
      required: ['address', 'city', 'state']
    }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'GOOGLE_MAPS_API_KEY not configured'
    }, { status: 500 })
  }

  const isAvailable = await checkStreetViewAvailability(address, city, state)
  const imageUrl = isAvailable ? getStreetViewUrl(address, city, state) : null

  return NextResponse.json({
    available: isAvailable,
    imageUrl
  })
}
