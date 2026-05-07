'use client'

import { useEffect, useState } from 'react'
import { supabase, type Property } from '@/lib/supabase'
import PropertyCard from '@/components/PropertyCard'
import SearchBar from '@/components/SearchBar'

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([])
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchProperties()
  }, [])

  async function fetchProperties() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .gte('units', 45)
        .not('state', 'in', '(CA,WA,OR)')
        .order('ai_score', { ascending: false })

      if (error) throw error
      setProperties(data || [])
      setFilteredProperties(data || [])
    } catch (error) {
      console.error('Error fetching properties:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(term: string) {
    setSearchTerm(term)

    if (!term.trim()) {
      setFilteredProperties(properties)
      return
    }

    const filtered = properties.filter(
      (prop) =>
        prop.name.toLowerCase().includes(term.toLowerCase()) ||
        prop.city.toLowerCase().includes(term.toLowerCase()) ||
        prop.state.toLowerCase().includes(term.toLowerCase())
    )
    setFilteredProperties(filtered)
  }

  return (
    <main className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white">MHC Acquisition</h1>
            <p className="mt-2 text-slate-400">
              Discover institutional-grade manufactured housing investments
            </p>
          </div>
          <SearchBar value={searchTerm} onChange={handleSearch} />
        </div>
      </header>

      {/* Stats */}
      <section className="border-b border-slate-800 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-800/50 px-4 py-3">
              <p className="text-sm text-slate-400">Total Properties</p>
              <p className="text-2xl font-bold text-emerald-400">
                {properties.length}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 px-4 py-3">
              <p className="text-sm text-slate-400">Avg AI Score</p>
              <p className="text-2xl font-bold text-emerald-400">
                {properties.length > 0
                  ? (properties.reduce((sum, p) => sum + p.ai_score, 0) / properties.length).toFixed(1)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 px-4 py-3">
              <p className="text-sm text-slate-400">Mom & Pop</p>
              <p className="text-2xl font-bold text-emerald-400">
                {properties.filter((p) => p.mom_pop).length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Properties Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-lg text-slate-400">Loading properties...</div>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-lg text-slate-400">No properties found</p>
              <p className="mt-2 text-sm text-slate-500">
                Try adjusting your search or filters
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
