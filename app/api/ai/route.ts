import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// AI task types
type AITaskType = 
  | 'analyze_property'
  | 'generate_description'
  | 'find_listing_url'
  | 'enrich_data'
  | 'market_analysis'
  | 'investment_score'
  | 'compare_properties'
  | 'generate_report'

interface AITaskRequest {
  task: AITaskType
  propertyIds?: string[]
  propertyData?: Record<string, unknown>
  options?: Record<string, unknown>
}

// POST - Run AI task
export async function POST(request: NextRequest) {
  try {
    const body: AITaskRequest = await request.json()
    const { task, propertyIds, propertyData, options } = body

    // Fetch properties if IDs provided
    let properties: Record<string, unknown>[] = []
    if (propertyIds?.length) {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .in('id', propertyIds)
      
      if (error) throw error
      properties = data || []
    } else if (propertyData) {
      properties = [propertyData]
    }

    let result: Record<string, unknown>

    switch (task) {
      case 'analyze_property':
        result = await analyzeProperty(properties[0])
        break
      case 'generate_description':
        result = await generateDescription(properties[0])
        break
      case 'find_listing_url':
        result = await findListingUrl(properties[0])
        break
      case 'enrich_data':
        result = await enrichPropertyData(properties, options)
        break
      case 'market_analysis':
        result = await marketAnalysis(properties[0])
        break
      case 'investment_score':
        result = await calculateInvestmentScore(properties[0])
        break
      case 'compare_properties':
        result = await compareProperties(properties)
        break
      case 'generate_report':
        result = await generateReport(properties, options)
        break
      default:
        return NextResponse.json(
          { success: false, error: `Unknown task: ${task}` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('AI task error:', error)
    return NextResponse.json(
      { success: false, error: 'AI task failed' },
      { status: 500 }
    )
  }
}

// GET - List available AI tasks
export async function GET() {
  return NextResponse.json({
    success: true,
    tasks: [
      { id: 'analyze_property', name: 'Analyze Property', description: 'Deep analysis of a property including investment potential' },
      { id: 'generate_description', name: 'Generate Description', description: 'Create a professional property description' },
      { id: 'find_listing_url', name: 'Find Listing URL', description: 'Search for the original listing URL on real estate sites' },
      { id: 'enrich_data', name: 'Enrich Data', description: 'Add missing data points to properties' },
      { id: 'market_analysis', name: 'Market Analysis', description: 'Analyze the local market conditions' },
      { id: 'investment_score', name: 'Investment Score', description: 'Calculate investment potential score' },
      { id: 'compare_properties', name: 'Compare Properties', description: 'Compare multiple properties side by side' },
      { id: 'generate_report', name: 'Generate Report', description: 'Create a detailed investment report' }
    ]
  })
}

// AI Task Implementations

async function analyzeProperty(property: Record<string, unknown>) {
  if (!property) return { error: 'No property provided' }

  const prompt = `Analyze this mobile home community investment opportunity and provide insights:

Property: ${property.name}
Location: ${property.city}, ${property.state}
Units: ${property.units}
Asking Price: $${property.asking_price ? Number(property.asking_price).toLocaleString() : 'Not disclosed'}
Lot Rent: $${property.lot_rent || 'Unknown'}/month
Cap Rate: ${property.cap_rate ? `${property.cap_rate}%` : 'Unknown'}
Occupancy: ${property.occupancy ? `${property.occupancy}%` : 'Unknown'}
TOH/POH: ${property.toh || '?'} TOH / ${property.poh || '?'} POH
Notes: ${property.notes || 'None'}

Provide a brief analysis covering:
1. Investment Highlights (2-3 bullet points)
2. Risk Factors (2-3 bullet points)  
3. Value-Add Opportunities
4. Recommended Offer Range (if price is known)
5. Overall Assessment (1-2 sentences)

Keep the response concise and actionable.`

  const { text } = await generateText({
    model: 'anthropic/claude-sonnet-4-20250514',
    prompt,
    maxOutputTokens: 1000
  })

  return { 
    analysis: text,
    property_id: property.id,
    generated_at: new Date().toISOString()
  }
}

async function generateDescription(property: Record<string, unknown>) {
  if (!property) return { error: 'No property provided' }

  const prompt = `Write a professional marketing description for this mobile home community listing:

Property: ${property.name}
Location: ${property.city}, ${property.state}
Address: ${property.address || 'Not provided'}
Units: ${property.units}
Asking Price: $${property.asking_price ? Number(property.asking_price).toLocaleString() : 'Contact for pricing'}
Lot Rent: $${property.lot_rent || 'Competitive'}/month
Cap Rate: ${property.cap_rate ? `${property.cap_rate}%` : 'Attractive'}
Occupancy: ${property.occupancy ? `${property.occupancy}%` : 'Strong'}
TOH/POH Mix: ${property.toh || '?'} TOH / ${property.poh || '?'} POH

Write a compelling 2-3 paragraph description highlighting:
- Location benefits
- Investment potential
- Property features
- Growth opportunities

Professional tone, suitable for commercial real estate listing.`

  const { text } = await generateText({
    model: 'anthropic/claude-sonnet-4-20250514',
    prompt,
    maxOutputTokens: 500
  })

  return { 
    description: text,
    property_id: property.id,
    generated_at: new Date().toISOString()
  }
}

async function findListingUrl(property: Record<string, unknown>) {
  if (!property) return { error: 'No property provided' }

  // Generate search suggestions for finding the listing
  const searchTerms = [
    `${property.name} for sale`,
    `${property.city} ${property.state} mobile home park for sale`,
    `${property.address} mobile home community`,
    `MHVillage ${property.name}`,
    `LoopNet mobile home park ${property.city} ${property.state}`,
    `Crexi manufactured housing ${property.city}`
  ]

  const potentialUrls = [
    `https://www.mhvillage.com/Search?location=${encodeURIComponent(`${property.city}, ${property.state}`)}`,
    `https://www.loopnet.com/search/mobile-home-parks/${property.state}/for-sale/`,
    `https://www.crexi.com/properties?asset=Mobile%20Home%20Parks&location=${encodeURIComponent(`${property.city}, ${property.state}`)}`,
    `https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/${property.state?.toString().toLowerCase()}/`,
    `https://www.land.com/mobile-home-parks/${property.state?.toString().toLowerCase()}/`
  ]

  return {
    searchTerms,
    potentialUrls,
    property_id: property.id,
    recommendation: `Search MHVillage, LoopNet, or Crexi for "${property.name}" in ${property.city}, ${property.state}`
  }
}

async function enrichPropertyData(properties: Record<string, unknown>[], options?: Record<string, unknown>) {
  const limit = Math.min(Number(options?.limit) || 10, 50)
  const enriched: { id: unknown; updates: Record<string, unknown> }[] = []

  for (const property of properties.slice(0, limit)) {
    const updates: Record<string, unknown> = {}

    // Calculate missing metrics
    if (!property.price_per_pad && property.asking_price && property.units) {
      updates.price_per_pad = Math.round(Number(property.asking_price) / Number(property.units))
    }

    if (!property.cap_rate && property.asking_price && property.lot_rent && property.units) {
      const annualNOI = Number(property.lot_rent) * 12 * Number(property.units) * 0.6 // Assume 60% margin
      updates.cap_rate = Math.round((annualNOI / Number(property.asking_price)) * 10000) / 100
    }

    if (!property.occupancy && property.units && property.vacant !== null) {
      updates.occupancy = Math.round(((Number(property.units) - Number(property.vacant)) / Number(property.units)) * 100)
    }

    if (Object.keys(updates).length > 0) {
      // Update in database
      const { error } = await supabase
        .from('properties')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', property.id)

      if (!error) {
        enriched.push({ id: property.id, updates })
      }
    }
  }

  return {
    enriched: enriched.length,
    details: enriched
  }
}

async function marketAnalysis(property: Record<string, unknown>) {
  if (!property) return { error: 'No property provided' }

  const prompt = `Provide a brief market analysis for a mobile home community in ${property.city}, ${property.state}:

Property Details:
- ${property.units} units
- Lot rent: $${property.lot_rent || 'Unknown'}/month
- Median home price in area: $${property.median_home_price ? Number(property.median_home_price).toLocaleString() : 'Unknown'}
- Avg 2BR rent in area: $${property.avg_2br_rent || 'Unknown'}

Analyze:
1. Market demand indicators
2. Rent growth potential
3. Competition level
4. Economic factors
5. Investment outlook

Keep response to 200 words maximum.`

  const { text } = await generateText({
    model: 'anthropic/claude-sonnet-4-20250514',
    prompt,
    maxOutputTokens: 400
  })

  return {
    analysis: text,
    location: `${property.city}, ${property.state}`,
    generated_at: new Date().toISOString()
  }
}

async function calculateInvestmentScore(property: Record<string, unknown>) {
  if (!property) return { error: 'No property provided' }

  let score = 50 // Base score
  const factors: { factor: string; impact: number; reason: string }[] = []

  // Cap rate scoring
  if (property.cap_rate) {
    const capRate = Number(property.cap_rate)
    if (capRate >= 10) {
      score += 15
      factors.push({ factor: 'Cap Rate', impact: 15, reason: `Excellent cap rate of ${capRate}%` })
    } else if (capRate >= 7) {
      score += 10
      factors.push({ factor: 'Cap Rate', impact: 10, reason: `Good cap rate of ${capRate}%` })
    } else if (capRate >= 5) {
      score += 5
      factors.push({ factor: 'Cap Rate', impact: 5, reason: `Average cap rate of ${capRate}%` })
    }
  }

  // Occupancy scoring
  if (property.occupancy) {
    const occ = Number(property.occupancy)
    if (occ >= 95) {
      score += 15
      factors.push({ factor: 'Occupancy', impact: 15, reason: `Excellent occupancy at ${occ}%` })
    } else if (occ >= 85) {
      score += 10
      factors.push({ factor: 'Occupancy', impact: 10, reason: `Good occupancy at ${occ}%` })
    } else if (occ < 70) {
      score -= 10
      factors.push({ factor: 'Occupancy', impact: -10, reason: `Low occupancy at ${occ}% - upside potential but risky` })
    }
  }

  // TOH vs POH ratio
  if (property.toh && property.units) {
    const tohRatio = Number(property.toh) / Number(property.units)
    if (tohRatio >= 0.8) {
      score += 10
      factors.push({ factor: 'TOH Ratio', impact: 10, reason: `Strong TOH ratio of ${Math.round(tohRatio * 100)}%` })
    } else if (tohRatio >= 0.5) {
      score += 5
      factors.push({ factor: 'TOH Ratio', impact: 5, reason: `Mixed TOH/POH ratio` })
    }
  }

  // Price per pad
  if (property.price_per_pad) {
    const ppp = Number(property.price_per_pad)
    if (ppp < 50000) {
      score += 10
      factors.push({ factor: 'Price/Pad', impact: 10, reason: `Attractive price at $${ppp.toLocaleString()}/pad` })
    } else if (ppp < 80000) {
      score += 5
      factors.push({ factor: 'Price/Pad', impact: 5, reason: `Fair price at $${ppp.toLocaleString()}/pad` })
    } else if (ppp > 150000) {
      score -= 5
      factors.push({ factor: 'Price/Pad', impact: -5, reason: `Premium pricing at $${ppp.toLocaleString()}/pad` })
    }
  }

  // Size bonus
  if (property.units) {
    const units = Number(property.units)
    if (units >= 200) {
      score += 5
      factors.push({ factor: 'Size', impact: 5, reason: `Large community with ${units} units` })
    } else if (units < 30) {
      score -= 5
      factors.push({ factor: 'Size', impact: -5, reason: `Small community may lack economies of scale` })
    }
  }

  // Mom & pop bonus
  if (property.mom_pop) {
    score += 5
    factors.push({ factor: 'Ownership', impact: 5, reason: 'Mom & pop owned - potential value-add opportunity' })
  }

  // Cap score at 100
  score = Math.min(100, Math.max(0, score))

  // Update the property with new score
  await supabase
    .from('properties')
    .update({ ai_score: score, updated_at: new Date().toISOString() })
    .eq('id', property.id)

  return {
    score,
    grade: score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D',
    factors,
    property_id: property.id
  }
}

async function compareProperties(properties: Record<string, unknown>[]) {
  if (properties.length < 2) {
    return { error: 'Need at least 2 properties to compare' }
  }

  const comparison = properties.map(p => ({
    id: p.id,
    name: p.name,
    location: `${p.city}, ${p.state}`,
    units: p.units,
    asking_price: p.asking_price,
    price_per_pad: p.price_per_pad || (p.asking_price && p.units ? Math.round(Number(p.asking_price) / Number(p.units)) : null),
    cap_rate: p.cap_rate,
    lot_rent: p.lot_rent,
    occupancy: p.occupancy,
    toh_ratio: p.toh && p.units ? Math.round((Number(p.toh) / Number(p.units)) * 100) : null
  }))

  // Calculate averages
  const avg = {
    units: Math.round(comparison.reduce((sum, p) => sum + (Number(p.units) || 0), 0) / comparison.length),
    price_per_pad: Math.round(comparison.reduce((sum, p) => sum + (Number(p.price_per_pad) || 0), 0) / comparison.filter(p => p.price_per_pad).length) || null,
    cap_rate: Math.round(comparison.reduce((sum, p) => sum + (Number(p.cap_rate) || 0), 0) / comparison.filter(p => p.cap_rate).length * 10) / 10 || null,
    lot_rent: Math.round(comparison.reduce((sum, p) => sum + (Number(p.lot_rent) || 0), 0) / comparison.filter(p => p.lot_rent).length) || null
  }

  return {
    properties: comparison,
    averages: avg,
    recommendation: `Based on the comparison, properties with cap rates above ${avg.cap_rate}% and price/pad below $${avg.price_per_pad?.toLocaleString()} offer better value.`
  }
}

async function generateReport(properties: Record<string, unknown>[], options?: Record<string, unknown>) {
  const reportType = options?.type || 'summary'
  
  if (properties.length === 0) {
    return { error: 'No properties provided for report' }
  }

  const prompt = `Generate a ${reportType} investment report for these mobile home communities:

${properties.slice(0, 5).map((p, i) => `
${i + 1}. ${p.name} - ${p.city}, ${p.state}
   Units: ${p.units} | Price: $${p.asking_price ? Number(p.asking_price).toLocaleString() : 'TBD'}
   Cap Rate: ${p.cap_rate || 'N/A'}% | Lot Rent: $${p.lot_rent || 'N/A'}
   Occupancy: ${p.occupancy || 'N/A'}% | TOH/POH: ${p.toh || '?'}/${p.poh || '?'}
`).join('\n')}

Create a professional investment report including:
1. Executive Summary
2. Portfolio Overview
3. Key Metrics Analysis
4. Top Recommendations
5. Risk Assessment

Keep the report concise but comprehensive (500 words max).`

  const { text } = await generateText({
    model: 'anthropic/claude-sonnet-4-20250514',
    prompt,
    maxOutputTokens: 1000
  })

  return {
    report: text,
    properties_analyzed: properties.length,
    generated_at: new Date().toISOString()
  }
}
