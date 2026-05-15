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
  MapPin,
  Image,
  Globe,
  Zap,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface ScrapeJob {
  id: string
  source: string
  url: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  listings_found: number
  listings_added: number
  listings_updated: number
  pages_scraped?: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface ScrapeStats {
  totalProperties: number
  activeProperties: number
  verifiedAddresses: number
  verifiedImages: number
  lastScrape: string | null
}

interface SourceInfo {
  name: string
  priority: number
  hasStateUrls: boolean
  maxPages: number
}

interface ScrapeConfig {
  firecrawlConfigured: boolean
  googleMapsConfigured: boolean
  cronConfigured: boolean
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [stats, setStats] = useState<ScrapeStats | null>(null)
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({})
  const [availableSources, setAvailableSources] = useState<SourceInfo[]>([])
  const [config, setConfig] = useState<ScrapeConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<Record<string, unknown> | null>(null)
  
  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [scrapeMode, setScrapeMode] = useState<'full' | 'single' | 'streetview'>('full')
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [deepCrawl, setDeepCrawl] = useState(true)
  const [maxPages, setMaxPages] = useState(20)
  const [priorityThreshold, setPriorityThreshold] = useState(5)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/scrape')
      const data = await response.json()
      setJobs(data.recentJobs || [])
      setStats(data.stats || null)
      setSourceCounts(data.sourceCounts || {})
      setAvailableSources(data.availableSources || [])
      setConfig(data.config || null)
    } catch (error) {
      console.error('Failed to fetch scrape status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const triggerScrape = async () => {
    setIsScraping(true)
    setScrapeResult(null)
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminTrigger: true,
          mode: scrapeMode,
          source: scrapeMode === 'single' ? selectedSource : undefined,
          deepCrawl,
          maxPages,
          priorityThreshold,
        })
      })
      
      const result = await response.json()
      setScrapeResult(result)
      
      // Refresh the job list
      await fetchStatus()
    } catch (error: unknown) {
      setScrapeResult({ error: true, message: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsScraping(false)
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Aggressive Data Scraper</h2>
              <p className="text-sm text-muted-foreground">Comprehensive MHP listing collection with verified addresses</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <XCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Configuration Status */}
          {config && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                config.firecrawlConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
              }`}>
                <Globe className="w-4 h-4" />
                <span>Firecrawl: {config.firecrawlConfigured ? 'Ready' : 'Not configured'}</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                config.googleMapsConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
              }`}>
                <MapPin className="w-4 h-4" />
                <span>Google Maps: {config.googleMapsConfigured ? 'Ready' : 'Optional'}</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                config.cronConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
              }`}>
                <Clock className="w-4 h-4" />
                <span>Cron: {config.cronConfigured ? 'Enabled' : 'Manual only'}</span>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-5 gap-3 mb-6">
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalProperties}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.activeProperties}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Verified Addr</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.verifiedAddresses || 0}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Street View</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.verifiedImages || 0}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Sources</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{Object.keys(sourceCounts).length}</p>
              </div>
            </div>
          )}

          {/* Scrape Controls */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Run Scraper</h3>
                <p className="text-sm text-muted-foreground">
                  Aggressively scrape all MHP listing sources with deep crawling
                </p>
              </div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                Advanced
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-secondary/30 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Mode</label>
                  <select
                    value={scrapeMode}
                    onChange={(e) => setScrapeMode(e.target.value as 'full' | 'single' | 'streetview')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  >
                    <option value="full">Full Scrape (All Sources)</option>
                    <option value="single">Single Source</option>
                    <option value="streetview">Update Street View Only</option>
                  </select>
                </div>
                
                {scrapeMode === 'single' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Source</label>
                    <select
                      value={selectedSource}
                      onChange={(e) => setSelectedSource(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="">Select a source...</option>
                      {availableSources.map(s => (
                        <option key={s.name} value={s.name}>
                          {s.name} (Priority: {s.priority})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Max Pages/Source</label>
                  <input
                    type="number"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 10)}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Min Priority</label>
                  <input
                    type="number"
                    value={priorityThreshold}
                    onChange={(e) => setPriorityThreshold(parseInt(e.target.value) || 0)}
                    min={0}
                    max={10}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deepCrawl}
                      onChange={(e) => setDeepCrawl(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm text-foreground">
                      Deep Crawl (follow pagination + scrape all state URLs)
                    </span>
                  </label>
                </div>
              </div>
            )}

            <button
              onClick={triggerScrape}
              disabled={isScraping || (scrapeMode === 'single' && !selectedSource)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scraping... (this may take several minutes)
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {scrapeMode === 'full' ? 'Run Full Aggressive Scrape' : 
                   scrapeMode === 'single' ? `Scrape ${selectedSource || '...'}` :
                   'Update Street View Images'}
                </>
              )}
            </button>

            {/* Scrape Result */}
            {scrapeResult && (
              <div className={`mt-4 p-4 rounded-lg ${scrapeResult.error ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                {scrapeResult.error ? (
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>{String(scrapeResult.message)}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Scrape completed successfully
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Found:</span>{' '}
                        <span className="font-medium text-foreground">{String(scrapeResult.total_scraped || scrapeResult.totalFound || 0)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Added:</span>{' '}
                        <span className="font-medium text-emerald-500">{String(scrapeResult.total_added || scrapeResult.totalAdded || 0)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Updated:</span>{' '}
                        <span className="font-medium text-blue-500">{String(scrapeResult.total_updated || scrapeResult.totalUpdated || 0)}</span>
                      </div>
                      {scrapeResult.totalPages && (
                        <div>
                          <span className="text-muted-foreground">Pages:</span>{' '}
                          <span className="font-medium text-foreground">{String(scrapeResult.totalPages)}</span>
                        </div>
                      )}
                    </div>
                    {scrapeResult.errors && Array.isArray(scrapeResult.errors) && scrapeResult.errors.length > 0 && (
                      <div className="mt-2 p-2 bg-amber-500/10 rounded text-sm text-amber-500">
                        {scrapeResult.errors.length} error(s) occurred:
                        <ul className="mt-1 list-disc list-inside text-xs">
                          {scrapeResult.errors.slice(0, 5).map((err: string, i: number) => (
                            <li key={i}>{err}</li>
                          ))}
                          {scrapeResult.errors.length > 5 && (
                            <li>...and {scrapeResult.errors.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Source Breakdown */}
          {Object.keys(sourceCounts).length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Listings by Source
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(sourceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg text-sm">
                      <span className="text-foreground truncate">{source}</span>
                      <span className="font-medium text-primary">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Cron Schedule Info */}
          <div className="bg-secondary/30 border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Automatic Updates</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The scraper runs automatically every day at 4:00 AM UTC via Vercel Cron.
              It performs a full aggressive scrape with deep crawling, geocoding, and Street View image verification.
            </p>
          </div>

          {/* Recent Jobs */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Recent Scrape Jobs</h3>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No scrape jobs yet. Click &quot;Run Full Aggressive Scrape&quot; to start.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{job.source}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-sm">
                          {job.url}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {job.status === 'completed' && (
                        <div className="text-muted-foreground">
                          <span className="text-emerald-500">+{job.listings_added}</span>
                          {' / '}
                          <span className="text-blue-500">{job.listings_updated} updated</span>
                          {job.pages_scraped && (
                            <span className="text-muted-foreground"> ({job.pages_scraped} pages)</span>
                          )}
                        </div>
                      )}
                      {job.status === 'failed' && (
                        <div className="text-red-500 text-xs max-w-xs truncate">
                          {job.error_message}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatDate(job.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
