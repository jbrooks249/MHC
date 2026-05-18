// Address Validation, Normalization, and Geocoding Service
// Ensures accurate addresses with verified coordinates

export interface NormalizedAddress {
  streetNumber: string | null
  streetName: string | null
  streetType: string | null
  unit: string | null
  city: string
  state: string
  zipCode: string | null
  fullAddress: string
  normalizedAddress: string
  confidence: number
}

export interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress: string
  confidence: number
  source: 'google' | 'cache' | 'fallback'
  placeId?: string
  components: {
    streetNumber?: string
    route?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
  }
}

export interface AddressValidationResult {
  isValid: boolean
  original: string
  normalized: NormalizedAddress | null
  geocoding: GeocodingResult | null
  issues: string[]
  suggestions: string[]
}

// Common street type abbreviations
const STREET_TYPES: Record<string, string> = {
  'STREET': 'ST', 'ST': 'ST',
  'AVENUE': 'AVE', 'AVE': 'AVE', 'AV': 'AVE',
  'BOULEVARD': 'BLVD', 'BLVD': 'BLVD',
  'DRIVE': 'DR', 'DR': 'DR',
  'ROAD': 'RD', 'RD': 'RD',
  'LANE': 'LN', 'LN': 'LN',
  'COURT': 'CT', 'CT': 'CT',
  'CIRCLE': 'CIR', 'CIR': 'CIR',
  'PLACE': 'PL', 'PL': 'PL',
  'WAY': 'WAY',
  'HIGHWAY': 'HWY', 'HWY': 'HWY',
  'PARKWAY': 'PKWY', 'PKWY': 'PKWY',
  'TRAIL': 'TRL', 'TRL': 'TRL',
  'TERRACE': 'TER', 'TER': 'TER',
  'LOOP': 'LOOP',
  'PATH': 'PATH',
  'PIKE': 'PIKE',
  'SQUARE': 'SQ', 'SQ': 'SQ',
  'EXPRESSWAY': 'EXPY', 'EXPY': 'EXPY',
  'FREEWAY': 'FWY', 'FWY': 'FWY'
}

// Directional prefixes/suffixes
const DIRECTIONS: Record<string, string> = {
  'NORTH': 'N', 'N': 'N',
  'SOUTH': 'S', 'S': 'S',
  'EAST': 'E', 'E': 'E',
  'WEST': 'W', 'W': 'W',
  'NORTHEAST': 'NE', 'NE': 'NE',
  'NORTHWEST': 'NW', 'NW': 'NW',
  'SOUTHEAST': 'SE', 'SE': 'SE',
  'SOUTHWEST': 'SW', 'SW': 'SW'
}

// Unit type abbreviations
const UNIT_TYPES: Record<string, string> = {
  'APARTMENT': 'APT', 'APT': 'APT',
  'SUITE': 'STE', 'STE': 'STE',
  'UNIT': 'UNIT',
  'BUILDING': 'BLDG', 'BLDG': 'BLDG',
  'FLOOR': 'FL', 'FL': 'FL',
  'ROOM': 'RM', 'RM': 'RM',
  'SPACE': 'SPC', 'SPC': 'SPC',
  'LOT': 'LOT',
  '#': '#'
}

// State name to abbreviation
const STATE_ABBREVIATIONS: Record<string, string> = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
  'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
  'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
  'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
  'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
  'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
  'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
  'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC', 'DC': 'DC'
}

