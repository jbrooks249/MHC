'use client'

import { useState } from 'react'
import { Property } from '@/lib/types'
import { 
  X, Save, Loader2, DollarSign, Users, TrendingUp, 
  MapPin, Building2, FileText, AlertCircle, Image, Wand2, Check
} from 'lucide-react'

interface EditListingModalProps {
  property: Property | null
  onClose: () => void
  onSave: (updatedProperty: Property) => void
}

interface FormData {
  name: string
  address: string
  city: string
  state: string
  region: string
  units: string
  asking_price: string
  cap_rate: string
  lot_rent: string
  occupancy: string
  noi: string
  toh: string
  poh: string
  vacant: string
  notes: string
  contact_email: string
  listing_url: string
  status: string
  sold_price: string
  sold_date: string
  buyer: string
  mom_pop: boolean
  image_url: string
}

export function EditListingModal({ property, onClose, onSave }: EditListingModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleanupChanges, setCleanupChanges] = useState<string[] | null>(null)
  
  const [formData, setFormData] = useState<FormData>(() => ({
    name: property?.name || '',
    address: property?.address || '',
    city: property?.city || '',
    state: property?.state || '',
    region: property?.region || '',
    units: property?.units?.toString() || '',
    asking_price: property?.asking_price?.toString() || '',
    cap_rate: property?.cap_rate?.toString() || '',
    lot_rent: property?.lot_rent?.toString() || '',
    occupancy: property?.occupancy?.toString() || '',
    noi: property?.noi?.toString() || '',
    toh: property?.toh?.toString() || '',
    poh: property?.poh?.toString() || '',
    vacant: property?.vacant?.toString() || '',
    notes: property?.notes || '',
    contact_email: property?.contact_email || '',
    listing_url: property?.listing_url || '',
    status: property?.status || 'active',
    sold_price: property?.sold_price?.toString() || '',
    sold_date: property?.sold_date?.split('T')[0] || '',
    buyer: property?.buyer || '',
    mom_pop: property?.mom_pop ?? true,
    image_url: property?.image_url || '',
  }))

  if (!property) return null

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAiCleanup = async () => {
    if (!property) return
    setIsCleaning(true)
    setError(null)
    setCleanupChanges(null)
    try {
      const res = await fetch('/api/ai/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the latest in-progress form values so cleanup reflects edits
        body: JSON.stringify({
          property: {
            ...property,
            name: formData.name,
            address: formData.address || null,
            city: formData.city,
            state: formData.state,
            region: formData.region || null,
            units: formData.units ? parseInt(formData.units) : null,
            asking_price: formData.asking_price ? parseFloat(formData.asking_price) : null,
            cap_rate: formData.cap_rate ? parseFloat(formData.cap_rate) : null,
            lot_rent: formData.lot_rent ? parseFloat(formData.lot_rent) : null,
            occupancy: formData.occupancy ? parseFloat(formData.occupancy) : null,
            noi: formData.noi ? parseFloat(formData.noi) : null,
            toh: formData.toh ? parseInt(formData.toh) : null,
            poh: formData.poh ? parseInt(formData.poh) : null,
            vacant: formData.vacant ? parseInt(formData.vacant) : null,
            notes: formData.notes || null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clean data')

      const c = data.cleaned as Record<string, unknown> & { changes?: string[] }
      const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

      setFormData(prev => ({
        ...prev,
        name: c.name != null ? String(c.name) : prev.name,
        address: str(c.address) || prev.address,
        city: c.city != null ? String(c.city) : prev.city,
        state: c.state != null ? String(c.state) : prev.state,
        region: c.region != null ? String(c.region) : prev.region,
        units: str(c.units) || prev.units,
        asking_price: str(c.asking_price) || prev.asking_price,
        cap_rate: str(c.cap_rate) || prev.cap_rate,
        lot_rent: str(c.lot_rent) || prev.lot_rent,
        occupancy: str(c.occupancy) || prev.occupancy,
        noi: str(c.noi) || prev.noi,
        toh: str(c.toh) || prev.toh,
        poh: str(c.poh) || prev.poh,
        vacant: str(c.vacant) || prev.vacant,
        notes: c.notes != null ? String(c.notes) : prev.notes,
      }))
      setCleanupChanges(c.changes && c.changes.length > 0 ? c.changes : ['No changes needed — data already looks clean.'])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCleaning(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      // Prepare data for API - convert strings to numbers where needed
      const updateData: Record<string, unknown> = {
        name: formData.name,
        address: formData.address || null,
        city: formData.city,
        state: formData.state,
        region: formData.region || null,
        units: formData.units ? parseInt(formData.units) : null,
        asking_price: formData.asking_price ? parseFloat(formData.asking_price) : null,
        cap_rate: formData.cap_rate ? parseFloat(formData.cap_rate) : null,
        lot_rent: formData.lot_rent ? parseFloat(formData.lot_rent) : null,
        occupancy: formData.occupancy ? parseFloat(formData.occupancy) : null,
        noi: formData.noi ? parseFloat(formData.noi) : null,
        toh: formData.toh ? parseInt(formData.toh) : null,
        poh: formData.poh ? parseInt(formData.poh) : null,
        vacant: formData.vacant ? parseInt(formData.vacant) : null,
        notes: formData.notes || null,
        contact_email: formData.contact_email || null,
        listing_url: formData.listing_url || null,
        status: formData.status,
        mom_pop: formData.mom_pop,
        image_url: formData.image_url || null,
      }

      // Add sold fields if status is sold
      if (formData.status === 'sold') {
        updateData.sold_price = formData.sold_price ? parseFloat(formData.sold_price) : null
        updateData.sold_date = formData.sold_date || null
        updateData.buyer = formData.buyer || null
      }

      const response = await fetch(`/api/properties/${property.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update property')
      }

      const updatedProperty = await response.json()
      onSave(updatedProperty)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Edit Listing</h2>
              <p className="text-sm text-muted-foreground">{property.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* AI Cleanup */}
          <div className="flex flex-col gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" />
                  AI Data Cleanup
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Normalize messy scraped values (state, region, prices, percentages) automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAiCleanup}
                disabled={isCleaning}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {isCleaning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Clean with AI
                  </>
                )}
              </button>
            </div>
            {cleanupChanges && (
              <div className="border-t border-primary/20 pt-3">
                <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-primary" />
                  Cleanup applied — review before saving:
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs text-muted-foreground">
                  {cleanupChanges.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Property Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  State *
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. TX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Region
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => handleChange('region', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Select region</option>
                  <option value="Northeast">Northeast</option>
                  <option value="Southeast">Southeast</option>
                  <option value="Midwest">Midwest</option>
                  <option value="Southwest">Southwest</option>
                  <option value="Mountain">Mountain</option>
                  <option value="Pacific">Pacific</option>
                  <option value="Pacific NW">Pacific NW</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
            </div>
          </div>

          {/* Thumbnail Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              Property Thumbnail
            </h3>
            <div className="flex gap-4">
              {/* Image Preview */}
              <div className="w-32 h-24 rounded-lg bg-secondary border border-border overflow-hidden flex-shrink-0">
                {formData.image_url ? (
                  <img
                    src={formData.image_url}
                    alt="Property thumbnail"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                      const parent = (e.target as HTMLImageElement).parentElement
                      if (parent) {
                        parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-muted-foreground"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>'
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Image className="w-8 h-8" />
                  </div>
                )}
              </div>
              {/* URL Input */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => handleChange('image_url', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a direct URL to an image, or leave blank to use Street View
                </p>
              </div>
            </div>
          </div>

          {/* Financial Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Financial Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Asking Price ($)
                </label>
                <input
                  type="number"
                  value={formData.asking_price}
                  onChange={(e) => handleChange('asking_price', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. 2500000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Cap Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.cap_rate}
                  onChange={(e) => handleChange('cap_rate', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. 7.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  NOI ($)
                </label>
                <input
                  type="number"
                  value={formData.noi}
                  onChange={(e) => handleChange('noi', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. 200000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Lot Rent ($/mo)
                </label>
                <input
                  type="number"
                  value={formData.lot_rent}
                  onChange={(e) => handleChange('lot_rent', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. 450"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Occupancy (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.occupancy}
                  onChange={(e) => handleChange('occupancy', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. 92"
                />
              </div>
              <div className="flex items-center gap-3 self-end pb-2">
                <input
                  type="checkbox"
                  id="mom_pop"
                  checked={formData.mom_pop}
                  onChange={(e) => handleChange('mom_pop', e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="mom_pop" className="text-sm font-medium text-foreground">
                  Mom & Pop Owned
                </label>
              </div>
            </div>
          </div>

          {/* Units Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Unit Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Total Units
                </label>
                <input
                  type="number"
                  value={formData.units}
                  onChange={(e) => handleChange('units', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  TOH (Tenant Owned)
                </label>
                <input
                  type="number"
                  value={formData.toh}
                  onChange={(e) => handleChange('toh', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  POH (Park Owned)
                </label>
                <input
                  type="number"
                  value={formData.poh}
                  onChange={(e) => handleChange('poh', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Vacant
                </label>
                <input
                  type="number"
                  value={formData.vacant}
                  onChange={(e) => handleChange('vacant', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          {/* Sold Details (conditional) */}
          {formData.status === 'sold' && (
            <div className="space-y-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <h3 className="font-semibold text-amber-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Sale Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Sold Price ($)
                  </label>
                  <input
                    type="number"
                    value={formData.sold_price}
                    onChange={(e) => handleChange('sold_price', e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Sold Date
                  </label>
                  <input
                    type="date"
                    value={formData.sold_date}
                    onChange={(e) => handleChange('sold_date', e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Buyer
                  </label>
                  <input
                    type="text"
                    value={formData.buyer}
                    onChange={(e) => handleChange('buyer', e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Additional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => handleChange('contact_email', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Listing URL
                </label>
                <input
                  type="url"
                  value={formData.listing_url}
                  onChange={(e) => handleChange('listing_url', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Add any notes about this property..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
