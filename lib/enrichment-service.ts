// Data Enrichment Service
// Enhances listing data with market analysis, financial metrics, and cross-source validation

import { createClient } from '@supabase/supabase-js'
import { geocodeAddress, getFallbackCoordinates } from './address-validator'
import { Property } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Market data by region (could be expanded with real data sources)
const MARKET_DATA: Record<string, {
  avgCapRate: number
  avgPricePerUnit: number
  avgLotRent: number
  avgOccupancy: number
  marketTrend: 'hot' | 'warm' | 'stable' | 'cooling'
  demandScore: number
}> = {
  'Pacific': { avgCapRate: 5.5, avgPricePerUnit: 120000, avgLotRent: 800, avgOccupancy: 95, marketTrend: 'hot', demandScore: 95 },
  'Pacific NW': { avgCapRate: 6.0, avgPricePerUnit: 95000, avgLotRent: 650, avgOccupancy: 93, marketTrend: 'hot', demandScore: 90 },
  'Southwest': { avgCapRate: 6.5, avgPricePerUnit: 70000, avgLotRent: 550, avgOccupancy: 92, marketTrend: 'warm', demandScore: 85 },
  'Mountain': { avgCapRate: 7.0, avgPricePerUnit: 60000, avgLotRent: 450, avgOccupancy: 90, marketTrend: 'warm', demandScore: 80 },
  'Southeast': { avgCapRate: 7.5, avgPricePerUnit: 50000, avgLotRent: 400, avgOccupancy: 88, marketTrend: 'stable', demandScore: 75 },
  'Midwest': { avgCapRate: 8.0, avgPricePerUnit: 40000, avgLotRent: 350, avgOccupancy: 85, marketTrend: 'stable', demandScore: 70 },
  'Northeast': { avgCapRate: 6.5, avgPricePerUnit: 80000, avgLotRent: 600, avgOccupancy: 90, marketTrend: 'stable', demandScore: 78 },
}

export interface EnrichmentResult {
  propertyId: string
  success: boolean
  enrichments: {
    marketAnalysis?: MarketAnalysis
    financialMetrics?: FinancialMetrics
    riskScore?: RiskScore
    locationData?: LocationData
    dataQuality?: DataQualityMetrics
  }
  errors: string[]
}

export interface MarketAnalysis {
  region: string
  marketTrend: string
  demandScore: number
  priceVsMarket: 'below' | 'at' | 'above'
  capRateVsMarket: 'below' | 'at' | 'above'
  competitivePosition: 'undervalued' | 'fair' | 'overvalued'
  marketRank: number // 1-100 percentile in region
}

export interface FinancialMetrics {
  pricePerUnit: number | null
  impliedNOI: number | null
  grossRentMultiplier: number | null
  cashOnCashReturn: number | null
  breakEvenOccupancy: number | null
  valueAddPotential: number | null
  projectedAppreciation: number | null
}

export interface RiskScore {
  overall: number // 0-100 (higher = lower risk)
  factors: {
    marketRisk: number
    financialRisk: number
    operationalRisk: number
    locationRisk: number
    dataConfidence: number
  }
  warnings: string[]
  opportunities: string[]
}

export interface LocationData {
  latitude: number | null
  longitude: number | null
  geocodingConfidence: number
  nearbyAmenities: string[]
  countyData?: {
    population: number
    medianIncome: number
    unemploymentRate: number
  }
}

export interface DataQualityMetrics {
  overallScore: number
  fieldCompleteness: number
  dataConsistency: number
  sourceReliability: number
  lastVerified: string
  issues: string[]
}

