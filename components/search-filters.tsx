'use client'

import { FilterState } from '@/lib/types'
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface SearchFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  availableStates: string[]
  availableSources: string[]
}

export function SearchFilters({ filters, onFiltersChange, availableStates, availableSources }: SearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }
  
  const toggleState = (state: string) => {
    const newStates = filters.states.includes(state)
      ? filters.states.filter(s => s !== state)
      : [...filters.states, state]
    updateFilter('states', newStates)
  }
  
  const toggleSource = (source: string) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source]
    updateFilter('sources', newSources)
  }
  
  const clearFilters = () => {
    onFiltersChange({
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
    })
  }
  
  const activeFilterCount = [
    filters.search,
    filters.minUnits,
    filters.maxUnits,
    filters.minCapRate,
    filters.maxCapRate,
    filters.states.length > 0,
    filters.sources.length > 0,
    filters.momPopOnly,
    filters.minAiScore
  ].filter(Boolean).length

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      {/* Main Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search properties by name, city, or state..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
            showAdvanced || activeFilterCount > 0
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary text-secondary-foreground border-border hover:border-primary/50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary-foreground text-primary text-xs font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">Clear</span>
          </button>
        )}
      </div>
      
      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Units Range */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Units</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minUnits ?? ''}
                  onChange={(e) => updateFilter('minUnits', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                <span className="text-muted-foreground">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxUnits ?? ''}
                  onChange={(e) => updateFilter('maxUnits', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            </div>
            
            {/* Cap Rate Range */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Cap Rate (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Min"
                  value={filters.minCapRate ?? ''}
                  onChange={(e) => updateFilter('minCapRate', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                <span className="text-muted-foreground">-</span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Max"
                  value={filters.maxCapRate ?? ''}
                  onChange={(e) => updateFilter('maxCapRate', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            </div>
            
            {/* Min AI Score */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Min AI Score</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 80"
                value={filters.minAiScore ?? ''}
                onChange={(e) => updateFilter('minAiScore', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            
            {/* Mom & Pop Toggle */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Owner Type</label>
              <button
                onClick={() => updateFilter('momPopOnly', !filters.momPopOnly)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  filters.momPopOnly
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-input border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {filters.momPopOnly ? 'Mom & Pop Only' : 'All Owners'}
              </button>
            </div>
          </div>
          
          {/* States Filter */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-2">States</label>
            <div className="flex flex-wrap gap-2">
              {availableStates.map(state => (
                <button
                  key={state}
                  onClick={() => toggleState(state)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filters.states.includes(state)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>
          
          {/* Sources Filter */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-2">Sources</label>
            <div className="flex flex-wrap gap-2">
              {availableSources.map(source => (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filters.sources.includes(source)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>
          
          {/* Sort Options */}
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Sort by:</label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value as FilterState['sortBy'])}
                className="px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              >
                <option value="ai_score">AI Score</option>
                <option value="asking_price">Price</option>
                <option value="units">Units</option>
                <option value="cap_rate">Cap Rate</option>
                <option value="created_at">Date Added</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Order:</label>
              <select
                value={filters.sortOrder}
                onChange={(e) => updateFilter('sortOrder', e.target.value as 'asc' | 'desc')}
                className="px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              >
                <option value="desc">High to Low</option>
                <option value="asc">Low to High</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
