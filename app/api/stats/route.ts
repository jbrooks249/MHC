import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface PropertyStats {
  // Core counts
  totalProperties: number
  activeListings: number
  soldProperties: number
  pendingProperties: number
  
  // Data quality
  propertiesWithImages: number
  propertiesWithStreetView: number
  propertiesWithCoordinates: number
  propertiesWithAddress: number
  propertiesWithCapRate: number
  propertiesWithOccupancy: number
  propertiesWithLotRent: number
  
  // Data completeness score (0-100)
  dataCompletenessScore: number
  
  // Financial metrics
  totalValue: number
  averagePrice: number
  averageCapRate: number
  averagePricePerUnit: number
  averageLotRent: number
  
  // Geographic distribution
  stateDistribution: Record<string, number>
  regionDistribution: Record<string, number>
  
  // Source breakdown
  sourceDistribution: Record<string, number>
  
  // Image stats
  imageStats: {
    streetView: number
    satellite: number
    listing: number
    placeholder: number
    none: number
  }
  
  // Recent activity
  lastScrapeTime: string | null
  propertiesAddedLast24h: number
  propertiesAddedLastWeek: number
  
  // Quality indicators
  verifiedAddresses: number
  momPopCount: number
  highScoreCount: number // ai_score >= 80
}

export async function GET() {
  try {
    // Get total counts with different filters
    const [
      totalResult,
      activeResult,
      soldResult,
      pendingResult,
      withImagesResult,
      withCoordsResult,
      withAddressResult,
      withCapRateResult,
      withOccupancyResult,
      withLotRentResult,
      momPopResult,
      highScoreResult,
    ] = await Promise.all([
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('properties').select('*', { count: 'exact', head: true }).not('image_url', 'is', null),
      supabase.from('properties').select('*', { count: 'exact', head: true }).not('latitude', 'is', null).not('longitude', 'is', null),
      supabase.from('properties').select('*', { count: 'exact', head: true }).not('address', 'is', null),
      supabase.from('properties').select('*', { count: 'exact', head: true }).not('cap_rate', 'is', null),
      supabase.from('properties').select('*', { count: 'exact', head: true }).not('occupancy', 'is', null),
      supabase.from('properties').select('*', { count: 'exact', head: true }).not('lot_rent', 'is', null),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('mom_pop', true),
      supabase.from('properties').select('*', { count: 'exact', head: true }).gte('ai_score', 80),
    ])

    const totalProperties = totalResult.count || 0

    // Get financial aggregates
    const { data: financialData } = await supabase
      .from('properties')
      .select('asking_price, cap_rate, units, lot_rent')
      .not('asking_price', 'is', null)

    let totalValue = 0
    let totalCapRate = 0
    let capRateCount = 0
    let totalPricePerUnit = 0
    let pricePerUnitCount = 0
    let totalLotRent = 0
    let lotRentCount = 0

    if (financialData) {
      for (const prop of financialData) {
        if (prop.asking_price) {
          totalValue += prop.asking_price
        }
        if (prop.cap_rate) {
          totalCapRate += prop.cap_rate
          capRateCount++
        }
        if (prop.asking_price && prop.units && prop.units > 0) {
          totalPricePerUnit += prop.asking_price / prop.units
          pricePerUnitCount++
        }
        if (prop.lot_rent) {
          totalLotRent += prop.lot_rent
          lotRentCount++
        }
      }
    }

    // Get state distribution
    const { data: stateData } = await supabase
      .from('properties')
      .select('state')
    
    const stateDistribution: Record<string, number> = {}
    if (stateData) {
      for (const prop of stateData) {
        if (prop.state) {
          stateDistribution[prop.state] = (stateDistribution[prop.state] || 0) + 1
        }
      }
    }

    // Get region distribution
    const { data: regionData } = await supabase
      .from('properties')
      .select('region')
    
    const regionDistribution: Record<string, number> = {}
    if (regionData) {
      for (const prop of regionData) {
        const region = prop.region || 'Unknown'
        regionDistribution[region] = (regionDistribution[region] || 0) + 1
      }
    }

    // Get source distribution
    const { data: sourceData } = await supabase
      .from('properties')
      .select('source')
    
    const sourceDistribution: Record<string, number> = {}
    if (sourceData) {
      for (const prop of sourceData) {
        const source = prop.source || 'Unknown'
        sourceDistribution[source] = (sourceDistribution[source] || 0) + 1
      }
    }

    // Get image type distribution
    const { data: imageData } = await supabase
      .from('properties')
      .select('image_url')
    
    const imageStats = {
      streetView: 0,
      satellite: 0,
      listing: 0,
      placeholder: 0,
      none: 0
    }

    if (imageData) {
      for (const prop of imageData) {
        if (!prop.image_url) {
          imageStats.none++
        } else if (prop.image_url.includes('streetview')) {
          imageStats.streetView++
        } else if (prop.image_url.includes('staticmap')) {
          imageStats.satellite++
        } else if (prop.image_url.includes('unsplash') || prop.image_url.includes('placeholder')) {
          imageStats.placeholder++
        } else {
          imageStats.listing++
        }
      }
    }

    // Get recent activity
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [last24hResult, lastWeekResult] = await Promise.all([
      supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString()),
      supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastWeek.toISOString()),
    ])

    // Get last scrape time
    const { data: lastJob } = await supabase
      .from('scrape_jobs')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    // Calculate data completeness score
    const completenessFactors = [
      (withImagesResult.count || 0) / Math.max(1, totalProperties),
      (withCoordsResult.count || 0) / Math.max(1, totalProperties),
      (withAddressResult.count || 0) / Math.max(1, totalProperties),
      (withCapRateResult.count || 0) / Math.max(1, totalProperties),
      (withOccupancyResult.count || 0) / Math.max(1, totalProperties),
      (withLotRentResult.count || 0) / Math.max(1, totalProperties),
    ]
    const dataCompletenessScore = Math.round(
      (completenessFactors.reduce((a, b) => a + b, 0) / completenessFactors.length) * 100
    )

    // Count Street View images specifically
    const propertiesWithStreetView = imageStats.streetView

    const stats: PropertyStats = {
      // Core counts
      totalProperties,
      activeListings: activeResult.count || 0,
      soldProperties: soldResult.count || 0,
      pendingProperties: pendingResult.count || 0,
      
      // Data quality
      propertiesWithImages: withImagesResult.count || 0,
      propertiesWithStreetView,
      propertiesWithCoordinates: withCoordsResult.count || 0,
      propertiesWithAddress: withAddressResult.count || 0,
      propertiesWithCapRate: withCapRateResult.count || 0,
      propertiesWithOccupancy: withOccupancyResult.count || 0,
      propertiesWithLotRent: withLotRentResult.count || 0,
      
      // Data completeness score
      dataCompletenessScore,
      
      // Financial metrics
      totalValue,
      averagePrice: financialData?.length ? Math.round(totalValue / financialData.length) : 0,
      averageCapRate: capRateCount > 0 ? Math.round((totalCapRate / capRateCount) * 10) / 10 : 0,
      averagePricePerUnit: pricePerUnitCount > 0 ? Math.round(totalPricePerUnit / pricePerUnitCount) : 0,
      averageLotRent: lotRentCount > 0 ? Math.round(totalLotRent / lotRentCount) : 0,
      
      // Geographic distribution
      stateDistribution,
      regionDistribution,
      
      // Source breakdown
      sourceDistribution,
      
      // Image stats
      imageStats,
      
      // Recent activity
      lastScrapeTime: lastJob?.completed_at || null,
      propertiesAddedLast24h: last24hResult.count || 0,
      propertiesAddedLastWeek: lastWeekResult.count || 0,
      
      // Quality indicators
      verifiedAddresses: withCoordsResult.count || 0,
      momPopCount: momPopResult.count || 0,
      highScoreCount: highScoreResult.count || 0,
    }

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Stats error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: 'Failed to fetch stats',
      message: errorMessage
    }, { status: 500 })
  }
}