// Parse raw address string into components
export function parseAddress(rawAddress: string): Partial<NormalizedAddress> {
  const cleaned = rawAddress.trim().replace(/\s+/g, ' ')
  const parts: Partial<NormalizedAddress> = {
    fullAddress: cleaned
  }

  // Try to extract ZIP code
  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\b/)
  if (zipMatch) {
    parts.zipCode = zipMatch[1]
  }

  // Try to extract state
  const stateMatch = cleaned.match(/,\s*([A-Za-z]{2})\s*(?:\d{5})?$/i) ||
    cleaned.match(/,\s*([A-Za-z\s]+)\s*(?:\d{5})?$/i)
  if (stateMatch) {
    const stateStr = stateMatch[1].trim().toUpperCase()
    parts.state = STATE_ABBREVIATIONS[stateStr] || stateStr
  }

  // Try to extract city (between last comma and state)
  const cityStateMatch = cleaned.match(/,\s*([^,]+)\s*,\s*[A-Za-z]{2}/i)
  if (cityStateMatch) {
    parts.city = cityStateMatch[1].trim()
  }

  // Try to extract street number
  const streetNumMatch = cleaned.match(/^(\d+[-\d]*)\s+/)
  if (streetNumMatch) {
    parts.streetNumber = streetNumMatch[1]
  }

  // Try to extract unit number
  const unitMatch = cleaned.match(/(?:apt|suite|ste|unit|#|bldg|building|fl|floor|rm|room|spc|space|lot)\s*#?\s*([a-z0-9-]+)/i)
  if (unitMatch) {
    parts.unit = unitMatch[1].toUpperCase()
  }

  return parts
}

// Normalize an address to standard format
export function normalizeAddress(
  address: string | null,
  city: string,
  state: string,
  zipCode?: string | null
): NormalizedAddress {
  // Parse the input
  const parsed = address ? parseAddress(address) : {}

  // Normalize state
  const normalizedState = STATE_ABBREVIATIONS[state.toUpperCase()] || state.toUpperCase()

  // Normalize city
  const normalizedCity = city.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  // Normalize street address if available
  let normalizedStreet = ''
  let confidence = 0.5

  if (address) {
    normalizedStreet = address.trim()

    // Standardize street types
    for (const [full, abbr] of Object.entries(STREET_TYPES)) {
      const regex = new RegExp(`\\b${full}\\b\\.?`, 'gi')
      normalizedStreet = normalizedStreet.replace(regex, abbr)
    }

    // Standardize directions
    for (const [full, abbr] of Object.entries(DIRECTIONS)) {
      const regex = new RegExp(`\\b${full}\\b\\.?`, 'gi')
      normalizedStreet = normalizedStreet.replace(regex, abbr)
    }

    // Remove extra punctuation
    normalizedStreet = normalizedStreet
      .replace(/[.,]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    confidence = 0.7
  }

  // Build full normalized address
  const parts = [normalizedStreet, normalizedCity, normalizedState]
  if (zipCode || parsed.zipCode) {
    parts.push(zipCode || parsed.zipCode || '')
  }
  const normalizedAddress = parts.filter(Boolean).join(', ')

  // Calculate confidence based on completeness
  if (normalizedStreet && normalizedCity && normalizedState) {
    confidence = 0.8
    if (zipCode || parsed.zipCode) {
      confidence = 0.9
    }
  }

  return {
    streetNumber: parsed.streetNumber || null,
    streetName: null, // Would need more sophisticated parsing
    streetType: null,
    unit: parsed.unit || null,
    city: normalizedCity,
    state: normalizedState,
    zipCode: zipCode || parsed.zipCode || null,
    fullAddress: address ? `${address}, ${city}, ${state}` : `${city}, ${state}`,
    normalizedAddress,
    confidence
  }
}

// Geocode an address using Google Geocoding API
export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  apiKey: string
): Promise<GeocodingResult | null> {
  const fullAddress = `${address}, ${city}, ${state}, USA`
  const encodedAddress = encodeURIComponent(fullAddress)
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&components=country:US`
    )
    
    if (!response.ok) {
      console.error('Geocoding API error:', response.status)
      return null
    }

    const data = await response.json()

    if (data.status !== 'OK' || !data.results?.[0]) {
      console.error('Geocoding failed:', data.status)
      return null
    }

    const result = data.results[0]
    const location = result.geometry.location

    // Extract address components
    const components: GeocodingResult['components'] = {}
    for (const component of result.address_components || []) {
      if (component.types.includes('street_number')) {
        components.streetNumber = component.long_name
      } else if (component.types.includes('route')) {
        components.route = component.long_name
      } else if (component.types.includes('locality')) {
        components.city = component.long_name
      } else if (component.types.includes('administrative_area_level_1')) {
        components.state = component.short_name
      } else if (component.types.includes('country')) {
        components.country = component.short_name
      } else if (component.types.includes('postal_code')) {
        components.postalCode = component.long_name
      }
    }

    // Calculate confidence based on match type
    let confidence = 0.5
    const locationType = result.geometry.location_type
    if (locationType === 'ROOFTOP') {
      confidence = 0.95
    } else if (locationType === 'RANGE_INTERPOLATED') {
      confidence = 0.8
    } else if (locationType === 'GEOMETRIC_CENTER') {
      confidence = 0.7
    } else if (locationType === 'APPROXIMATE') {
      confidence = 0.5
    }

    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
      confidence,
      source: 'google',
      placeId: result.place_id,
      components
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

// Validate address by geocoding and comparing
export async function validateAddress(
  address: string | null,
  city: string,
  state: string,
  apiKey: string
): Promise<AddressValidationResult> {
  const issues: string[] = []
  const suggestions: string[] = []

  // Normalize the address first
  const normalized = normalizeAddress(address, city, state)

  // Validate state
  if (!STATE_ABBREVIATIONS[state.toUpperCase()] && state.length !== 2) {
    issues.push(`Invalid state: ${state}`)
    return {
      isValid: false,
      original: address || `${city}, ${state}`,
      normalized: null,
      geocoding: null,
      issues,
      suggestions: ['Use standard 2-letter state abbreviation']
    }
  }

  // Validate city (basic check)
  if (!city || city.length < 2) {
    issues.push('Missing or invalid city')
    return {
      isValid: false,
      original: address || `${city}, ${state}`,
      normalized: null,
      geocoding: null,
      issues,
      suggestions: ['Provide a valid city name']
    }
  }

  // Try geocoding
  let geocoding: GeocodingResult | null = null
  
  if (address) {
    geocoding = await geocodeAddress(address, city, state, apiKey)
    
    if (!geocoding) {
      issues.push('Could not geocode address')
      suggestions.push('Verify the address is correct and complete')
    } else {
      // Check if geocoded location matches input
      if (geocoding.components.state && 
          geocoding.components.state.toUpperCase() !== normalized.state) {
        issues.push(`Geocoded state (${geocoding.components.state}) does not match input (${normalized.state})`)
      }
      
      if (geocoding.components.city && 
          geocoding.components.city.toLowerCase() !== normalized.city.toLowerCase()) {
        suggestions.push(`Geocoded city is "${geocoding.components.city}" - verify this matches your intent`)
      }

      if (geocoding.confidence < 0.7) {
        issues.push(`Low geocoding confidence: ${Math.round(geocoding.confidence * 100)}%`)
        suggestions.push('Consider verifying the address manually')
      }
    }
  } else {
    // No street address, try to geocode just city/state
    const cityGeocode = await geocodeAddress('', city, state, apiKey)
    if (cityGeocode) {
      geocoding = {
        ...cityGeocode,
        confidence: cityGeocode.confidence * 0.5 // Lower confidence for city-only
      }
    }
    suggestions.push('Adding a street address would improve location accuracy')
  }

  return {
    isValid: issues.length === 0,
    original: address || `${city}, ${state}`,
    normalized,
    geocoding,
    issues,
    suggestions
  }
}

// Batch geocode multiple addresses with rate limiting
export async function batchGeocodeAddresses(
  addresses: Array<{ address: string | null; city: string; state: string; id: string }>,
  apiKey: string,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, GeocodingResult | null>> {
  const results = new Map<string, GeocodingResult | null>()
  const delayMs = 100 // Google allows 50 requests per second

  for (let i = 0; i < addresses.length; i++) {
    const item = addresses[i]
    
    if (item.address) {
      const result = await geocodeAddress(item.address, item.city, item.state, apiKey)
      results.set(item.id, result)
    } else {
      results.set(item.id, null)
    }

    if (onProgress) {
      onProgress(i + 1, addresses.length)
    }

    // Rate limiting
    if (i < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// Generate address fingerprint for deduplication
export function generateAddressFingerprint(
  address: string | null,
  city: string,
  state: string
): string {
  const normalized = normalizeAddress(address, city, state)
  
  // Create fingerprint from normalized components
  const parts = [
    (normalized.streetNumber || '').replace(/\D/g, ''),
    (normalized.normalizedAddress || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
    normalized.city.toLowerCase().replace(/[^a-z]/g, ''),
    normalized.state.toUpperCase()
  ]
  
  return parts.filter(Boolean).join('|')
}

// Check if two addresses likely refer to the same location
export function addressesMatch(
  addr1: { address: string | null; city: string; state: string },
  addr2: { address: string | null; city: string; state: string },
  threshold = 0.8
): boolean {
  // Must be same state
  const state1 = STATE_ABBREVIATIONS[addr1.state.toUpperCase()] || addr1.state.toUpperCase()
  const state2 = STATE_ABBREVIATIONS[addr2.state.toUpperCase()] || addr2.state.toUpperCase()
  
  if (state1 !== state2) return false

  // Normalize cities and compare
  const city1 = addr1.city.toLowerCase().replace(/[^a-z]/g, '')
  const city2 = addr2.city.toLowerCase().replace(/[^a-z]/g, '')
  
  if (city1 !== city2) {
    // Check if one is a substring of the other (e.g., "St. Louis" vs "Saint Louis")
    if (!city1.includes(city2) && !city2.includes(city1)) {
      return false
    }
  }

  // If both have street addresses, compare them
  if (addr1.address && addr2.address) {
    const normalized1 = normalizeAddress(addr1.address, addr1.city, addr1.state)
    const normalized2 = normalizeAddress(addr2.address, addr2.city, addr2.state)
    
    // Extract street numbers
    const num1 = normalized1.streetNumber || ''
    const num2 = normalized2.streetNumber || ''
    
    // If numbers exist and don't match, addresses are different
    if (num1 && num2 && num1 !== num2) {
      return false
    }

    // Compare normalized street names
    const street1 = normalized1.normalizedAddress.toLowerCase().replace(/[^a-z0-9]/g, '')
    const street2 = normalized2.normalizedAddress.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    // Calculate Jaccard similarity on words
    const words1 = new Set(street1.split(/(?=[A-Z])|\d+/).filter(w => w.length > 1))
    const words2 = new Set(street2.split(/(?=[A-Z])|\d+/).filter(w => w.length > 1))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    const similarity = union.size > 0 ? intersection.size / union.size : 0
    
    return similarity >= threshold
  }

  // If only one has an address, we can't definitively say they're the same
  // but they're in the same city/state
  return !addr1.address && !addr2.address
}

// State center coordinates for fallback geocoding
export const STATE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'AL': { lat: 32.806671, lng: -86.791130 },
  'AK': { lat: 61.370716, lng: -152.404419 },
  'AZ': { lat: 33.729759, lng: -111.431221 },
  'AR': { lat: 34.969704, lng: -92.373123 },
  'CA': { lat: 36.116203, lng: -119.681564 },
  'CO': { lat: 39.059811, lng: -105.311104 },
  'CT': { lat: 41.597782, lng: -72.755371 },
  'DE': { lat: 39.318523, lng: -75.507141 },
  'FL': { lat: 27.766279, lng: -81.686783 },
  'GA': { lat: 33.040619, lng: -83.643074 },
  'HI': { lat: 21.094318, lng: -157.498337 },
  'ID': { lat: 44.240459, lng: -114.478828 },
  'IL': { lat: 40.349457, lng: -88.986137 },
  'IN': { lat: 39.849426, lng: -86.258278 },
  'IA': { lat: 42.011539, lng: -93.210526 },
  'KS': { lat: 38.526600, lng: -96.726486 },
  'KY': { lat: 37.668140, lng: -84.670067 },
  'LA': { lat: 31.169546, lng: -91.867805 },
  'ME': { lat: 44.693947, lng: -69.381927 },
  'MD': { lat: 39.063946, lng: -76.802101 },
  'MA': { lat: 42.230171, lng: -71.530106 },
  'MI': { lat: 43.326618, lng: -84.536095 },
  'MN': { lat: 45.694454, lng: -93.900192 },
  'MS': { lat: 32.741646, lng: -89.678696 },
  'MO': { lat: 38.456085, lng: -92.288368 },
  'MT': { lat: 46.921925, lng: -110.454353 },
  'NE': { lat: 41.125370, lng: -98.268082 },
  'NV': { lat: 38.313515, lng: -117.055374 },
  'NH': { lat: 43.452492, lng: -71.563896 },
  'NJ': { lat: 40.298904, lng: -74.521011 },
  'NM': { lat: 34.840515, lng: -106.248482 },
  'NY': { lat: 42.165726, lng: -74.948051 },
  'NC': { lat: 35.630066, lng: -79.806419 },
  'ND': { lat: 47.528912, lng: -99.784012 },
  'OH': { lat: 40.388783, lng: -82.764915 },
  'OK': { lat: 35.565342, lng: -96.928917 },
  'OR': { lat: 44.572021, lng: -122.070938 },
  'PA': { lat: 40.590752, lng: -77.209755 },
  'RI': { lat: 41.680893, lng: -71.511780 },
  'SC': { lat: 33.856892, lng: -80.945007 },
  'SD': { lat: 44.299782, lng: -99.438828 },
  'TN': { lat: 35.747845, lng: -86.692345 },
  'TX': { lat: 31.054487, lng: -97.563461 },
  'UT': { lat: 40.150032, lng: -111.862434 },
  'VT': { lat: 44.045876, lng: -72.710686 },
  'VA': { lat: 37.769337, lng: -78.169968 },
  'WA': { lat: 47.400902, lng: -121.490494 },
  'WV': { lat: 38.491226, lng: -80.954453 },
  'WI': { lat: 44.268543, lng: -89.616508 },
  'WY': { lat: 42.755966, lng: -107.302490 }
}

// Get fallback coordinates for a state
export function getFallbackCoordinates(state: string): { lat: number; lng: number } | null {
  const stateAbbr = STATE_ABBREVIATIONS[state.toUpperCase()] || state.toUpperCase()
  return STATE_COORDINATES[stateAbbr] || null
}
