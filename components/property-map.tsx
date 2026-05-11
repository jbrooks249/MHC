'use client'

import { useEffect, useState } from 'react'
import { Property } from '@/lib/types'
import { MapPin, Sparkles, DollarSign, Users, X } from 'lucide-react'

interface PropertyMapProps {
  properties: Property[]
  onPropertySelect: (property: Property) => void
  selectedProperty?: Property | null
}

// US State coordinates for fallback when lat/lng not available
const STATE_COORDINATES: Record<string, [number, number]> = {
  'AL': [32.806671, -86.791130],
  'AK': [61.370716, -152.404419],
  'AZ': [33.729759, -111.431221],
  'AR': [34.969704, -92.373123],
  'CA': [36.116203, -119.681564],
  'CO': [39.059811, -105.311104],
  'CT': [41.597782, -72.755371],
  'DE': [39.318523, -75.507141],
  'FL': [27.766279, -81.686783],
  'GA': [33.040619, -83.643074],
  'HI': [21.094318, -157.498337],
  'ID': [44.240459, -114.478828],
  'IL': [40.349457, -88.986137],
  'IN': [39.849426, -86.258278],
  'IA': [42.011539, -93.210526],
  'KS': [38.526600, -96.726486],
  'KY': [37.668140, -84.670067],
  'LA': [31.169546, -91.867805],
  'ME': [44.693947, -69.381927],
  'MD': [39.063946, -76.802101],
  'MA': [42.230171, -71.530106],
  'MI': [43.326618, -84.536095],
  'MN': [45.694454, -93.900192],
  'MS': [32.741646, -89.678696],
  'MO': [38.456085, -92.288368],
  'MT': [46.921925, -110.454353],
  'NE': [41.125370, -98.268082],
  'NV': [38.313515, -117.055374],
  'NH': [43.452492, -71.563896],
  'NJ': [40.298904, -74.521011],
  'NM': [34.840515, -106.248482],
  'NY': [42.165726, -74.948051],
  'NC': [35.630066, -79.806419],
  'ND': [47.528912, -99.784012],
  'OH': [40.388783, -82.764915],
  'OK': [35.565342, -96.928917],
  'OR': [44.572021, -122.070938],
  'PA': [40.590752, -77.209755],
  'RI': [41.680893, -71.511780],
  'SC': [33.856892, -80.945007],
  'SD': [44.299782, -99.438828],
  'TN': [35.747845, -86.692345],
  'TX': [31.054487, -97.563461],
  'UT': [40.150032, -111.862434],
  'VT': [44.045876, -72.710686],
  'VA': [37.769337, -78.169968],
  'WA': [47.400902, -121.490494],
  'WV': [38.491226, -80.954453],
  'WI': [44.268543, -89.616508],
  'WY': [42.755966, -107.302490],
}

function formatPrice(price: number | null): string {
  if (!price) return 'N/A'
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`
  }
  return `$${(price / 1000).toFixed(0)}K`
}

function getScoreColor(score: number | null): string {
  if (score === null) return '#6b7280'
  if (score >= 90) return '#10b981'
  if (score >= 75) return '#f59e0b'
  return '#ef4444'
}

export function PropertyMap({ properties, onPropertySelect, selectedProperty }: PropertyMapProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null)

  useEffect(() => {
    // Dynamically import Leaflet to avoid SSR issues
    Promise.all([
      import('leaflet'),
      import('react-leaflet'),
      import('leaflet/dist/leaflet.css')
    ]).then(([L, ReactLeaflet]) => {
      // Fix default marker icon issue with webpack
      delete (L.default.Icon.Default.prototype as any)._getIconUrl
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const MapContainer = ReactLeaflet.MapContainer
      const TileLayer = ReactLeaflet.TileLayer
      const Marker = ReactLeaflet.Marker
      const Popup = ReactLeaflet.Popup
      const CircleMarker = ReactLeaflet.CircleMarker

      const LeafletMap = () => (
        <MapContainer
          center={[39.8283, -98.5795]}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          className="rounded-xl"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {properties.map((property) => {
            // Get coordinates from property or fallback to state center
            let lat = property.latitude
            let lng = property.longitude
            
            if (!lat || !lng) {
              const stateCoords = STATE_COORDINATES[property.state]
              if (stateCoords) {
                // Add some randomness to spread out markers in same state
                lat = stateCoords[0] + (Math.random() - 0.5) * 2
                lng = stateCoords[1] + (Math.random() - 0.5) * 2
              } else {
                return null
              }
            }

            const isSelected = selectedProperty?.id === property.id
            const isHovered = hoveredProperty?.id === property.id

            return (
              <CircleMarker
                key={property.id}
                center={[lat, lng]}
                radius={isSelected || isHovered ? 12 : 8}
                pathOptions={{
                  fillColor: getScoreColor(property.ai_score),
                  fillOpacity: isSelected || isHovered ? 1 : 0.8,
                  color: isSelected ? '#fff' : 'transparent',
                  weight: isSelected ? 3 : 0,
                }}
                eventHandlers={{
                  click: () => onPropertySelect(property),
                  mouseover: () => setHoveredProperty(property),
                  mouseout: () => setHoveredProperty(null),
                }}
              >
                <Popup>
                  <div className="min-w-[200px] p-2">
                    <h4 className="font-semibold text-sm mb-1">{property.name}</h4>
                    <p className="text-xs text-gray-600 mb-2">{property.city}, {property.state}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Price:</span>
                        <span className="font-medium ml-1">{formatPrice(property.asking_price)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Units:</span>
                        <span className="font-medium ml-1">{property.units}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">AI Score:</span>
                        <span className="font-medium ml-1" style={{ color: getScoreColor(property.ai_score) }}>
                          {property.ai_score?.toFixed(0) ?? 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cap Rate:</span>
                        <span className="font-medium ml-1">{property.cap_rate?.toFixed(1)}%</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onPropertySelect(property)}
                      className="mt-2 w-full text-xs bg-blue-600 text-white py-1 px-2 rounded hover:bg-blue-700"
                    >
                      View Details
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      )

      setMapComponent(() => LeafletMap)
      setIsLoading(false)
    }).catch(err => {
      console.error('Failed to load map:', err)
      setIsLoading(false)
    })
  }, [properties, onPropertySelect, selectedProperty, hoveredProperty])

  if (isLoading) {
    return (
      <div className="h-full w-full bg-secondary rounded-xl flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-pulse" />
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    )
  }

  if (!MapComponent) {
    return (
      <div className="h-full w-full bg-secondary rounded-xl flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Map unavailable</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      <MapComponent />
      
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 border border-border shadow-lg z-[1000]">
        <p className="text-xs font-semibold text-foreground mb-2">AI Score</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-score-high" />
            <span className="text-xs text-muted-foreground">Hot Deal (90+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-score-medium" />
            <span className="text-xs text-muted-foreground">Good (75-89)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-score-low" />
            <span className="text-xs text-muted-foreground">Review (&lt;75)</span>
          </div>
        </div>
      </div>

      {/* Property count */}
      <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg z-[1000]">
        <p className="text-sm font-medium text-foreground">{properties.length} Properties</p>
      </div>
    </div>
  )
}
