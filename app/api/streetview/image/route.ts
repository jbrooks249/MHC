import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const address = searchParams.get('address')
  
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  
  if (!apiKey) {
    // Return a placeholder image if no API key
    return NextResponse.redirect(
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
      { status: 302 }
    )
  }
  
  // Build Street View URL - prefer coordinates, fall back to address
  let location = ''
  if (lat && lng) {
    location = `${lat},${lng}`
  } else if (address) {
    location = encodeURIComponent(address.replace(/\+/g, ' '))
  } else {
    return NextResponse.redirect(
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
      { status: 302 }
    )
  }
  
  const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${location}&fov=90&pitch=10&key=${apiKey}`
  
  // Check if Street View is available at this location
  const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${location}&key=${apiKey}`
  
  try {
    const metaResponse = await fetch(metadataUrl)
    const metadata = await metaResponse.json()
    
    if (metadata.status === 'OK') {
      // Street View available - redirect to the image
      return NextResponse.redirect(streetViewUrl, { status: 302 })
    } else {
      // No Street View - return region-appropriate placeholder
      return NextResponse.redirect(
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
        { status: 302 }
      )
    }
  } catch (error) {
    // On error, return placeholder
    return NextResponse.redirect(
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
      { status: 302 }
    )
  }
}
