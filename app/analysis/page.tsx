'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Property } from '@/lib/types'
import Link from 'next/link'

export default function AnalysisPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('properties')
          .select('*')
          .order('ai_score', { ascending: false })
        
        setProperties(data ?? [])
      } catch (error) {
        console.error('Error fetching properties:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProperties()
  }, [])

  // Calculate statistics
  const stats = useMemo(() => {
    if (properties.length === 0) {
      return {
        total: 0,
        totalUnits: 0,
        totalValue: 0,
        avgCapRate: 0,
        avgOccupancy: 0,
        momPopCount: 0,
        byState: {},
        scoreDistribution: { elite: 0, strong: 0, moderate: 0, fair: 0 }
      }
    }

    const totalUnits = properties.reduce((sum, p) => sum + p.units, 0)
    const totalValue = properties.reduce((sum, p) => sum + (p.asking_price || 0), 0)
    const avgCapRate = properties.reduce((sum, p) => sum + (p.cap_rate || 0), 0) / properties.length
    const avgOccupancy = properties.reduce((sum, p) => sum + (p.occupancy || 0), 0) / properties.length
    const momPopCount = properties.filter(p => p.mom_pop).length

    // Group by state
    const byState: Record<string, { count: number; units: number; avgScore: number }> = {}
    properties.forEach(prop => {
      if (!byState[prop.state]) {
        byState[prop.state] = { count: 0, units: 0, avgScore: 0 }
      }
      byState[prop.state].count += 1
      byState[prop.state].units += prop.units
      byState[prop.state].avgScore += (prop.ai_score || 0)
    })

    Object.keys(byState).forEach(state => {
      byState[state].avgScore = byState[state].avgScore / byState[state].count
    })

    // Score distribution
    const scoreDistribution = {
      elite: properties.filter(p => (p.ai_score || 0) >= 85).length,
      strong: properties.filter(p => (p.ai_score || 0) >= 70 && (p.ai_score || 0) < 85).length,
      moderate: properties.filter(p => (p.ai_score || 0) >= 50 && (p.ai_score || 0) < 70).length,
      fair: properties.filter(p => (p.ai_score || 0) < 50).length,
    }

    return {
      total: properties.length,
      totalUnits,
      totalValue,
      avgCapRate,
      avgOccupancy,
      momPopCount,
      byState,
      scoreDistribution
    }
  }, [properties])

  const topStates = useMemo(() => {
    return Object.entries(stats.byState)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
  }, [stats.byState])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Market Analysis</h1>
              <p className="mt-1 text-slate-400">USA-wide MHC acquisition intelligence</p>
            </div>
            <Link 
              href="/" 
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
            >
              Back to Listings
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-lg text-slate-400">Loading market data...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Key Metrics */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Market Overview</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-4 py-3">
                  <p className="text-sm text-slate-400">Total Properties</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.total}</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-4 py-3">
                  <p className="text-sm text-slate-400">Total Units</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.totalUnits.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-4 py-3">
                  <p className="text-sm text-slate-400">Total Value</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    ${(stats.totalValue / 1_000_000).toFixed(0)}M
                  </p>
                </div>
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-4 py-3">
                  <p className="text-sm text-slate-400">Avg Cap Rate</p>
                  <p className="text-2xl font-bold text-pink-400">{stats.avgCapRate.toFixed(2)}%</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-4 py-3">
                  <p className="text-sm text-slate-400">Avg Occupancy</p>
                  <p className="text-2xl font-bold text-cyan-400">{stats.avgOccupancy.toFixed(1)}%</p>
                </div>
              </div>
            </section>

            {/* Score Distribution */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">AI Score Distribution</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-emerald-500/20 border border-emerald-500/50 px-4 py-3">
                  <p className="text-sm text-emerald-400">Elite (85+)</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.scoreDistribution.elite}</p>
                </div>
                <div className="rounded-lg bg-blue-500/20 border border-blue-500/50 px-4 py-3">
                  <p className="text-sm text-blue-400">Strong (70-84)</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.scoreDistribution.strong}</p>
                </div>
                <div className="rounded-lg bg-yellow-500/20 border border-yellow-500/50 px-4 py-3">
                  <p className="text-sm text-yellow-400">Moderate (50-69)</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.scoreDistribution.moderate}</p>
                </div>
                <div className="rounded-lg bg-slate-500/20 border border-slate-500/50 px-4 py-3">
                  <p className="text-sm text-slate-400">{"Fair (<50)"}</p>
                  <p className="text-2xl font-bold text-slate-400">{stats.scoreDistribution.fair}</p>
                </div>
              </div>
            </section>

            {/* Top States */}
            {topStates.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Top States</h2>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-700 bg-slate-900/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-slate-400">State</th>
                          <th className="px-4 py-3 text-left text-slate-400">Properties</th>
                          <th className="px-4 py-3 text-left text-slate-400">Total Units</th>
                          <th className="px-4 py-3 text-left text-slate-400">Avg AI Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topStates.map(([state, data]) => (
                          <tr key={state} className="border-b border-slate-700 hover:bg-slate-700/30 transition">
                            <td className="px-4 py-3 font-semibold text-white">{state}</td>
                            <td className="px-4 py-3 text-slate-300">{data.count}</td>
                            <td className="px-4 py-3 text-slate-300">{data.units.toLocaleString()}</td>
                            <td className="px-4 py-3 text-emerald-400 font-semibold">{data.avgScore.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Operator Analysis */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Operator Analysis</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-pink-500/20 border border-pink-500/50 px-6 py-4">
                  <p className="text-sm text-pink-400">Mom & Pop Operators</p>
                  <p className="text-3xl font-bold text-pink-400">{stats.momPopCount}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {stats.total > 0 ? ((stats.momPopCount / stats.total) * 100).toFixed(1) : 0}% of portfolio
                  </p>
                </div>
                <div className="rounded-lg bg-purple-500/20 border border-purple-500/50 px-6 py-4">
                  <p className="text-sm text-purple-400">Institutional Operators</p>
                  <p className="text-3xl font-bold text-purple-400">{stats.total - stats.momPopCount}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {stats.total > 0 ? (((stats.total - stats.momPopCount) / stats.total) * 100).toFixed(1) : 0}% of portfolio
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}
