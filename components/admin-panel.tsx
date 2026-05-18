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
  History
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
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [stats, setStats] = useState<ScrapeStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<any>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/scrape')
      const data = await response.json()
      setJobs(data.recentJobs || [])
      setStats(data.stats || null)
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
        body: JSON.stringify({ adminTrigger: true })
      })
      
      const result = await response.json()
      setScrapeResult(result)
      
      // Refresh the job list
      await fetchStatus()
    } catch (error: any) {
      setScrapeResult({ error: true, message: error.message })
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
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Data Scraper Admin</h2>
              <p className="text-sm text-muted-foreground">Manage automated MHP listing collection</p>
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
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Properties</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalProperties}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Active Listings</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.activeProperties}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Last Scrape</span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {stats.lastScrape ? formatDate(stats.lastScrape) : 'Never'}
                </p>
              </div>
            </div>
          )}

          {/* Manual Trigger */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Manual Scrape</h3>
                <p className="text-sm text-muted-foreground">
                  Trigger an immediate scrape of all MHP listing sources
                </p>
              </div>
              <button
                onClick={triggerScrape}
                disabled={isScraping}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Now
                  </>
                )}
              </button>
            </div>

            {/* Scrape Result */}
            {scrapeResult && (
              <div className={`mt-4 p-4 rounded-lg ${scrapeResult.error ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                {scrapeResult.error ? (
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>{scrapeResult.message}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Scrape completed successfully
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Found:</span>{' '}
                        <span className="font-medium text-foreground">{scrapeResult.total_scraped}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Added:</span>{' '}
                        <span className="font-medium text-emerald-500">{scrapeResult.total_added}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Updated:</span>{' '}
                        <span className="font-medium text-blue-500">{scrapeResult.total_updated}</span>
                      </div>
                    </div>
                    {scrapeResult.errors?.length > 0 && (
                      <div className="text-sm text-amber-500">
                        {scrapeResult.errors.length} source(s) had errors
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cron Schedule Info */}
          <div className="bg-secondary/30 border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Automatic Updates</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The scraper runs automatically every day at 4:00 AM UTC via Vercel Cron.
              New listings are added and existing ones are updated with fresh data.
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
                No scrape jobs yet. Click &quot;Run Now&quot; to start.
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl"
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
                        <p className="text-xs text-muted-foreground truncate max-w-md">
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
