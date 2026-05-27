import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  validateAddress,
  geocodeAddress,
  batchGeocodeAddresses,
  normalizeAddress,
  getFallbackCoordinates
} from '@/lib/address-validator'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Geocode and validate addresses for properties
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'GOOGLE_MAPS_API_KEY not configured',
        message: 'Please add your Google Maps API key to continue'
      }, { status: 500 })
    }

    const body = await request.json()
    const { propertyId, validateOnly, updateAll, limit = 50 } = body

    const results = {
      processed: 0,
      geocoded: 0,
      failed: 0,
      updated: 0,
      validationIssues: [] as Array<{ id: string; issues: string[] }>
    }

    let properties: Array<{
      id: string
      address: string | null
      city: string
      state: string
      latitude: number | null
      longitude: number | null
    }> = []

    if (propertyId) {
      // Single property
      const { data } = await supabase
        .from('properties')
        .select('id, address, city, state, latitude, longitude')
        .eq('id', propertyId)
        .single()
      
      if (data) properties = [data]
    } else if (updateAll) {
      // Get properties needing geocoding
      const { data } = await supabase
        .from('properties')
        .select('id, address, city, state, latitude, longitude')
        .or('latitude.is.null,longitude.is.null')
        .limit(limit)
      
      properties = data || []
    }

    for (const property of properties) {
      results.processed++

      // Validate and geocode
      const validation = await validateAddress(
        property.address,
        property.city,
        property.state,
        apiKey
      )

      if (validation.issues.length > 0) {
        results.validationIssues.push({
          id: property.id,
          issues: validation.issues
        })
      }

      if (validateOnly) {
        continue
      }

      // Update with geocoding results
      let latitude = property.latitude
      let longitude = property.longitude

      if (validation.geocoding) {
        latitude = validation.geocoding.latitude
        longitude = validation.geocoding.longitude
        results.geocoded++
      } else {
        // Use fallback coordinates (state center)
        const fallback = getFallbackCoordinates(property.state)
        if (fallback) {
          // Add some randomness so properties don't stack
          latitude = fallback.lat + (Math.random() - 0.5) * 2
          longitude = fallback.lng + (Math.random() - 0.5) * 2
        }
        results.failed++
      }

      // Normalize address
      const normalized = normalizeAddress(
        property.address,
        property.city,
        property.state
      )

      // Update the property
      const { error } = await supabase
        .from('properties')
        .update({
          latitude,
          longitude,
          address: normalized.normalizedAddress.split(',')[0] || property.address,
          city: normalized.city,
          state: normalized.state,
          updated_at: new Date().toISOString()
        })
        .eq('id', property.id)

      if (!error) {
        results.updated++
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Geocoding error:', error)
    return NextResponse.json({
      error: 'Geocoding failed',
      message: errorMessage
    }, { status: 500 })
  }
}

// GET: Geocode a single address
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const city = searchParams.get('city')
  const state = searchParams.get('state')

  if (!city || !state) {
    return NextResponse.json({
      error: 'Missing parameters',
      required: ['city', 'state'],
      optional: ['address']
    }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'GOOGLE_MAPS_API_KEY not configured'
    }, { status: 500 })
  }

  try {
    const validation = await validateAddress(address, city, state, apiKey)

    return NextResponse.json({
      success: true,
      validation,
      normalized: normalizeAddress(address, city, state)
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: 'Geocoding failed',
      message: errorMessage
    }, { status: 500 })
  }
}
