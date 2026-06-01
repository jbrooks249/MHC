// Enhanced Scraper - Aggregates all sources and provides scraping utilities
import { SCRAPER_SOURCES, ScraperSource } from './scraper-sources'

// Export all sources for use in other modules
export const ALL_SOURCES = SCRAPER_SOURCES

// Get sources by type
export function getSourcesByType(type: ScraperSource['type']): ScraperSource[] {
  return ALL_SOURCES.filter(s => s.type === type && s.enabled)
}

// Get sources by reliability threshold
export function getReliableSources(minReliability: number = 0.7): ScraperSource[] {
  return ALL_SOURCES.filter(s => s.reliabilityScore >= minReliability && s.enabled)
}

// Get enabled sources
export function getEnabledSources(): ScraperSource[] {
  return ALL_SOURCES.filter(s => s.enabled)
}

// Get sources that don't require authentication
export function getPublicSources(): ScraperSource[] {
  return ALL_SOURCES.filter(s => !s.requiresAuth && s.enabled)
}

// Source statistics
export function getSourceStats() {
  const enabled = ALL_SOURCES.filter(s => s.enabled)
  const byType: Record<string, number> = {}
  
  for (const source of enabled) {
    byType[source.type] = (byType[source.type] || 0) + 1
  }

  return {
    total: ALL_SOURCES.length,
    enabled: enabled.length,
    byType,
    averageReliability: enabled.reduce((a, s) => a + s.reliabilityScore, 0) / enabled.length,
    requiresAuth: enabled.filter(s => s.requiresAuth).length,
    requiresProxy: enabled.filter(s => s.requiresProxy).length
  }
}

// Calculate priority order for scraping
export function getPrioritizedSources(): ScraperSource[] {
  return [...ALL_SOURCES]
    .filter(s => s.enabled)
    .sort((a, b) => {
      // Primary sources first
      const typeOrder: Record<string, number> = {
        'primary': 0,
        'broker': 1,
        'aggregator': 2,
        'auction': 3,
        'regional': 4,
        'news': 5,
        'secondary': 6
      }
      
      const typeCompare = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99)
      if (typeCompare !== 0) return typeCompare
      
      // Then by reliability
      return b.reliabilityScore - a.reliabilityScore
    })
}

// Estimate total URLs to scrape
export function estimateTotalUrls(): number {
  let count = 0
  
  for (const source of getEnabledSources()) {
    for (const pattern of source.searchPatterns) {
      count += 1
      if (pattern.pagination?.maxPages) {
        count += pattern.pagination.maxPages - 1
      }
    }
  }
  
  return count
}

// Export types
export type { ScraperSource } from './scraper-sources'
