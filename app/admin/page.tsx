'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Property } from '@/lib/types'
import { 
  Building2, 
  RefreshCw, 
  Database, 
  TrendingUp, 
  MapPin,
  Users,
  DollarSign,
  Sparkles,
  ArrowLeft,
  Search,
  Download,
  Trash2,
  Plus,
  Globe,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import Link from 'next/link'

interface ScrapingSource {
  id: string
  name: string
  url: string
  lastScraped: string | null
  status: 'active' | 'error' | 'pending'
  propertiesCount: number
}

const SCRAPING_SOURCES: ScrapingSource[] = [
  { id: 'mhvillage', name: 'MHVillage', url: 'https://mhvillage.com', lastScraped: new Date().toISOString(), status: 'active', propertiesCount: 0 },
  { id: 'loopnet', name: 'LoopNet', url: 'https://loopnet.com', lastScraped: new Date().toISOString(), status: 'active', propertiesCount: 0 },
  { id: 'crexi', name: 'Crexi', url: 'https://crexi.com', lastScraped: new Date().toISOString(), status: 'active', propertiesCount: 0 },
  { id: 'century21', name: 'Century 21', url: 'https://commercial.century21.com', lastScraped: new Date().toISOString(), status: 'active', propertiesCount: 0 },
  { id: 'realmo', name: 'Realmo', url: 'https://realmo.com', lastScraped: new Date().toISOString(), status: 'active', propertiesCount: 0 },
  { id: 'nwparks', name: 'NW Parks Brokerage', url: 'https://nwparks.com', lastScraped: new Date().toISOString(), status: 'active', propertiesCount: 0 },
]

interface Stats {
  totalProperties: number
  totalUnits: number
  totalValue: number
  statesCovered: number
  momPopCount: number
  avgAiScore: number
  avgCapRate: number
  sourceBreakdown: { source: string; count: number }[]
  regionBreakdown: { region: string; count: number }[]
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [sources, setSources] = useState<ScrapingSource[]>(SCRAPING_SOURCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isScrapingAll, setIsScrapingAll] = useState(false)
  const [recentProperties, setRecentProperties] = useState<Property[]>([])

  const fetchStats = useCallback(async () => {
    try {
      const supabase = createClient()
      
      // Fetch aggregate stats
      const { data: statsData } = await supabase
        .from('properties')
        .select('*')
      
      if (statsData) {
        const totalValue = statsData.reduce((sum, p) => sum + (p.asking_price || 0), 0)
        const totalUnits = statsData.reduce((sum, p) => sum + p.units, 0)
        const statesCovered = new Set(statsData.map(p => p.state)).size
        const momPopCount = statsData.filter(p => p.mom_pop).length
        const avgAiScore = statsData.reduce((sum, p) => sum + (p.ai_score || 0), 0) / statsData.length
        const avgCapRate = statsData.reduce((sum, p) => sum + (p.cap_rate || 0), 0) / statsData.length
        
        // Source breakdown
        const sourceMap = new Map<string, number>()
        statsData.forEach(p => {
          const source = p.source || 'Unknown'
          sourceMap.set(source, (sourceMap.get(source) || 0) + 1)
        })
        const sourceBreakdown = Array.from(sourceMap.entries())
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count)
        
        // Region breakdown
        const regionMap = new Map<string, number>()
        statsData.forEach(p => {
          const region = p.region || 'Unknown'
          regionMap.set(region, (regionMap.get(region) || 0) + 1)
        })
        const regionBreakdown = Array.from(regionMap.entries())
          .map(([region, count]) => ({ region, count }))
          .sort((a, b) => b.count - a.count)
        
        setStats({
          totalProperties: statsData.length,
          totalUnits,
          totalValue,
          statesCovered,
          momPopCount,
          avgAiScore,
          avgCapRate,
          sourceBreakdown,
          regionBreakdown
        })
        
        // Update source counts
        setSources(prev => prev.map(s => ({
          ...s,
          propertiesCount: sourceMap.get(s.name) || 0
        })))
        
        // Get recent properties
        setRecentProperties(statsData.slice(0, 10))
      }
    } catch (error) {
      console.error('[v0] Error fetching stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleScrapeAll = async () => {
    setIsScrapingAll(true)
    // Simulate scraping delay
    await new Promise(resolve => setTimeout(resolve, 3000))
    await fetchStats()
    setIsScrapingAll(false)
  }

  const formatPrice = (price: number): string => {
    if (price >= 1000000000) return `$${(price / 1000000000).toFixed(1)}B`
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`
    return `$${(price / 1000).toFixed(0)}K`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
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
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back to Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Database className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Data Management</h1>
                  <p className="text-sm text-muted-foreground">Scraping & Analytics</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleScrapeAll}
              disabled={isScrapingAll}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isScrapingAll ? 'animate-spin' : ''}`} />
              {isScrapingAll ? 'Scraping...' : 'Refresh All Sources'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-medium">Properties</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.totalProperties}</p>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Total Units</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.totalUnits.toLocaleString()}</p>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Total Value</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatPrice(stats?.totalValue || 0)}</p>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-medium">States</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.statesCovered}</p>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-medium">Avg AI Score</span>
            </div>
            <p className="text-2xl font-bold text-score-high">{stats?.avgAiScore.toFixed(1)}</p>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Cap Rate</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.avgCapRate.toFixed(2)}%</p>
          </div>
          
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Mom & Pop</span>
            </div>
            <p className="text-2xl font-bold text-accent">{stats?.momPopCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scraping Sources */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl border border-border">
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-foreground">Data Sources</h2>
                  </div>
                  <span className="text-sm text-muted-foreground">{sources.length} sources configured</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {sources.map(source => (
                  <div key={source.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        source.status === 'active' ? 'bg-score-high' : 
                        source.status === 'error' ? 'bg-score-low' : 'bg-score-medium'
                      }`} />
                      <div>
                        <p className="font-medium text-foreground">{source.name}</p>
                        <p className="text-sm text-muted-foreground">{source.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{source.propertiesCount}</p>
                        <p className="text-xs text-muted-foreground">properties</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {source.status === 'active' ? (
                          <CheckCircle2 className="w-4 h-4 text-score-high" />
                        ) : source.status === 'error' ? (
                          <XCircle className="w-4 h-4 text-score-low" />
                        ) : (
                          <Clock className="w-4 h-4 text-score-medium" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Region Breakdown */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">By Region</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {stats?.regionBreakdown.map(({ region, count }) => (
                  <div key={region} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{region}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(count / (stats?.totalProperties || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="mt-6 bg-card rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Properties by Source</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {stats?.sourceBreakdown.map(({ source, count }) => (
                <div key={source} className="bg-secondary/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-sm text-muted-foreground truncate">{source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Export Actions */}
        <div className="mt-6 flex items-center gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors">
            <Download className="w-4 h-4" />
            Export to CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors">
            <Download className="w-4 h-4" />
            Export to JSON
          </button>
        </div>
      </main>
    </div>
  )
}
