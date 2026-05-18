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
  ExternalLink
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
  avgDataQuality: number
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

type TabType = 'overview' | 'sources' | 'scraper' | 'quality' | 'images'

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
  const [scrapeResult, setScrapeResult] = useState<Record<string, unknown> | null>(null)
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<string[]>([])
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
      const response = await fetch('/api/scrape')
      const data = await response.json()
      setJobs(data.recentJobs || [])
      setStats(data.stats || null)
      setSources(data.sources || [])
    } catch (error) {
      console.error('Failed to fetch scrape status:', error)
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
    { id: 'sources', label: 'Sources', icon: <Globe className="w-4 h-4" /> },
    { id: 'scraper', label: 'Scraper', icon: <Zap className="w-4 h-4" /> },
    { id: 'quality', label: 'Data Quality', icon: <Shield className="w-4 h-4" /> },
    { id: 'images', label: 'Images', icon: <Image className="w-4 h-4" /> },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Data Control Center</h2>
              <p className="text-sm text-muted-foreground">Manage scraping, data quality, and enrichment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <XCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-border shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
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

        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  {stats && (
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
                          <MapPin className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-muted-foreground">With Coordinates</span>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{stats.propertiesWithCoords?.toLocaleString() || 'N/A'}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Image className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-muted-foreground">With Images</span>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{stats.propertiesWithImages?.toLocaleString() || 'N/A'}</p>
                      </div>
                    </div>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
