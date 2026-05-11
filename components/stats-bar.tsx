'use client'

import { Property } from '@/lib/types'
import { Building2, DollarSign, TrendingUp, Sparkles } from 'lucide-react'

interface StatsBarProps {
  properties: Property[]
}

function formatPrice(price: number): string {
  if (price >= 1000000000) {
    return `$${(price / 1000000000).toFixed(1)}B`
  }
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`
  }
  return `$${(price / 1000).toFixed(0)}K`
}

export function StatsBar({ properties }: StatsBarProps) {
  const totalProperties = properties.length
  const totalUnits = properties.reduce((sum, p) => sum + p.units, 0)
  const totalValue = properties.reduce((sum, p) => sum + (p.asking_price ?? 0), 0)
  const avgCapRate = properties.length > 0
    ? properties.reduce((sum, p) => sum + (p.cap_rate ?? 0), 0) / properties.filter(p => p.cap_rate).length
    : 0
  const avgAiScore = properties.length > 0
    ? properties.reduce((sum, p) => sum + (p.ai_score ?? 0), 0) / properties.filter(p => p.ai_score).length
    : 0
  const momPopCount = properties.filter(p => p.mom_pop).length

  const stats = [
    {
      label: 'Properties',
      value: totalProperties.toString(),
      icon: Building2,
      color: 'text-primary'
    },
    {
      label: 'Total Units',
      value: totalUnits.toLocaleString(),
      icon: Building2,
      color: 'text-chart-2'
    },
    {
      label: 'Total Value',
      value: formatPrice(totalValue),
      icon: DollarSign,
      color: 'text-chart-3'
    },
    {
      label: 'Avg Cap Rate',
      value: `${avgCapRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-chart-4'
    },
    {
      label: 'Avg AI Score',
      value: avgAiScore.toFixed(0),
      icon: Sparkles,
      color: 'text-score-high'
    },
    {
      label: 'Mom & Pop',
      value: momPopCount.toString(),
      icon: Building2,
      color: 'text-accent'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl border border-border p-4 flex items-center gap-3"
        >
          <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center ${stat.color}`}>
            <stat.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
