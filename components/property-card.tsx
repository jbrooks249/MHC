'use client'

import { Property } from '@/lib/types'
import { Building2, MapPin, Users, TrendingUp, DollarSign, Sparkles } from 'lucide-react'

interface PropertyCardProps {
  property: Property
  onClick?: () => void
}

function formatPrice(price: number | null): string {
  if (!price) return 'N/A'
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`
  }
  return `$${(price / 1000).toFixed(0)}K`
}

function formatPercent(value: number | null): string {
  if (value === null) return 'N/A'
  return `${value.toFixed(1)}%`
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground'
  if (score >= 90) return 'bg-score-high/20 text-score-high border border-score-high/30'
  if (score >= 75) return 'bg-score-medium/20 text-score-medium border border-score-medium/30'
  return 'bg-score-low/20 text-score-low border border-score-low/30'
}

export function PropertyCard({ property, onClick }: PropertyCardProps) {
  return (
    <div 
      className="group relative bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {/* Property Image */}
      <div className="relative h-44 bg-gradient-to-br from-secondary to-muted overflow-hidden">
        {property.image_url ? (
          <img 
            src={property.image_url} 
            alt={property.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <Building2 className="w-16 h-16 text-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
        
        {/* AI Score Badge */}
        <div className="absolute top-3 right-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getScoreColor(property.ai_score)}`}>
            <Sparkles className="w-3 h-3" />
            <span>{property.ai_score?.toFixed(0) ?? '--'}</span>
          </div>
        </div>
        
        {/* Sold Badge */}
        {property.status === 'sold' && (
          <div className="absolute top-3 left-3">
            <div className="px-2.5 py-1 bg-amber-500 text-white rounded-full text-xs font-semibold">
              SOLD
            </div>
          </div>
        )}
        
        {/* Mom & Pop Badge */}
        {property.mom_pop && property.status !== 'sold' && (
          <div className="absolute top-3 left-3">
            <div className="px-2.5 py-1 bg-accent/90 text-accent-foreground rounded-full text-xs font-semibold">
              Mom & Pop
            </div>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="mb-3">
          <h3 className="font-semibold text-foreground truncate text-balance">{property.name}</h3>
          <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{property.city}, {property.state}</span>
          </div>
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Units</p>
              <p className="font-semibold text-sm text-foreground">{property.units}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lot Rent</p>
              <p className="font-semibold text-sm text-foreground">{property.lot_rent ? `$${property.lot_rent}/mo` : 'N/A'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">TOH / POH</p>
              <p className="font-semibold text-sm text-foreground">
                {property.toh ?? 0} / {property.poh ?? 0}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vacant</p>
              <p className="font-semibold text-sm text-foreground">{property.vacant ?? 0} lots</p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            {property.status === 'sold' ? (
              <>
                <p className="text-xs text-amber-500">Sold Price</p>
                <p className="font-bold text-lg text-amber-500">{formatPrice(property.sold_price)}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Asking Price</p>
                <p className="font-bold text-lg text-foreground">{formatPrice(property.asking_price)}</p>
              </>
            )}
          </div>
          <div className="text-right">
            {property.status === 'sold' && property.price_per_pad ? (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Price/Pad</p>
                <p className="text-sm font-semibold text-foreground">${property.price_per_pad.toLocaleString()}</p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{property.source ?? 'Direct'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Hover overlay for interaction */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  )
}
