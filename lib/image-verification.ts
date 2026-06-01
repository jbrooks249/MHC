// Image Verification Service
// Ensures property images are accurate and match their addresses

export interface ImageVerificationResult {
  propertyId: string
  imageUrl: string | null
  status: 'verified' | 'updated' | 'fallback' | 'error'
  source: 'street_view' | 'satellite' | 'hybrid' | 'listing' | 'placeholder'
  confidence: number // 0-100
  metadata: {
    streetViewAvailable: boolean
    imageDate?: string
    panoId?: string
    coordinates?: { lat: number; lng: number }
    addressMatch?: number // How well address matches image location
  }
  issues: string[]
}

export interface VerificationStats {
  total: number
  streetView: number
  satellite: number
  placeholder: number
  verified: number
  needsReview: number
  averageConfidence: number
}

// Check if a Google Maps API image URL is valid and returns actual imagery
export async function verifyGoogleStreetView(
  address: string | null,
  city: string,
  state: string,
  apiKey: string
): Promise<{
  available: boolean
  metadata: {
    date?: string
    panoId?: string
    location?: { lat: number; lng: number }
  } | null
}> {
  if (!address) {
    return { available: false, metadata: null }
  }

  const location = encodeURIComponent(`${address}, ${city}, ${state}, USA`)
  const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${location}&key=${apiKey}`

  try {
    const response = await fetch(metadataUrl)
    const data = await response.json()

    if (data.status === 'OK') {
      return {
        available: true,
        metadata: {
          date: data.date,
          panoId: data.pano_id,
          location: data.location
        }
      }
    }

    return { available: false, metadata: null }
  } catch (error) {
    console.error('Street View verification failed:', error)
    return { available: false, metadata: null }
  }
}

// Generate the best available image URL for a property
export function generateImageUrl(
  address: string | null,
  city: string,
  state: string,
  apiKey: string,
  options: {
    preferredSource?: 'street_view' | 'satellite' | 'hybrid'
    streetViewAvailable?: boolean
    coordinates?: { lat: number; lng: number }
  } = {}
): { url: string; source: 'street_view' | 'satellite' | 'hybrid' | 'placeholder' } {
  const { preferredSource = 'street_view', streetViewAvailable = true, coordinates } = options

  // If Street View is available and preferred
  if (address && streetViewAvailable && preferredSource === 'street_view') {
    const location = encodeURIComponent(`${address}, ${city}, ${state}, USA`)
    return {
      url: `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${location}&heading=0&pitch=0&fov=90&source=outdoor&key=${apiKey}`,
      source: 'street_view'
    }
  }

  // Use coordinates if available
  if (coordinates) {
    const mapType = preferredSource === 'hybrid' ? 'hybrid' : 'satellite'
    return {
      url: `https://maps.googleapis.com/maps/api/staticmap?center=${coordinates.lat},${coordinates.lng}&zoom=18&size=800x600&maptype=${mapType}&key=${apiKey}`,
      source: mapType as 'satellite' | 'hybrid'
    }
  }

  // Fallback to city-based satellite view
  if (address) {
    const location = encodeURIComponent(`${address}, ${city}, ${state}, USA`)
    return {
      url: `https://maps.googleapis.com/maps/api/staticmap?center=${location}&zoom=17&size=800x600&maptype=hybrid&markers=color:red%7C${location}&key=${apiKey}`,
      source: 'hybrid'
    }
  }

  // Last resort: city-level satellite
  const cityLocation = encodeURIComponent(`${city}, ${state}, USA`)
  return {
    url: `https://maps.googleapis.com/maps/api/staticmap?center=${cityLocation}&zoom=13&size=800x600&maptype=satellite&key=${apiKey}`,
    source: 'satellite'
  }
}