// Enrich a single property
export async function enrichProperty(property: Property): Promise<EnrichmentResult> {
  const errors: string[] = []
  const enrichments: EnrichmentResult['enrichments'] = {}

  try {
    // 1. Market Analysis
    const marketAnalysis = calculateMarketAnalysis(property)
    enrichments.marketAnalysis = marketAnalysis

    // 2. Financial Metrics
    const financialMetrics = calculateFinancialMetrics(property)
    enrichments.financialMetrics = financialMetrics

    // 3. Risk Score
    const riskScore = calculateRiskScore(property, marketAnalysis, financialMetrics)
    enrichments.riskScore = riskScore

    // 4. Location Data (if needed)
    if (!property.latitude || !property.longitude) {
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
      if (googleApiKey && property.address) {
        const geocode = await geocodeAddress(property.address, property.city, property.state, googleApiKey)
        if (geocode) {
          enrichments.locationData = {
            latitude: geocode.latitude,
            longitude: geocode.longitude,
            geocodingConfidence: geocode.confidence,
            nearbyAmenities: []
          }
        }
      }
      
      if (!enrichments.locationData) {
        const fallback = getFallbackCoordinates(property.state)
        if (fallback) {
          enrichments.locationData = {
            latitude: fallback.lat + (Math.random() - 0.5) * 0.5,
            longitude: fallback.lng + (Math.random() - 0.5) * 0.5,
            geocodingConfidence: 0.3,
            nearbyAmenities: []
          }
        }
      }
    }

    // 5. Data Quality
    enrichments.dataQuality = calculateDataQuality(property)

    return {
      propertyId: property.id,
      success: true,
      enrichments,
      errors
    }
  } catch (error) {
    errors.push(`Enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return {
      propertyId: property.id,
      success: false,
      enrichments,
      errors
    }
  }
}

// Calculate market analysis for a property
function calculateMarketAnalysis(property: Property): MarketAnalysis {
  const region = property.region || 'Midwest'
  const marketData = MARKET_DATA[region] || MARKET_DATA['Midwest']

  // Price comparison
  let priceVsMarket: 'below' | 'at' | 'above' = 'at'
  let competitivePosition: 'undervalued' | 'fair' | 'overvalued' = 'fair'
  let marketRank = 50

  if (property.asking_price && property.units) {
    const pricePerUnit = property.asking_price / property.units
    const ratio = pricePerUnit / marketData.avgPricePerUnit

    if (ratio < 0.85) {
      priceVsMarket = 'below'
      competitivePosition = 'undervalued'
      marketRank = Math.max(10, 50 - (0.85 - ratio) * 100)
    } else if (ratio > 1.15) {
      priceVsMarket = 'above'
      competitivePosition = 'overvalued'
      marketRank = Math.min(90, 50 + (ratio - 1.15) * 100)
    }
  }

  // Cap rate comparison
  let capRateVsMarket: 'below' | 'at' | 'above' = 'at'
  if (property.cap_rate) {
    if (property.cap_rate < marketData.avgCapRate - 1) {
      capRateVsMarket = 'below'
    } else if (property.cap_rate > marketData.avgCapRate + 1) {
      capRateVsMarket = 'above'
    }
  }

  return {
    region,
    marketTrend: marketData.marketTrend,
    demandScore: marketData.demandScore,
    priceVsMarket,
    capRateVsMarket,
    competitivePosition,
    marketRank: Math.round(marketRank)
  }
}

// Calculate financial metrics
function calculateFinancialMetrics(property: Property): FinancialMetrics {
  const metrics: FinancialMetrics = {
    pricePerUnit: null,
    impliedNOI: null,
    grossRentMultiplier: null,
    cashOnCashReturn: null,
    breakEvenOccupancy: null,
    valueAddPotential: null,
    projectedAppreciation: null
  }

  if (property.units && property.asking_price) {
    metrics.pricePerUnit = Math.round(property.asking_price / property.units)
  }

  // Calculate implied NOI from cap rate
  if (property.cap_rate && property.asking_price) {
    metrics.impliedNOI = Math.round(property.asking_price * (property.cap_rate / 100))
  }

  // Gross rent multiplier
  if (property.lot_rent && property.units && property.asking_price) {
    const annualRent = property.lot_rent * property.units * 12 * ((property.occupancy || 90) / 100)
    metrics.grossRentMultiplier = Math.round((property.asking_price / annualRent) * 10) / 10
  }

  // Estimate cash on cash (assuming 75% LTV, 6% interest)
  if (metrics.impliedNOI && property.asking_price) {
    const downPayment = property.asking_price * 0.25
    const loanAmount = property.asking_price * 0.75
    const annualDebtService = loanAmount * 0.08 // ~8% debt constant
    const cashFlow = metrics.impliedNOI - annualDebtService
    metrics.cashOnCashReturn = Math.round((cashFlow / downPayment) * 100 * 10) / 10
  }

  // Break-even occupancy
  if (property.lot_rent && property.units && metrics.impliedNOI) {
    const grossPotentialRent = property.lot_rent * property.units * 12
    const operatingExpenseRatio = 0.35 // Assume 35% expense ratio
    const fixedExpenses = grossPotentialRent * operatingExpenseRatio
    metrics.breakEvenOccupancy = Math.round((fixedExpenses / grossPotentialRent) * 100)
  }

  // Value add potential (if occupancy below market)
  if (property.occupancy && property.occupancy < 95 && property.lot_rent && property.units) {
    const vacantUnits = Math.round(property.units * (1 - property.occupancy / 100))
    const additionalNOI = vacantUnits * property.lot_rent * 12 * 0.65 // 65% margin
    metrics.valueAddPotential = additionalNOI
  }

  // Projected appreciation (based on market trend)
  const region = property.region || 'Midwest'
  const marketData = MARKET_DATA[region] || MARKET_DATA['Midwest']
  const appreciationRates: Record<string, number> = {
    'hot': 8, 'warm': 5, 'stable': 3, 'cooling': 1
  }
  metrics.projectedAppreciation = appreciationRates[marketData.marketTrend] || 3

  return metrics
}

// Calculate risk score
function calculateRiskScore(
  property: Property,
  marketAnalysis: MarketAnalysis,
  financialMetrics: FinancialMetrics
): RiskScore {
  const warnings: string[] = []
  const opportunities: string[] = []

  // Market risk (0-100, higher = lower risk)
  let marketRisk = 70
  if (marketAnalysis.marketTrend === 'hot') marketRisk = 90
  else if (marketAnalysis.marketTrend === 'warm') marketRisk = 80
  else if (marketAnalysis.marketTrend === 'cooling') marketRisk = 50

  // Financial risk
  let financialRisk = 70
  if (property.cap_rate) {
    if (property.cap_rate >= 7) {
      financialRisk = 85
      opportunities.push('Strong cap rate provides good cash flow cushion')
    } else if (property.cap_rate < 5) {
      financialRisk = 50
      warnings.push('Low cap rate - limited margin for error')
    }
  } else {
    financialRisk = 60
    warnings.push('Cap rate unknown - financial analysis incomplete')
  }

  if (financialMetrics.cashOnCashReturn && financialMetrics.cashOnCashReturn < 5) {
    financialRisk -= 10
    warnings.push('Estimated cash-on-cash return is low')
  }

  // Operational risk
  let operationalRisk = 70
  if (property.occupancy) {
    if (property.occupancy >= 95) {
      operationalRisk = 90
    } else if (property.occupancy >= 85) {
      operationalRisk = 75
      opportunities.push('Room to increase occupancy')
    } else if (property.occupancy < 75) {
      operationalRisk = 50
      warnings.push('Low occupancy requires significant lease-up effort')
    }
  }

  if (property.units && property.units < 30) {
    operationalRisk -= 10
    warnings.push('Small park may have higher per-unit operating costs')
  }

  // Location risk
  let locationRisk = marketAnalysis.demandScore
  if (property.latitude && property.longitude) {
    locationRisk += 5 // Verified location
  }

  // Data confidence
  let dataConfidence = 50
  const fields = [property.address, property.units, property.asking_price, property.cap_rate, property.occupancy, property.lot_rent]
  const filledFields = fields.filter(f => f !== null && f !== undefined)
  dataConfidence = Math.round((filledFields.length / fields.length) * 100)

  if (dataConfidence < 50) {
    warnings.push('Incomplete data - verify key metrics before proceeding')
  }

  // Overall score (weighted average)
  const overall = Math.round(
    marketRisk * 0.25 +
    financialRisk * 0.30 +
    operationalRisk * 0.25 +
    locationRisk * 0.10 +
    dataConfidence * 0.10
  )

  // Add opportunities based on analysis
  if (marketAnalysis.competitivePosition === 'undervalued') {
    opportunities.push('Property appears undervalued vs market')
  }
  if (financialMetrics.valueAddPotential && financialMetrics.valueAddPotential > 50000) {
    opportunities.push(`Potential to add $${(financialMetrics.valueAddPotential / 1000).toFixed(0)}K NOI through lease-up`)
  }

  return {
    overall,
    factors: {
      marketRisk,
      financialRisk,
      operationalRisk,
      locationRisk,
      dataConfidence
    },
    warnings,
    opportunities
  }
}

// Calculate data quality metrics
function calculateDataQuality(property: Property): DataQualityMetrics {
  const issues: string[] = []

  // Field completeness
  const importantFields: (keyof Property)[] = [
    'name', 'address', 'city', 'state', 'units', 'asking_price',
    'cap_rate', 'lot_rent', 'occupancy', 'latitude', 'longitude', 'image_url'
  ]
  const filledFields = importantFields.filter(f => property[f] !== null && property[f] !== undefined && property[f] !== '')
  const fieldCompleteness = Math.round((filledFields.length / importantFields.length) * 100)

  // Check for specific issues
  if (!property.address) issues.push('Missing street address')
  if (!property.units) issues.push('Missing unit count')
  if (!property.asking_price) issues.push('Missing asking price')
  if (!property.cap_rate) issues.push('Missing cap rate')
  if (!property.lot_rent) issues.push('Missing lot rent')
  if (!property.latitude || !property.longitude) issues.push('Missing geo coordinates')
  if (!property.image_url) issues.push('Missing property image')

  // Data consistency checks
  let dataConsistency = 100
  if (property.asking_price && property.units) {
    const ppu = property.asking_price / property.units
    if (ppu < 5000 || ppu > 500000) {
      dataConsistency -= 20
      issues.push('Price per unit seems unusual')
    }
  }

  if (property.cap_rate && (property.cap_rate < 2 || property.cap_rate > 20)) {
    dataConsistency -= 15
    issues.push('Cap rate outside normal range')
  }

  if (property.occupancy && (property.occupancy < 0 || property.occupancy > 100)) {
    dataConsistency -= 25
    issues.push('Invalid occupancy percentage')
  }

  // Source reliability (based on known sources)
  let sourceReliability = 70
  const highReliabilitySources = ['LoopNet', 'MobileHomeParkStore', 'Crexi', 'CBRE', 'Marcus & Millichap', 'Berkadia']
  if (property.source && highReliabilitySources.some(s => property.source?.includes(s))) {
    sourceReliability = 90
  }

  const overallScore = Math.round(
    fieldCompleteness * 0.4 +
    dataConsistency * 0.35 +
    sourceReliability * 0.25
  )

  return {
    overallScore,
    fieldCompleteness,
    dataConsistency,
    sourceReliability,
    lastVerified: new Date().toISOString(),
    issues
  }
}

// Batch enrich properties
export async function enrichProperties(propertyIds: string[]): Promise<EnrichmentResult[]> {
  const supabase = getSupabase()
  const results: EnrichmentResult[] = []

  // Fetch properties
  const { data: properties, error } = await supabase
    .from('properties')
    .select('*')
    .in('id', propertyIds)

  if (error || !properties) {
    return propertyIds.map(id => ({
      propertyId: id,
      success: false,
      enrichments: {},
      errors: ['Failed to fetch property']
    }))
  }

  // Enrich each property
  for (const property of properties) {
    const result = await enrichProperty(property as Property)
    results.push(result)

    // Update property with enrichment data
    if (result.success) {
      const updates: Record<string, unknown> = {}

      if (result.enrichments.locationData?.latitude) {
        updates.latitude = result.enrichments.locationData.latitude
        updates.longitude = result.enrichments.locationData.longitude
      }

      // Calculate enhanced AI score
      if (result.enrichments.riskScore) {
        const baseScore = result.enrichments.riskScore.overall
        const qualityBonus = (result.enrichments.dataQuality?.overallScore || 50) * 0.1
        updates.ai_score = Math.round(baseScore + qualityBonus)
      }

      updates.updated_at = new Date().toISOString()

      if (Object.keys(updates).length > 1) {
        await supabase
          .from('properties')
          .update(updates)
          .eq('id', property.id)
      }
    }
  }

  return results
}

// Find cross-source matches for a property
export async function findCrossSourceMatches(property: Property): Promise<{
  matches: Array<{
    propertyId: string
    source: string
    similarity: number
    priceDifference: number | null
  }>
  recommendation: 'verified' | 'needs_review' | 'suspicious'
}> {
  const supabase = getSupabase()

  // Find potential matches
  const { data: candidates } = await supabase
    .from('properties')
    .select('id, name, city, state, units, asking_price, source, address')
    .eq('city', property.city)
    .eq('state', property.state)
    .neq('id', property.id)
    .limit(50)

  const matches: Array<{
    propertyId: string
    source: string
    similarity: number
    priceDifference: number | null
  }> = []

  for (const candidate of candidates || []) {
    // Calculate similarity
    let similarity = 0

    // Name similarity
    const nameA = (property.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const nameB = (candidate.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (nameA && nameB) {
      const nameOverlap = nameA.split('').filter(c => nameB.includes(c)).length / Math.max(nameA.length, nameB.length)
      similarity += nameOverlap * 40
    }

    // Unit count match
    if (property.units && candidate.units) {
      const unitDiff = Math.abs(property.units - candidate.units) / Math.max(property.units, candidate.units)
      if (unitDiff < 0.1) similarity += 30
      else if (unitDiff < 0.2) similarity += 20
    }

    // Address similarity
    if (property.address && candidate.address) {
      const addrA = property.address.toLowerCase().replace(/[^a-z0-9]/g, '')
      const addrB = candidate.address.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (addrA === addrB) similarity += 30
      else if (addrA.includes(addrB) || addrB.includes(addrA)) similarity += 20
    }

    if (similarity >= 50) {
      let priceDifference: number | null = null
      if (property.asking_price && candidate.asking_price) {
        priceDifference = candidate.asking_price - property.asking_price
      }

      matches.push({
        propertyId: candidate.id,
        source: candidate.source || 'Unknown',
        similarity: Math.round(similarity),
        priceDifference
      })
    }
  }

  // Determine recommendation
  let recommendation: 'verified' | 'needs_review' | 'suspicious' = 'needs_review'

  if (matches.length >= 2 && matches.every(m => m.similarity > 70)) {
    recommendation = 'verified'
  } else if (matches.some(m => m.priceDifference && Math.abs(m.priceDifference) > (property.asking_price || 0) * 0.3)) {
    recommendation = 'suspicious'
  }

  return {
    matches: matches.sort((a, b) => b.similarity - a.similarity).slice(0, 5),
    recommendation
  }
}
