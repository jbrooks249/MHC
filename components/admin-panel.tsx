'use client'

import { useState, useEffect } from 'react'
import { 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Database,
  Building2,
  TrendingUp,
  AlertCircle,
  Play,
  History,
  Globe,
  MapPin,
  Image,
  BarChart3,
  Zap,
  Shield,
  Target,
  Settings,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Bot,
  Pencil,
  Search,
  Trash2,
  Plus,
  FileText,
  Link
} from 'lucide-react'

interface ScrapeJob {
  id: string
  source: string
  url: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  listings_found: number
  listings_added: number
  listings_updated: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface ScrapeStats {
  totalProperties: number
  activeProperties: number
  lastScrape: string | null
  propertiesWithImages: number
  propertiesWithCoords: number
  propertiesWithStreetView: number
  avgDataQuality: number
  dataCompletenessScore: number
  // Financial metrics
  totalValue: number
  averagePrice: number
  averageCapRate: number
  averagePricePerUnit: number
  averageLotRent: number
  // Quality indicators
  highScoreCount: number
  momPopCount: number
  // Image stats
  imageStats?: {
    streetView: number
    satellite: number
    listing: number
    placeholder: number
    none: number
  }
}

interface SourceStats {
  id: string
  name: string
  type: string
  enabled: boolean
  reliabilityScore: number
  lastScraped?: string
  totalListings?: number
}

type TabType = 'overview' | 'sources' | 'scraper' | 'quality' | 'images' | 'import' | 'ai' | 'properties' | 'activity'

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [stats, setStats] = useState<ScrapeStats | null>(null)
  const [sources, setSources] = useState<SourceStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScraping, setIsScraping] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isUpdatingImages, setIsUpdatingImages] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<{
    summary?: { totalLeads?: number; total?: number; toInsert?: number; inserted?: number; toUpdate?: number; updated?: number; duplicates?: number; skipped?: number; failed?: number }
    preview?: { insert?: Array<{ name: string }>; update?: Array<{ name: string; existingName: string }> }
  } | null>(null)
  const [scrapeResult, setScrapeResult] = useState<Record<string, unknown> | null>(null)
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<string[]>([])
  
  // AI Task state
  const [aiTaskRunning, setAiTaskRunning] = useState(false)
  const [aiTaskResult, setAiTaskResult] = useState<Record<string, unknown> | null>(null)
  const [selectedAiTask, setSelectedAiTask] = useState<string>('analyze_property')
  
  // Properties state
  const [propertiesList, setPropertiesList] = useState<Record<string, unknown>[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Record<string, unknown> | null>(null)
  const [propertySearch, setPropertySearch] = useState('')
  const [isEditingProperty, setIsEditingProperty] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([])
  const [isBulkEditing, setIsBulkEditing] = useState(false)
  const [bulkEditForm, setBulkEditForm] = useState<Record<string, unknown>>({})
  
  // Activity Log state
  const [activityLogs, setActivityLogs] = useState<Record<string, unknown>[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    primary: true,
    broker: false,
    aggregator: false,
    auction: false,
    regional: false,
    news: false
  })

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      // Fetch scrape jobs and sources
      const scrapeResponse = await fetch('/api/scrape')
      const scrapeData = await scrapeResponse.json()
      setJobs(scrapeData.recentJobs || [])
      setSources(scrapeData.sources || [])
      
      // Fetch enhanced stats from dedicated stats API
      const statsResponse = await fetch('/api/stats')
      const statsData = await statsResponse.json()
      
      if (statsData.success && statsData.stats) {
        setStats({
          totalProperties: statsData.stats.totalProperties,
          activeProperties: statsData.stats.activeListings,
          lastScrape: statsData.stats.lastScrapeTime,
          propertiesWithImages: statsData.stats.propertiesWithImages,
          propertiesWithCoords: statsData.stats.propertiesWithCoordinates,
          propertiesWithStreetView: statsData.stats.propertiesWithStreetView,
          avgDataQuality: statsData.stats.dataCompletenessScore,
          dataCompletenessScore: statsData.stats.dataCompletenessScore,
          totalValue: statsData.stats.totalValue,
          averagePrice: statsData.stats.averagePrice,
          averageCapRate: statsData.stats.averageCapRate,
          averagePricePerUnit: statsData.stats.averagePricePerUnit,
          averageLotRent: statsData.stats.averageLotRent,
          highScoreCount: statsData.stats.highScoreCount,
          momPopCount: statsData.stats.momPopCount,
          imageStats: statsData.stats.imageStats
        })
      } else {
        // Fallback to basic stats from scrape API
        setStats(scrapeData.stats || null)
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const triggerScrape = async (sourceTypes?: string[]) => {
    setIsScraping(true)
    setScrapeResult(null)
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminTrigger: true,
          sourceTypes: sourceTypes?.length ? sourceTypes : undefined,
          parallel: true
        })
      })
      
      const result = await response.json()
      setScrapeResult(result)
      await fetchStatus()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setScrapeResult({ error: true, message: errorMessage })
    } finally {
      setIsScraping(false)
    }
  }

  const triggerGeocoding = async () => {
    setIsGeocoding(true)
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateAll: true, limit: 100 })
      })
      const result = await response.json()
      setScrapeResult(result)
      await fetchStatus()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setScrapeResult({ error: true, message: errorMessage })
    } finally {
      setIsGeocoding(false)
    }
  }

  const triggerImageUpdate = async () => {
    setIsUpdatingImages(true)
    try {
      const response = await fetch('/api/streetview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateAll: true, limit: 100 })
      })
      const result = await response.json()
      setScrapeResult(result)
      await fetchStatus()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setScrapeResult({ error: true, message: errorMessage })
    } finally {
      setIsUpdatingImages(false)
    }
  }

  const triggerEnrichment = async () => {
    setIsEnriching(true)
    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichAll: true, limit: 100 })
      })
      const result = await response.json()
      setScrapeResult(result)
      await fetchStatus()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setScrapeResult({ error: true, message: errorMessage })
    } finally {
      setIsEnriching(false)
    }
  }

  // AI Task functions
  const runAiTask = async (task: string, propertyIds?: string[]) => {
    setAiTaskRunning(true)
    setAiTaskResult(null)
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, propertyIds })
      })
      const result = await response.json()
      setAiTaskResult(result)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setAiTaskResult({ error: true, message: errorMessage })
    } finally {
      setAiTaskRunning(false)
    }
  }

  // Property functions
  const fetchProperties = async (search?: string) => {
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (search) params.set('search', search)
      const response = await fetch(`/api/properties?${params}`)
      const data = await response.json()
      if (data.success) {
        setPropertiesList(data.properties || [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const saveProperty = async () => {
    try {
      const method = selectedProperty?.id ? 'PUT' : 'POST'
      const body = selectedProperty?.id 
        ? { id: selectedProperty.id, ...editForm }
        : editForm
      
      const response = await fetch('/api/properties', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const result = await response.json()
      
      if (result.success) {
        setIsEditingProperty(false)
        setSelectedProperty(null)
        setEditForm({})
        await fetchProperties(propertySearch)
        await fetchStatus()
      }
    } catch (error) {
      console.error('Failed to save property:', error)
    }
  }

  const deleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return
    try {
      const response = await fetch(`/api/properties?id=${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) {
        await fetchProperties(propertySearch)
        await fetchStatus()
      }
    } catch (error) {
      console.error('Failed to delete property:', error)
    }
  }

  // Bulk operations
  const togglePropertySelection = (id: string) => {
    setSelectedPropertyIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectAllProperties = () => {
    if (selectedPropertyIds.length === propertiesList.length) {
      setSelectedPropertyIds([])
    } else {
      setSelectedPropertyIds(propertiesList.map(p => String(p.id)))
    }
  }

  const bulkDeleteProperties = async () => {
    if (selectedPropertyIds.length === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedPropertyIds.length} properties?`)) return
    
    try {
      const response = await fetch(`/api/properties?ids=${selectedPropertyIds.join(',')}`, { 
        method: 'DELETE' 
      })
      const result = await response.json()
      if (result.success) {
        setSelectedPropertyIds([])
        await fetchProperties(propertySearch)
        await fetchStatus()
        alert(`Successfully deleted ${result.deleted} properties`)
      }
    } catch (error) {
      console.error('Failed to bulk delete:', error)
    }
  }

  const bulkUpdateProperties = async () => {
    if (selectedPropertyIds.length === 0 || Object.keys(bulkEditForm).length === 0) return
    
    try {
      const response = await fetch('/api/properties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedPropertyIds, updates: bulkEditForm })
      })
      const result = await response.json()
      if (result.success) {
        setSelectedPropertyIds([])
        setBulkEditForm({})
        setIsBulkEditing(false)
        await fetchProperties(propertySearch)
        alert(`Successfully updated ${result.updated} properties`)
      }
    } catch (error) {
      console.error('Failed to bulk update:', error)
    }
  }

  const exportProperties = async (format: 'csv' | 'json' = 'csv', onlySelected = false) => {
    try {
      let url = `/api/export?format=${format}`
      if (onlySelected && selectedPropertyIds.length > 0) {
        url += `&ids=${selectedPropertyIds.join(',')}`
      }
      
      if (format === 'csv') {
        window.open(url, '_blank')
      } else {
        const response = await fetch(url)
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data.properties, null, 2)], { type: 'application/json' })
        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `mhc-properties-${new Date().toISOString().split('T')[0]}.json`
        a.click()
      }
    } catch (error) {
      console.error('Failed to export:', error)
    }
  }

  // Activity log
  const fetchActivityLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const response = await fetch('/api/activity?limit=50')
      const data = await response.json()
      if (data.success) {
        setActivityLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-500'
      case 'failed':
        return 'bg-red-500/10 text-red-500'
      case 'running':
        return 'bg-blue-500/10 text-blue-500'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'primary':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      case 'broker':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'aggregator':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
      case 'auction':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      case 'regional':
        return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'
      case 'news':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const groupedSources = sources.reduce((acc, source) => {
    const type = source.type || 'other'
    if (!acc[type]) acc[type] = []
    acc[type].push(source)
    return acc
  }, {} as Record<string, SourceStats[]>)

  const toggleSourceType = (type: string) => {
    setSelectedSourceTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'properties', label: 'Properties', icon: <Building2 className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Tasks', icon: <Bot className="w-4 h-4" /> },
    { id: 'sources', label: 'Sources', icon: <Globe className="w-4 h-4" /> },
    { id: 'scraper', label: 'Scraper', icon: <Zap className="w-4 h-4" /> },
    { id: 'quality', label: 'Data Quality', icon: <Shield className="w-4 h-4" /> },
    { id: 'images', label: 'Images', icon: <Image className="w-4 h-4" /> },
    { id: 'import', label: 'Import', icon: <Database className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <History className="w-4 h-4" /> },
  ]

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-border shrink-0 overflow-x-auto max-w-7xl mx-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-secondary text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Cards - Row 1 */}
                  {stats && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-secondary/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            <span className="text-sm text-muted-foreground">Total Properties</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{stats.totalProperties.toLocaleString()}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm text-muted-foreground">Active Listings</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{stats.activeProperties.toLocaleString()}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-amber-500" />
                            <span className="text-sm text-muted-foreground">High Score (80+)</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{(stats.highScoreCount || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-cyan-500" />
                            <span className="text-sm text-muted-foreground">Data Quality</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{stats.dataCompletenessScore || 0}%</p>
                        </div>
                      </div>

                      {/* Image & Location Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-secondary/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-muted-foreground">With Coordinates</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{(stats.propertiesWithCoords || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {stats.totalProperties > 0 ? Math.round((stats.propertiesWithCoords || 0) / stats.totalProperties * 100) : 0}% coverage
                          </p>
                        </div>
                        <div className="bg-secondary/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Image className="w-4 h-4 text-purple-500" />
                            <span className="text-sm text-muted-foreground">With Images</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{(stats.propertiesWithImages || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {stats.totalProperties > 0 ? Math.round((stats.propertiesWithImages || 0) / stats.totalProperties * 100) : 0}% coverage
                          </p>
                        </div>
                        <div className="bg-secondary/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-muted-foreground">Street View</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{(stats.imageStats?.streetView || stats.propertiesWithStreetView || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground mt-1">Verified property images</p>
                        </div>
                        <div className="bg-secondary/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-rose-500" />
                            <span className="text-sm text-muted-foreground">Mom & Pop</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground">{(stats.momPopCount || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground mt-1">Potential acquisition targets</p>
                        </div>
                      </div>

                      {/* Financial Metrics */}
                      <div className="bg-secondary/30 rounded-xl p-5 border border-border">
                        <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-emerald-500" />
                          Financial Overview
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
                            <p className="text-lg font-bold text-foreground">${((stats.totalValue || 0) / 1000000000).toFixed(2)}B</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Asking Price</p>
                            <p className="text-lg font-bold text-foreground">${((stats.averagePrice || 0) / 1000000).toFixed(2)}M</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Cap Rate</p>
                            <p className="text-lg font-bold text-foreground">{(stats.averageCapRate || 0).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Price/Unit</p>
                            <p className="text-lg font-bold text-foreground">${((stats.averagePricePerUnit || 0) / 1000).toFixed(0)}K</p>
                          </div>
                        </div>
                      </div>

                      {/* Image Type Breakdown */}
                      {stats.imageStats && (
                        <div className="bg-secondary/30 rounded-xl p-5 border border-border">
                          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                            <Image className="w-5 h-5 text-purple-500" />
                            Image Sources Breakdown
                          </h4>
                          <div className="grid grid-cols-5 gap-3">
                            <div className="text-center p-3 bg-green-500/10 rounded-lg">
                              <p className="text-2xl font-bold text-green-500">{stats.imageStats.streetView}</p>
                              <p className="text-xs text-muted-foreground">Street View</p>
                            </div>
                            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                              <p className="text-2xl font-bold text-blue-500">{stats.imageStats.satellite}</p>
                              <p className="text-xs text-muted-foreground">Satellite</p>
                            </div>
                            <div className="text-center p-3 bg-purple-500/10 rounded-lg">
                              <p className="text-2xl font-bold text-purple-500">{stats.imageStats.listing}</p>
                              <p className="text-xs text-muted-foreground">Listing</p>
                            </div>
                            <div className="text-center p-3 bg-amber-500/10 rounded-lg">
                              <p className="text-2xl font-bold text-amber-500">{stats.imageStats.placeholder}</p>
                              <p className="text-xs text-muted-foreground">Placeholder</p>
                            </div>
                            <div className="text-center p-3 bg-red-500/10 rounded-lg">
                              <p className="text-2xl font-bold text-red-500">{stats.imageStats.none}</p>
                              <p className="text-xs text-muted-foreground">None</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                      onClick={() => triggerScrape()}
                      disabled={isScraping}
                      className="flex flex-col items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      {isScraping ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : <Zap className="w-6 h-6 text-emerald-500" />}
                      <span className="text-sm font-medium text-emerald-600">Run Full Scrape</span>
                    </button>
                    <button
                      onClick={triggerGeocoding}
                      disabled={isGeocoding}
                      className="flex flex-col items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                    >
                      {isGeocoding ? <Loader2 className="w-6 h-6 animate-spin text-blue-500" /> : <MapPin className="w-6 h-6 text-blue-500" />}
                      <span className="text-sm font-medium text-blue-600">Geocode Addresses</span>
                    </button>
                    <button
                      onClick={triggerImageUpdate}
                      disabled={isUpdatingImages}
                      className="flex flex-col items-center gap-2 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
                    >
                      {isUpdatingImages ? <Loader2 className="w-6 h-6 animate-spin text-purple-500" /> : <Image className="w-6 h-6 text-purple-500" />}
                      <span className="text-sm font-medium text-purple-600">Update Images</span>
                    </button>
                    <button
                      onClick={triggerEnrichment}
                      disabled={isEnriching}
                      className="flex flex-col items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                    >
                      {isEnriching ? <Loader2 className="w-6 h-6 animate-spin text-amber-500" /> : <Target className="w-6 h-6 text-amber-500" />}
                      <span className="text-sm font-medium text-amber-600">Enrich Data</span>
                    </button>
                  </div>

                  {/* Result Display */}
                  {scrapeResult && (
                    <div className={`p-4 rounded-xl ${scrapeResult.error ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                      {scrapeResult.error ? (
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertCircle className="w-4 h-4" />
                          <span>{String(scrapeResult.message)}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Operation completed successfully
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            {scrapeResult.total_scraped !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Scraped:</span>{' '}
                                <span className="font-medium">{String(scrapeResult.total_scraped)}</span>
                              </div>
                            )}
                            {scrapeResult.total_added !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Added:</span>{' '}
                                <span className="font-medium text-emerald-500">{String(scrapeResult.total_added)}</span>
                              </div>
                            )}
                            {scrapeResult.geocoded !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Geocoded:</span>{' '}
                                <span className="font-medium text-blue-500">{String(scrapeResult.geocoded)}</span>
                              </div>
                            )}
                            {scrapeResult.streetView !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Street View:</span>{' '}
                                <span className="font-medium text-purple-500">{String(scrapeResult.streetView)}</span>
                              </div>
                            )}
                            {scrapeResult.processed !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Processed:</span>{' '}
                                <span className="font-medium">{String(scrapeResult.processed)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recent Jobs */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <History className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Recent Activity</h3>
                    </div>
                    {jobs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground bg-secondary/30 rounded-xl">
                        No recent activity. Run a scrape to get started.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {jobs.slice(0, 10).map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              {getStatusIcon(job.status)}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground text-sm">{job.source}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                                    {job.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              {job.status === 'completed' && (
                                <div className="text-muted-foreground">
                                  <span className="text-emerald-500">+{job.listings_added}</span>
                                  {' / '}
                                  <span className="text-blue-500">{job.listings_updated} upd</span>
                                </div>
                              )}
                              <div className="text-muted-foreground">
                                {formatDate(job.created_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sources Tab */}
              {activeTab === 'sources' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">
                      {sources.length} Scraping Sources Configured
                    </h3>
                    <div className="flex gap-2">
                      {Object.keys(groupedSources).map(type => (
                        <button
                          key={type}
                          onClick={() => toggleSourceType(type)}
                          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                            selectedSourceTypes.includes(type)
                              ? getTypeColor(type)
                              : 'bg-secondary text-muted-foreground border-border'
                          }`}
                        >
                          {type} ({groupedSources[type].length})
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedSourceTypes.length > 0 && (
                    <button
                      onClick={() => triggerScrape(selectedSourceTypes)}
                      disabled={isScraping}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {isScraping ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Scraping {selectedSourceTypes.join(', ')}...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Scrape Selected Types ({selectedSourceTypes.length})
                        </>
                      )}
                    </button>
                  )}

                  {Object.entries(groupedSources).map(([type, typeSources]) => (
                    <div key={type} className="border border-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSections(prev => ({ ...prev, [type]: !prev[type] }))}
                        className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {expandedSections[type] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(type)}`}>
                            {type}
                          </span>
                          <span className="font-medium text-foreground">
                            {typeSources.length} sources
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Avg reliability: {Math.round(typeSources.reduce((a, s) => a + s.reliabilityScore, 0) / typeSources.length * 100)}%
                        </span>
                      </button>
                      {expandedSections[type] && (
                        <div className="divide-y divide-border">
                          {typeSources.map(source => (
                            <div key={source.id} className="flex items-center justify-between p-3 hover:bg-secondary/20">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${source.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                                <span className="font-medium text-sm text-foreground">{source.name}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className={source.reliabilityScore >= 0.8 ? 'text-emerald-500' : source.reliabilityScore >= 0.6 ? 'text-amber-500' : 'text-red-500'}>
                                  {Math.round(source.reliabilityScore * 100)}% reliable
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Scraper Tab */}
              {activeTab === 'scraper' && (
                <div className="space-y-6">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">Full Internet Scrape</h3>
                        <p className="text-sm text-muted-foreground">
                          Scrape all {sources.length} sources for mobile home park listings across the entire US
                        </p>
                      </div>
                      <button
                        onClick={() => triggerScrape()}
                        disabled={isScraping}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
                      >
                        {isScraping ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Scraping...
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5" />
                            Run Full Scrape
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-background/50 rounded-lg p-3">
                        <span className="text-muted-foreground">Primary Sources</span>
                        <p className="font-bold text-foreground">{groupedSources['primary']?.length || 0}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <span className="text-muted-foreground">Broker Networks</span>
                        <p className="font-bold text-foreground">{groupedSources['broker']?.length || 0}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <span className="text-muted-foreground">Aggregators</span>
                        <p className="font-bold text-foreground">{groupedSources['aggregator']?.length || 0}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <span className="text-muted-foreground">Auctions</span>
                        <p className="font-bold text-foreground">{groupedSources['auction']?.length || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Cron Info */}
                  <div className="bg-secondary/30 border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">Automatic Scraping</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The scraper runs automatically every day at 4:00 AM UTC via Vercel Cron.
                      All enabled sources are scraped with intelligent rate limiting and deduplication.
                    </p>
                  </div>

                  {/* Recent Jobs Table */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" />
                      Scrape History
                    </h3>
                    <div className="border border-border rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="text-left p-3 font-medium text-muted-foreground">Source</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Found</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Added</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Updated</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {jobs.slice(0, 20).map(job => (
                            <tr key={job.id} className="hover:bg-secondary/20">
                              <td className="p-3 font-medium text-foreground">{job.source}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                                  {job.status}
                                </span>
                              </td>
                              <td className="p-3 text-right text-muted-foreground">{job.listings_found}</td>
                              <td className="p-3 text-right text-emerald-500">{job.listings_added}</td>
                              <td className="p-3 text-right text-blue-500">{job.listings_updated}</td>
                              <td className="p-3 text-right text-muted-foreground text-xs">{formatDate(job.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Quality Tab */}
              {activeTab === 'quality' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-secondary/50 rounded-xl p-5">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        Data Completeness
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">With Address</span>
                            <span className="font-medium">{stats ? Math.round((stats.propertiesWithCoords || 0) / stats.totalProperties * 100) : 0}%</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${stats ? Math.round((stats.propertiesWithCoords || 0) / stats.totalProperties * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">With Images</span>
                            <span className="font-medium">{stats ? Math.round((stats.propertiesWithImages || 0) / stats.totalProperties * 100) : 0}%</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${stats ? Math.round((stats.propertiesWithImages || 0) / stats.totalProperties * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">With Coordinates</span>
                            <span className="font-medium">{stats ? Math.round((stats.propertiesWithCoords || 0) / stats.totalProperties * 100) : 0}%</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${stats ? Math.round((stats.propertiesWithCoords || 0) / stats.totalProperties * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-secondary/50 rounded-xl p-5">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Data Enrichment
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Run enrichment to add market analysis, financial metrics, and risk scoring to properties.
                      </p>
                      <button
                        onClick={triggerEnrichment}
                        disabled={isEnriching}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-lg hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                      >
                        {isEnriching ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Enriching...
                          </>
                        ) : (
                          <>
                            <Target className="w-4 h-4" />
                            Enrich All Properties
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-secondary/30 rounded-xl p-5">
                    <h4 className="font-semibold text-foreground mb-4">Validation Features</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Address Normalization</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Price Validation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Cap Rate Bounds</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Duplicate Detection</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Cross-Source Matching</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Regional Price Checks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Geocoding Validation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Source Reliability</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Images Tab */}
              {activeTab === 'images' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-secondary/50 rounded-xl p-5">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-500" />
                        Geocoding
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Geocode addresses using Google Maps API to get accurate coordinates for mapping.
                      </p>
                      <button
                        onClick={triggerGeocoding}
                        disabled={isGeocoding}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 rounded-lg hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                      >
                        {isGeocoding ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Geocoding...
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4" />
                            Geocode All Missing
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-secondary/50 rounded-xl p-5">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Image className="w-5 h-5 text-purple-500" />
                        Street View Images
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Fetch Street View images for properties. Falls back to satellite imagery when unavailable.
                      </p>
                      <button
                        onClick={triggerImageUpdate}
                        disabled={isUpdatingImages}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-600 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
                      >
                        {isUpdatingImages ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating Images...
                          </>
                        ) : (
                          <>
                            <Image className="w-4 h-4" />
                            Update All Images
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-secondary/50 rounded-xl p-5">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <ExternalLink className="w-5 h-5 text-emerald-500" />
                        Listing URLs
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Generate listing URLs for properties missing direct links to their original listings.
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/backfill-urls', { method: 'POST', body: JSON.stringify({ limit: 200 }) })
                            const data = await response.json()
                            alert(`Backfilled ${data.updated} listing URLs`)
                            fetchStatus()
                          } catch (error) {
                            console.error('Backfill failed:', error)
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg hover:bg-emerald-500/20 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Backfill Missing URLs
                      </button>
                    </div>
                  </div>

                  {/* Data Quality Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-secondary/50 rounded-xl p-5">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-amber-500" />
                        Property Names
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Verify and fix property names that are generic, missing, or incorrect.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/fix-names')
                              const data = await response.json()
                              alert(`Name Analysis:\n- Total: ${data.stats?.total || 0}\n- Need Fix: ${data.stats?.needsFix || 0}\n- Avg Confidence: ${data.stats?.averageConfidence || 0}%`)
                            } catch (error) {
                              console.error('Analysis failed:', error)
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-lg hover:bg-amber-500/20 transition-colors"
                        >
                          <BarChart3 className="w-4 h-4" />
                          Analyze
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/fix-names', { 
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fixAll: true, limit: 200 }) 
                              })
                              const data = await response.json()
                              alert(`Fixed ${data.fixed} property names`)
                              fetchStatus()
                            } catch (error) {
                              console.error('Fix names failed:', error)
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                        >
                          <Zap className="w-4 h-4" />
                          Fix All
                        </button>
                      </div>
                    </div>

                    <div className="bg-secondary/50 rounded-xl p-5">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Database className="w-5 h-5 text-cyan-500" />
                        Data Enrichment
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Enrich property data with market analysis, financial metrics, and quality scores.
                      </p>
                      <button
                        onClick={triggerEnrichment}
                        disabled={isEnriching}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 rounded-lg hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
                      >
                        {isEnriching ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Enriching...
                          </>
                        ) : (
                          <>
                            <Database className="w-4 h-4" />
                            Enrich All Properties
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-secondary/30 rounded-xl p-5">
                    <h4 className="font-semibold text-foreground mb-4">Image Sources (Priority Order)</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <span className="text-emerald-500 font-bold">1</span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Google Street View</span>
                          <p className="text-xs text-muted-foreground">Actual street-level imagery of the property</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <span className="text-blue-500 font-bold">2</span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Satellite/Hybrid View</span>
                          <p className="text-xs text-muted-foreground">Aerial satellite imagery with road overlay</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <span className="text-amber-500 font-bold">3</span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Source-Provided Image</span>
                          <p className="text-xs text-muted-foreground">Images from the listing source if available</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Import Tab */}
              {activeTab === 'import' && (
                <div className="space-y-6">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
                    <h3 className="font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      Monday Leads Import
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Import the latest Monday leads export (5.8.2026) containing 95+ mobile home community listings with detailed pricing, unit counts, and contact information.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/import-leads')
                            const data = await response.json()
                            setImportPreview(data)
                          } catch (error) {
                            console.error('Preview failed:', error)
                          }
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 rounded-lg hover:bg-emerald-500/30 transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Preview Import
                      </button>
                      
                      <button
                        onClick={async () => {
                          setIsImporting(true)
                          try {
                            const response = await fetch('/api/import-leads', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ dryRun: true })
                            })
                            const data = await response.json()
                            setImportPreview(data)
                          } catch (error) {
                            console.error('Dry run failed:', error)
                          } finally {
                            setIsImporting(false)
                          }
                        }}
                        disabled={isImporting}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500/20 border border-amber-500/30 text-amber-600 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
                      >
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Dry Run
                      </button>
                      
                      <button
                        onClick={async () => {
                          if (!confirm('This will import all leads and may update existing properties. Continue?')) return
                          setIsImporting(true)
                          try {
                            const response = await fetch('/api/import-leads', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ dryRun: false, updateExisting: true })
                            })
                            const data = await response.json()
                            setImportPreview(data)
                            fetchStatus()
                            alert(`Import complete!\nInserted: ${data.summary?.inserted || 0}\nUpdated: ${data.summary?.updated || 0}\nSkipped: ${data.summary?.skipped || 0}`)
                          } catch (error) {
                            console.error('Import failed:', error)
                          } finally {
                            setIsImporting(false)
                          }
                        }}
                        disabled={isImporting}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Import All Leads
                      </button>
                    </div>

                    {importPreview && (
                      <div className="bg-background/50 rounded-lg p-4 mt-4">
                        <h4 className="font-medium text-foreground mb-3">Import Preview</h4>
                        {importPreview.summary && (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                            <div className="text-center p-2 bg-secondary/50 rounded">
                              <p className="text-xl font-bold text-foreground">{importPreview.summary.totalLeads || importPreview.summary.total || 0}</p>
                              <p className="text-xs text-muted-foreground">Total Leads</p>
                            </div>
                            <div className="text-center p-2 bg-emerald-500/10 rounded">
                              <p className="text-xl font-bold text-emerald-500">{importPreview.summary.toInsert || importPreview.summary.inserted || 0}</p>
                              <p className="text-xs text-muted-foreground">To Insert</p>
                            </div>
                            <div className="text-center p-2 bg-blue-500/10 rounded">
                              <p className="text-xl font-bold text-blue-500">{importPreview.summary.toUpdate || importPreview.summary.updated || 0}</p>
                              <p className="text-xs text-muted-foreground">To Update</p>
                            </div>
                            <div className="text-center p-2 bg-amber-500/10 rounded">
                              <p className="text-xl font-bold text-amber-500">{importPreview.summary.duplicates || importPreview.summary.skipped || 0}</p>
                              <p className="text-xs text-muted-foreground">Duplicates</p>
                            </div>
                            <div className="text-center p-2 bg-rose-500/10 rounded">
                              <p className="text-xl font-bold text-rose-500">{importPreview.summary.failed || 0}</p>
                              <p className="text-xs text-muted-foreground">Failed</p>
                            </div>
                          </div>
                        )}
                        
                        {importPreview.preview && (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {(importPreview.preview.insert || []).slice(0, 5).map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-600 rounded text-xs">INSERT</span>
                                <span className="text-foreground">{item.name}</span>
                              </div>
                            ))}
                            {(importPreview.preview.update || []).slice(0, 5).map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-600 rounded text-xs">UPDATE</span>
                                <span className="text-foreground">{item.name}</span>
                                <span className="text-muted-foreground">-&gt; {item.existingName}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-secondary/30 rounded-xl p-5">
                    <h4 className="font-semibold text-foreground mb-4">Post-Import Actions</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      After importing, run these actions to complete the data:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={triggerGeocoding}
                        disabled={isGeocoding}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 rounded-lg hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                      >
                        {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        Geocode Addresses
                      </button>
                      <button
                        onClick={triggerImageUpdate}
                        disabled={isUpdatingImages}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-600 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
                      >
                        {isUpdatingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                        Fetch Street View
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/fix-names', { 
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fixAll: true, limit: 200 })
                            })
                            const data = await response.json()
                            alert(`Fixed ${data.fixed} property names`)
                          } catch (error) {
                            console.error('Fix names failed:', error)
                          }
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-lg hover:bg-amber-500/20 transition-colors"
                      >
                        <Building2 className="w-4 h-4" />
                        Verify Names
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Properties Tab */}
              {activeTab === 'properties' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px] relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search properties by name, city, or address..."
                        value={propertySearch}
                        onChange={(e) => setPropertySearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchProperties(propertySearch)}
                        className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <button
                      onClick={() => fetchProperties(propertySearch)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Search
                    </button>
                    <button
                      onClick={() => exportProperties('csv', false)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-600 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProperty(null)
                        setEditForm({ status: 'active', mom_pop: true })
                        setIsEditingProperty(true)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Property
                    </button>
                  </div>

                  {/* Bulk Actions Bar */}
                  {selectedPropertyIds.length > 0 && !isEditingProperty && (
                    <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                      <span className="text-sm font-medium text-foreground">
                        {selectedPropertyIds.length} selected
                      </span>
                      <button
                        onClick={() => setIsBulkEditing(true)}
                        className="px-3 py-1.5 text-sm bg-blue-500/20 text-blue-600 rounded hover:bg-blue-500/30 transition-colors"
                      >
                        Bulk Edit
                      </button>
                      <button
                        onClick={bulkDeleteProperties}
                        className="px-3 py-1.5 text-sm bg-red-500/20 text-red-600 rounded hover:bg-red-500/30 transition-colors"
                      >
                        Delete Selected
                      </button>
                      <button
                        onClick={() => exportProperties('csv', true)}
                        className="px-3 py-1.5 text-sm bg-emerald-500/20 text-emerald-600 rounded hover:bg-emerald-500/30 transition-colors"
                      >
                        Export Selected
                      </button>
                      <button
                        onClick={() => setSelectedPropertyIds([])}
                        className="ml-auto px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}

                  {/* Bulk Edit Form */}
                  {isBulkEditing && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                      <h4 className="font-medium text-foreground mb-3">Bulk Edit {selectedPropertyIds.length} Properties</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Status</label>
                          <select
                            value={String(bulkEditForm.status || '')}
                            onChange={(e) => setBulkEditForm({ ...bulkEditForm, status: e.target.value || undefined })}
                            className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded text-foreground"
                          >
                            <option value="">No change</option>
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="sold">Sold</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Mom & Pop</label>
                          <select
                            value={bulkEditForm.mom_pop === undefined ? '' : String(bulkEditForm.mom_pop)}
                            onChange={(e) => setBulkEditForm({ ...bulkEditForm, mom_pop: e.target.value === '' ? undefined : e.target.value === 'true' })}
                            className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded text-foreground"
                          >
                            <option value="">No change</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Source</label>
                          <input
                            type="text"
                            placeholder="No change"
                            value={String(bulkEditForm.source || '')}
                            onChange={(e) => setBulkEditForm({ ...bulkEditForm, source: e.target.value || undefined })}
                            className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded text-foreground"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Lot Rent</label>
                          <input
                            type="number"
                            placeholder="No change"
                            value={String(bulkEditForm.lot_rent || '')}
                            onChange={(e) => setBulkEditForm({ ...bulkEditForm, lot_rent: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded text-foreground"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={bulkUpdateProperties}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Apply Changes
                        </button>
                        <button
                          onClick={() => { setIsBulkEditing(false); setBulkEditForm({}) }}
                          className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {isEditingProperty ? (
                    <div className="bg-secondary/30 rounded-xl p-6 border border-border">
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        {selectedProperty?.id ? 'Edit Property' : 'Add New Property'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Name *</label>
                          <input
                            type="text"
                            value={String(editForm.name || '')}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="Property name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">City *</label>
                          <input
                            type="text"
                            value={String(editForm.city || '')}
                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">State *</label>
                          <input
                            type="text"
                            value={String(editForm.state || '')}
                            onChange={(e) => setEditForm({ ...editForm, state: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="TX"
                            maxLength={2}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm text-muted-foreground mb-1">Address</label>
                          <input
                            type="text"
                            value={String(editForm.address || '')}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="123 Main St"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Units</label>
                          <input
                            type="number"
                            value={String(editForm.units || '')}
                            onChange={(e) => setEditForm({ ...editForm, units: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Asking Price</label>
                          <input
                            type="number"
                            value={String(editForm.asking_price || '')}
                            onChange={(e) => setEditForm({ ...editForm, asking_price: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="5000000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Lot Rent</label>
                          <input
                            type="number"
                            value={String(editForm.lot_rent || '')}
                            onChange={(e) => setEditForm({ ...editForm, lot_rent: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Cap Rate (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={String(editForm.cap_rate || '')}
                            onChange={(e) => setEditForm({ ...editForm, cap_rate: parseFloat(e.target.value) || null })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="7.5"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Occupancy (%)</label>
                          <input
                            type="number"
                            value={String(editForm.occupancy || '')}
                            onChange={(e) => setEditForm({ ...editForm, occupancy: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="95"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">TOH Count</label>
                          <input
                            type="number"
                            value={String(editForm.toh || '')}
                            onChange={(e) => setEditForm({ ...editForm, toh: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="80"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">POH Count</label>
                          <input
                            type="number"
                            value={String(editForm.poh || '')}
                            onChange={(e) => setEditForm({ ...editForm, poh: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="20"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Vacant</label>
                          <input
                            type="number"
                            value={String(editForm.vacant || '')}
                            onChange={(e) => setEditForm({ ...editForm, vacant: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="5"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Contact Email</label>
                          <input
                            type="email"
                            value={String(editForm.contact_email || '')}
                            onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="owner@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Listing URL</label>
                          <input
                            type="url"
                            value={String(editForm.listing_url || '')}
                            onChange={(e) => setEditForm({ ...editForm, listing_url: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Source</label>
                          <input
                            type="text"
                            value={String(editForm.source || '')}
                            onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                            placeholder="Manual Entry"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-sm text-muted-foreground mb-1">Notes</label>
                          <textarea
                            value={String(editForm.notes || '')}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground min-h-[80px]"
                            placeholder="Additional notes..."
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                        <button
                          onClick={() => {
                            setIsEditingProperty(false)
                            setSelectedProperty(null)
                            setEditForm({})
                          }}
                          className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveProperty}
                          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          {selectedProperty?.id ? 'Update Property' : 'Create Property'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {propertiesList.length > 0 && (
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                          <input
                            type="checkbox"
                            checked={selectedPropertyIds.length === propertiesList.length && propertiesList.length > 0}
                            onChange={selectAllProperties}
                            className="w-4 h-4 rounded border-border"
                          />
                          <span className="text-sm text-muted-foreground">
                            Select All ({propertiesList.length})
                          </span>
                        </div>
                      )}
                      {propertiesList.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No properties found. Search or add a new property.</p>
                        </div>
                      ) : (
                        propertiesList.map((property) => (
                          <div
                            key={String(property.id)}
                            className={`flex items-center gap-3 p-4 bg-secondary/30 rounded-lg border transition-colors ${
                              selectedPropertyIds.includes(String(property.id)) 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPropertyIds.includes(String(property.id))}
                              onChange={() => togglePropertySelection(String(property.id))}
                              className="w-4 h-4 rounded border-border"
                            />
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground">{String(property.name)}</h4>
                              <p className="text-sm text-muted-foreground">
                                {String(property.city)}, {String(property.state)} - {String(property.units)} units
                                {property.asking_price ? ` - $${Number(property.asking_price).toLocaleString()}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {property.listing_url ? (
                                <a
                                  href={String(property.listing_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <Link className="w-4 h-4" />
                                </a>
                              ) : null}
                              <button
                                onClick={() => runAiTask('analyze_property', [String(property.id)])}
                                className="p-2 text-muted-foreground hover:text-purple-500 transition-colors"
                                title="AI Analyze"
                              >
                                <Bot className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProperty(property)
                                  setEditForm(property)
                                  setIsEditingProperty(true)
                                }}
                                className="p-2 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteProperty(String(property.id))}
                                className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* AI Tasks Tab */}
              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
                    <h3 className="font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2">
                      <Bot className="w-5 h-5" />
                      AI-Powered Tasks
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use AI to analyze properties, generate reports, enrich data, and automate repetitive tasks.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">Select Task</label>
                        <select
                          value={selectedAiTask}
                          onChange={(e) => setSelectedAiTask(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                        >
                          <option value="analyze_property">Analyze Property</option>
                          <option value="generate_description">Generate Description</option>
                          <option value="find_listing_url">Find Listing URL</option>
                          <option value="enrich_data">Enrich Data</option>
                          <option value="market_analysis">Market Analysis</option>
                          <option value="investment_score">Calculate Investment Score</option>
                          <option value="compare_properties">Compare Properties</option>
                          <option value="generate_report">Generate Report</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={() => runAiTask(selectedAiTask, selectedProperty ? [String(selectedProperty.id)] : undefined)}
                          disabled={aiTaskRunning}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
                        >
                          {aiTaskRunning ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Run Task
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Task Descriptions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      {[
                        { id: 'analyze_property', name: 'Analyze', icon: <Target className="w-4 h-4" />, color: 'text-blue-500' },
                        { id: 'generate_description', name: 'Description', icon: <FileText className="w-4 h-4" />, color: 'text-emerald-500' },
                        { id: 'investment_score', name: 'Score', icon: <BarChart3 className="w-4 h-4" />, color: 'text-amber-500' },
                        { id: 'generate_report', name: 'Report', icon: <FileText className="w-4 h-4" />, color: 'text-cyan-500' },
                      ].map(task => (
                        <button
                          key={task.id}
                          onClick={() => {
                            setSelectedAiTask(task.id)
                            runAiTask(task.id)
                          }}
                          disabled={aiTaskRunning}
                          className={`flex items-center justify-center gap-2 p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 ${task.color}`}
                        >
                          {task.icon}
                          <span className="text-sm">{task.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* AI Result Display */}
                    {aiTaskResult && (
                      <div className="bg-background/50 rounded-lg p-4 border border-border">
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Task Result
                        </h4>
                        {'error' in aiTaskResult ? (
                          <p className="text-red-500">{String(aiTaskResult.message || 'Task failed')}</p>
                        ) : (
                          <div className="space-y-3">
                            {aiTaskResult.result && typeof aiTaskResult.result === 'object' && !Array.isArray(aiTaskResult.result) ? (
                              <>
                                {(aiTaskResult.result as Record<string, unknown>).analysis ? (
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm text-foreground bg-secondary/50 p-3 rounded-lg overflow-auto max-h-96">
                                      {String((aiTaskResult.result as Record<string, unknown>).analysis)}
                                    </pre>
                                  </div>
                                ) : null}
                                {(aiTaskResult.result as Record<string, unknown>).description ? (
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm text-foreground bg-secondary/50 p-3 rounded-lg overflow-auto max-h-96">
                                      {String((aiTaskResult.result as Record<string, unknown>).description)}
                                    </pre>
                                  </div>
                                ) : null}
                                {(aiTaskResult.result as Record<string, unknown>).report ? (
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm text-foreground bg-secondary/50 p-3 rounded-lg overflow-auto max-h-96">
                                      {String((aiTaskResult.result as Record<string, unknown>).report)}
                                    </pre>
                                  </div>
                                ) : null}
                                {(aiTaskResult.result as Record<string, unknown>).score !== undefined ? (
                                  <div className="flex items-center gap-4">
                                    <div className="text-center">
                                      <p className="text-3xl font-bold text-foreground">{String((aiTaskResult.result as Record<string, unknown>).score)}</p>
                                      <p className="text-sm text-muted-foreground">Score</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-3xl font-bold text-foreground">{String((aiTaskResult.result as Record<string, unknown>).grade)}</p>
                                      <p className="text-sm text-muted-foreground">Grade</p>
                                    </div>
                                  </div>
                                ) : null}
                                {(aiTaskResult.result as Record<string, unknown>).searchUrls ? (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">Search URLs:</p>
                                    {((aiTaskResult.result as Record<string, unknown>).searchUrls as Array<{ name: string; url: string }>).map((url, i) => (
                                      <a
                                        key={i}
                                        href={url.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        {url.name}
                                      </a>
                                    ))}
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Real Estate Sources */}
                  <div className="bg-secondary/30 rounded-xl p-5 border border-border">
                    <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-500" />
                      Real Estate Listing Sources
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Search for MHC listings across multiple platforms:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { name: 'MHVillage', url: 'https://www.mhvillage.com/Search?type=community', color: 'bg-emerald-500/10 text-emerald-600' },
                        { name: 'LoopNet', url: 'https://www.loopnet.com/search/mobile-home-parks/for-sale/', color: 'bg-blue-500/10 text-blue-600' },
                        { name: 'Crexi', url: 'https://www.crexi.com/properties?asset=Mobile%20Home%20Parks', color: 'bg-purple-500/10 text-purple-600' },
                        { name: 'MHP Store', url: 'https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/', color: 'bg-amber-500/10 text-amber-600' },
                      ].map(source => (
                        <a
                          key={source.name}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center gap-2 p-3 rounded-lg hover:opacity-80 transition-opacity ${source.color}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          {source.name}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Log Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" />
                      Activity Log
                    </h3>
                    <button
                      onClick={fetchActivityLogs}
                      disabled={isLoadingLogs}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {isLoadingLogs ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Refresh
                    </button>
                  </div>

                  <div className="bg-secondary/30 rounded-xl border border-border overflow-hidden">
                    {activityLogs.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No activity logged yet.</p>
                        <button
                          onClick={fetchActivityLogs}
                          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          Load Activity Log
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                        {activityLogs.map((log) => {
                          const actionStr = String(log.action || '')
                          const actionDisplay = actionStr.split('_').join(' ').toUpperCase()
                          const entityName = log.entity_name ? String(log.entity_name) : null
                          const createdAt = log.created_at ? new Date(String(log.created_at)).toLocaleString() : 'Unknown'
                          
                          let iconBgClass = 'bg-secondary text-muted-foreground'
                          if (actionStr === 'create') iconBgClass = 'bg-emerald-500/20 text-emerald-600'
                          else if (actionStr === 'update') iconBgClass = 'bg-blue-500/20 text-blue-600'
                          else if (actionStr === 'delete' || actionStr === 'bulk_delete') iconBgClass = 'bg-red-500/20 text-red-600'
                          else if (actionStr === 'bulk_update') iconBgClass = 'bg-purple-500/20 text-purple-600'
                          else if (actionStr === 'export') iconBgClass = 'bg-cyan-500/20 text-cyan-600'
                          
                          return (
                            <div key={String(log.id)} className="p-4 hover:bg-secondary/50 transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg ${iconBgClass}`}>
                                    {actionStr === 'create' && <Plus className="w-4 h-4" />}
                                    {actionStr === 'update' && <Pencil className="w-4 h-4" />}
                                    {(actionStr === 'delete' || actionStr === 'bulk_delete') && <Trash2 className="w-4 h-4" />}
                                    {actionStr === 'bulk_update' && <Settings className="w-4 h-4" />}
                                    {actionStr === 'export' && <FileText className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {actionDisplay}{entityName ? `: ${entityName}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {createdAt}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
