'use client'

import { Property } from '@/lib/types'
import { PropertyCard } from './property-card'
import { Loader2 } from 'lucide-react'

interface PropertyGridProps {
  properties: Property[]
  isLoading?: boolean
}

export function PropertyGrid({ properties, isLoading }: PropertyGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading properties...</p>
        </div>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground mb-2">No properties found</p>
          <p className="text-muted-foreground">Try adjusting your search filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  )
}