// Verify that an image URL corresponds to the correct location
export async function verifyImageMatchesAddress(
  imageUrl: string | null,
  address: string | null,
  city: string,
  state: string,
  coordinates: { lat: number; lng: number } | null,
  apiKey: string
): Promise<{
  matches: boolean
  confidence: number
  issues: string[]
}> {
  const issues: string[] = []

  if (!imageUrl) {
    return { matches: false, confidence: 0, issues: ['No image URL provided'] }
  }

  // Check if it's a Google Maps URL
  if (imageUrl.includes('maps.googleapis.com')) {
    // Extract location from URL
    const locationMatch = imageUrl.match(/location=([^&]+)/)
    const centerMatch = imageUrl.match(/center=([^&]+)/)

    const urlLocation = locationMatch?.[1] || centerMatch?.[1]
    if (urlLocation) {
      const decodedLocation = decodeURIComponent(urlLocation)

      // Check if the URL location matches the property address
      if (address && decodedLocation.toLowerCase().includes(address.toLowerCase().substring(0, 15))) {
        return { matches: true, confidence: 95, issues: [] }
      }

      if (decodedLocation.toLowerCase().includes(city.toLowerCase())) {
        return { matches: true, confidence: 75, issues: ['Image is city-level, not address-specific'] }
      }

      if (decodedLocation.toLowerCase().includes(state.toLowerCase())) {
        issues.push('Image may be from wrong location in state')
        return { matches: false, confidence: 30, issues }
      }
    }

    // If coordinates-based URL, check if coordinates match
    const coordMatch = urlLocation?.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/)
    if (coordMatch && coordinates) {
      const urlLat = parseFloat(coordMatch[1])
      const urlLng = parseFloat(coordMatch[2])
      const distance = Math.sqrt(
        Math.pow(urlLat - coordinates.lat, 2) + Math.pow(urlLng - coordinates.lng, 2)
      )

      if (distance < 0.01) {
        return { matches: true, confidence: 90, issues: [] }
      } else if (distance < 0.1) {
        return { matches: true, confidence: 60, issues: ['Image coordinates are approximate'] }
      }
    }
  }

  // For external images, we can't verify easily
  if (imageUrl.includes('unsplash') || imageUrl.includes('placeholder')) {
    return { matches: false, confidence: 0, issues: ['Placeholder image - not property specific'] }
  }

  // For listing-source images, assume they're correct but with medium confidence
  return { matches: true, confidence: 50, issues: ['External image - cannot verify location'] }
}

// Main verification function for a single property
export async function verifyPropertyImage(
  property: {
    id: string
    address: string | null
    city: string
    state: string
    latitude: number | null
    longitude: number | null
    image_url: string | null
  },
  apiKey: string
): Promise<ImageVerificationResult> {
  const issues: string[] = []

  // 1. Check if current image exists and matches
  const currentMatch = await verifyImageMatchesAddress(
    property.image_url,
    property.address,
    property.city,
    property.state,
    property.latitude && property.longitude
      ? { lat: property.latitude, lng: property.longitude }
      : null,
    apiKey
  )

  // If current image is good enough, return it
  if (currentMatch.matches && currentMatch.confidence >= 75) {
    const source = property.image_url?.includes('streetview')
      ? 'street_view'
      : property.image_url?.includes('staticmap')
        ? 'satellite'
        : 'listing'

    return {
      propertyId: property.id,
      imageUrl: property.image_url,
      status: 'verified',
      source: source as ImageVerificationResult['source'],
      confidence: currentMatch.confidence,
      metadata: {
        streetViewAvailable: source === 'street_view',
        coordinates: property.latitude && property.longitude
          ? { lat: property.latitude, lng: property.longitude }
          : undefined,
        addressMatch: currentMatch.confidence
      },
      issues: currentMatch.issues
    }
  }

  // 2. Try to get a better image
  issues.push(...currentMatch.issues)

  // Check Street View availability
  const streetViewCheck = await verifyGoogleStreetView(
    property.address,
    property.city,
    property.state,
    apiKey
  )

  // Generate new image
  const newImage = generateImageUrl(
    property.address,
    property.city,
    property.state,
    apiKey,
    {
      preferredSource: streetViewCheck.available ? 'street_view' : 'hybrid',
      streetViewAvailable: streetViewCheck.available,
      coordinates: property.latitude && property.longitude
        ? { lat: property.latitude, lng: property.longitude }
        : streetViewCheck.metadata?.location
    }
  )

  const confidence = streetViewCheck.available
    ? 90
    : newImage.source === 'hybrid' && property.latitude
      ? 70
      : 40

  return {
    propertyId: property.id,
    imageUrl: newImage.url,
    status: currentMatch.matches ? 'verified' : 'updated',
    source: newImage.source === 'street_view' ? 'street_view' : newImage.source,
    confidence,
    metadata: {
      streetViewAvailable: streetViewCheck.available,
      imageDate: streetViewCheck.metadata?.date,
      panoId: streetViewCheck.metadata?.panoId,
      coordinates: streetViewCheck.metadata?.location || (property.latitude && property.longitude
        ? { lat: property.latitude, lng: property.longitude }
        : undefined),
      addressMatch: confidence
    },
    issues
  }
}

// Calculate verification statistics
export function calculateVerificationStats(results: ImageVerificationResult[]): VerificationStats {
  const stats: VerificationStats = {
    total: results.length,
    streetView: 0,
    satellite: 0,
    placeholder: 0,
    verified: 0,
    needsReview: 0,
    averageConfidence: 0
  }

  let totalConfidence = 0

  for (const result of results) {
    totalConfidence += result.confidence

    if (result.source === 'street_view') stats.streetView++
    else if (result.source === 'satellite' || result.source === 'hybrid') stats.satellite++
    else if (result.source === 'placeholder') stats.placeholder++

    if (result.status === 'verified' && result.confidence >= 75) {
      stats.verified++
    } else if (result.confidence < 50) {
      stats.needsReview++
    }
  }

  stats.averageConfidence = results.length > 0
    ? Math.round(totalConfidence / results.length)
    : 0

  return stats
}
