'use client'

import { Property } from '@/lib/types'
import { 
  X, MapPin, Users, TrendingUp, DollarSign, Sparkles, Building2, 
  Home, Mail, ExternalLink, FileText, Pencil, Loader2, Wand2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { SimpleMarkdown } from './simple-markdown'

interface PropertyDetailModalProps {
  property: Property | null
  onClose: () => void
  onEdit?: (property: Property) => void
}

function formatPrice(price: number | null): string {
  if (!price) return 'N/A'
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`
  }
  return `$${(price / 1000).toFixed(0)}K`
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return value.toLocaleString()
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

function getScoreLabel(score: number | null): string {
  if (score === null) return 'No Score'
  if (score >= 90) return 'Hot Deal'
  if (score >= 75) return 'Good Opportunity'
  return 'Needs Review'
}

export function PropertyDetailModal({ property, onClose, onEdit }: PropertyDetailModalProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // Reset summary whenever a different property is opened
  useEffect(() => {
    setSummary(null)
    setSummaryError(null)
    setSummaryLoading(false)
  }, [property?.id])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleGenerateSummary() {
    if (!property) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate summary')
      setSummary(data.summary)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSummaryLoading(false)
    }
  }

  if (!property) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>

        {/* Edit button */}
        {onEdit && (
          <button
            onClick={() => onEdit(property)}
            className="absolute top-4 right-16 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            <span className="text-sm font-medium">Edit</span>
          </button>
        )}

        {/* Header with Image */}
        <div className="relative h-56 bg-gradient-to-br from-primary/20 via-secondary to-muted overflow-hidden">
          {property.image_url ? (
            <img 
              src={property.image_url} 
              alt={property.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <Building2 className="w-24 h-24 text-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          
          {/* Sold Badge */}
          {property.status === 'sold' && (
            <div className="absolute top-4 right-16 mr-2">
              <div className="px-4 py-2 bg-amber-500 text-white rounded-full text-sm font-bold shadow-lg">
                SOLD
              </div>
            </div>
          )}
          
          {/* AI Score Badge */}
          <div className="absolute top-4 left-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${getScoreColor(property.ai_score)}`}>
              <Sparkles className="w-4 h-4" />
              <span>AI Score: {property.ai_score?.toFixed(0) ?? '--'}</span>
              <span className="text-xs opacity-75">({getScoreLabel(property.ai_score)})</span>
            </div>
          </div>
          
          {/* Mom & Pop Badge */}
          {property.mom_pop && (
            <div className="absolute top-4 left-4 mt-12">
              <div className="px-3 py-1.5 bg-accent text-accent-foreground rounded-full text-sm font-semibold">
                Mom & Pop Owned
              </div>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">{property.name}</h2>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{property.address ? `${property.address}, ` : ''}{property.city}, {property.state}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Sold Transaction Data (if sold) */}
          {property.status === 'sold' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-2">
              <h3 className="font-semibold text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Transaction Details - Competitive Analysis
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Sale Price</p>
                  <p className="font-bold text-xl text-amber-600 dark:text-amber-400">{formatPrice(property.sold_price)}</p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Price Per Pad</p>
                  <p className="font-bold text-xl text-amber-600 dark:text-amber-400">
                    ${property.price_per_pad?.toLocaleString() ?? 'N/A'}
                  </p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Sale Date</p>
                  <p className="font-bold text-lg text-amber-600 dark:text-amber-400">
                    {property.sold_date ? new Date(property.sold_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Buyer</p>
                  <p className="font-semibold text-sm text-amber-600 dark:text-amber-400 truncate">
                    {property.buyer ?? 'Undisclosed'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard 
              icon={<DollarSign className="w-5 h-5" />}
              label={property.status === 'sold' ? "Sale Price" : "Asking Price"}
              value={property.status === 'sold' ? formatPrice(property.sold_price) : formatPrice(property.asking_price)}
              highlight
              isSold={property.status === 'sold'}
            />
            <MetricCard 
              icon={<Users className="w-5 h-5" />}
              label="Total Units"
              value={formatNumber(property.units)}
            />
            <MetricCard 
              icon={<TrendingUp className="w-5 h-5" />}
              label="Cap Rate"
              value={formatPercent(property.cap_rate)}
            />
            <MetricCard 
              icon={<Building2 className="w-5 h-5" />}
              label={property.status === 'sold' ? "Price/Pad" : "Occupancy"}
              value={property.status === 'sold' 
                ? (property.price_per_pad ? `$${property.price_per_pad.toLocaleString()}` : 'N/A')
                : formatPercent(property.occupancy)}
            />
          </div>

          {/* AI Deal Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Deal Summary
              </h3>
              {!summary && (
                <button
                  onClick={handleGenerateSummary}
                  disabled={summaryLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {summaryLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              )}
            </div>

            {!summary && !summaryLoading && !summaryError && (
              <p className="text-sm text-muted-foreground">
                Generate an AI-written investment summary with strengths, risks, and a recommendation.
              </p>
            )}

            {summaryLoading && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ChatGPT is analyzing this deal...
              </p>
            )}

            {summaryError && (
              <p className="text-sm text-destructive">{summaryError}</p>
            )}

            {summary && (
              <div className="mt-2">
                <SimpleMarkdown content={summary} />
                <button
                  onClick={handleGenerateSummary}
                  disabled={summaryLoading}
                  className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Wand2 className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
            )}
          </div>

          {/* Financial Details */}
          <div className="bg-secondary/50 rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Financial Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailItem label="NOI" value={formatPrice(property.noi)} />
              <DetailItem label="Price per Pad" value={property.price_per_pad ? `$${formatNumber(property.price_per_pad)}` : 'N/A'} />
              <DetailItem label="Lot Rent" value={property.lot_rent ? `$${formatNumber(property.lot_rent)}/mo` : 'N/A'} />
              <DetailItem label="Median Home Price" value={formatPrice(property.median_home_price)} />
              <DetailItem label="Avg 2BR Rent" value={property.avg_2br_rent ? `$${formatNumber(property.avg_2br_rent)}/mo` : 'N/A'} />
              <DetailItem label="Avg 3BR Rent" value={property.avg_3br_rent ? `$${formatNumber(property.avg_3br_rent)}/mo` : 'N/A'} />
            </div>
          </div>

          {/* Unit Breakdown */}
          <div className="bg-secondary/50 rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              Unit Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DetailItem label="Total Units" value={formatNumber(property.units)} />
              <DetailItem label="TOH (Tenant Owned)" value={formatNumber(property.toh)} />
              <DetailItem label="POH (Park Owned)" value={formatNumber(property.poh)} />
              <DetailItem label="Vacant" value={formatNumber(property.vacant)} />
            </div>
          </div>

          {/* Notes */}
          {property.notes && (
            <div className="bg-secondary/50 rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Notes & Details
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {property.notes}
              </p>
            </div>
          )}

          {/* Source Citation - Prominent Display */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Verified Data Source
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-semibold">
                  {property.source ?? 'Direct'}
                </span>
                <span className="text-sm text-muted-foreground">
                  Listing data verified from trusted commercial real estate database
                </span>
              </div>
              {property.listing_url && (
                <a
                  href={property.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:underline text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  {property.listing_url}
                </a>
              )}
            </div>
          </div>

          {/* Contact & Links */}
          <div className="flex flex-wrap gap-3">
            {property.contact_email && (
              <a
                href={`mailto:${property.contact_email}`}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact Owner
              </a>
            )}
            {property.listing_url && (
              <a
                href={property.listing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View Original Listing
              </a>
            )}
          </div>

          {/* Property Info Footer */}
          <div className="pt-4 border-t border-border text-xs text-muted-foreground">
            <p>Region: {property.region ?? 'N/A'} | Added: {new Date(property.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, highlight = false, isSold = false }: { 
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  isSold?: boolean
}) {
  const bgClass = isSold && highlight 
    ? 'bg-amber-500/10 border border-amber-500/20' 
    : highlight 
      ? 'bg-primary/10 border border-primary/20' 
      : 'bg-secondary/50'
  
  const iconBgClass = isSold && highlight
    ? 'bg-amber-500/20 text-amber-500'
    : highlight 
      ? 'bg-primary/20 text-primary' 
      : 'bg-secondary text-primary'
  
  const textClass = isSold && highlight
    ? 'text-xl text-amber-500'
    : highlight 
      ? 'text-xl text-primary' 
      : 'text-lg text-foreground'

  return (
    <div className={`p-4 rounded-xl ${bgClass}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${iconBgClass}`}>
        {icon}
      </div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-bold ${textClass}`}>{value}</p>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  )
}
