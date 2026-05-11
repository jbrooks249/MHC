'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Property, FilterState } from '@/lib/types'
import { SearchFilters } from './search-filters'
import { PropertyGrid } from './property-grid'
import { StatsBar } from './stats-bar'
import { createClient } from '@/lib/supabase/client'
import { Building2, Sparkles } from 'lucide-react'

const defaultFilters: FilterState = {
  search: '',
  minUnits: null,
  maxUnits: null,
  minCapRate: null,
  maxCapRate: null,
  states: [],
  sources: [],
  momPopOnly: false,
  minAiScore: null,
  sortBy: 'ai_score',
  sortOrder: 'desc'
}

export function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([])
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch properties from Supabase
  useEffect(() => {
    async function fetchProperties() {
      setIsLoading(true)
      setError(null)
      
      try {
        const supabase = createClient()
        const { data, error: fetchError } = await supabase
          .from('properties')
          .select('*')
          .order('ai_score', { ascending: false })
        
        if (fetchError) {
          throw fetchError
        }
        
        setProperties(data ?? [])
      } catch (err) {
        console.error('[v0] Error fetching properties:', err)
        setError('Failed to load properties. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchProperties()
  }, [])

  // Get unique states and sources for filter options
  const availableStates = useMemo(() => {
    const states = new Set(properties.map(p => p.state))
    return Array.from(states).sort()
  }, [properties])

  const availableSources = useMemo(() => {
    const sources = new Set(properties.map(p => p.source).filter(Boolean) as string[])
    return Array.from(sources).sort()
  }, [properties])

  // Filter and sort properties
  const filteredProperties = useMemo(() => {
    let result = [...properties]
    
    // Text search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.city.toLowerCase().includes(searchLower) ||
        p.state.toLowerCase().includes(searchLower)
      )
    }
    
    // Units filter
    if (filters.minUnits !== null) {
      result = result.filter(p => p.units >= filters.minUnits!)
    }
    if (filters.maxUnits !== null) {
      result = result.filter(p => p.units <= filters.maxUnits!)
    }
    
    // Cap rate filter
    if (filters.minCapRate !== null) {
      result = result.filter(p => (p.cap_rate ?? 0) >= filters.minCapRate!)
    }
    if (filters.maxCapRate !== null) {
      result = result.filter(p => (p.cap_rate ?? 0) <= filters.maxCapRate!)
    }
    
    // State filter
    if (filters.states.length > 0) {
      result = result.filter(p => filters.states.includes(p.state))
    }
    
    // Source filter
    if (filters.sources.length > 0) {
      result = result.filter(p => p.source && filters.sources.includes(p.source))
    }
    
    // Mom & Pop filter
    if (filters.momPopOnly) {
      result = result.filter(p => p.mom_pop)
    }
    
    // AI Score filter
    if (filters.minAiScore !== null) {
      result = result.filter(p => (p.ai_score ?? 0) >= filters.minAiScore!)
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal: number | string | null
      let bVal: number | string | null
      
      switch (filters.sortBy) {
        case 'ai_score':
          aVal = a.ai_score ?? 0
          bVal = b.ai_score ?? 0
          break
        case 'asking_price':
          aVal = a.asking_price ?? 0
          bVal = b.asking_price ?? 0
          break
        case 'units':
          aVal = a.units
          bVal = b.units
          break
        case 'cap_rate':
          aVal = a.cap_rate ?? 0
          bVal = b.cap_rate ?? 0
          break
        case 'created_at':
          aVal = a.created_at
          bVal = b.created_at
          break
        default:
          return 0
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return filters.sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      
      return filters.sortOrder === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    
    return result
  }, [properties, filters])

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-lg font-medium text-destructive mb-2">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">MHC Acquisition Intelligence</h1>
                <p className="text-sm text-muted-foreground">AI-Powered Deal Discovery</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-score-high/10 border border-score-high/20">
              <Sparkles className="w-4 h-4 text-score-high" />
              <span className="text-sm font-medium text-score-high">AI Scoring Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col gap-6">
          {/* Stats Bar */}
          <StatsBar properties={filteredProperties} />
          
          {/* Search and Filters */}
          <SearchFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            availableStates={availableStates}
            availableSources={availableSources}
          />
          
          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredProperties.length}</span> of{' '}
              <span className="font-semibold text-foreground">{properties.length}</span> properties
            </p>
          </div>
          
          {/* Property Grid */}
          <PropertyGrid properties={filteredProperties} isLoading={isLoading} />
        </div>
      </main>
    </div>
  )
}
