import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enrichProperty, enrichProperties, findCrossSourceMatches } from '@/lib/enrichment-service'
import { Property } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Enrich properties with market analysis, financial metrics, and risk scoring
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { 
      propertyId, 
      propertyIds,
      enrichAll = false,
      findMatches = false,
      limit = 50 
    } = body

    // Single property enrichment
    if (propertyId) {
      const { data: property, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single()

      if (error || !property) {
        return NextResponse.json({
          error: 'Property not found',
          propertyId
        }, { status: 404 })
      }

      const result = await enrichProperty(property as Property)

      // Find cross-source matches if requested
      let matches = null
      if (findMatches) {
        matches = await findCrossSourceMatches(property as Property)
      }

      return NextResponse.json({
        success: true,
        result,
        matches,
        timestamp: new Date().toISOString()
      })
    }

    // Batch enrichment
    let idsToEnrich: string[] = []

    if (propertyIds && Array.isArray(propertyIds)) {
      idsToEnrich = propertyIds
    } else if (enrichAll) {
      // Get properties that need enrichment (low AI score or missing data)
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .or('ai_score.is.null,ai_score.lt.50')
        .limit(limit)

      idsToEnrich = (properties || []).map(p => p.id)
    }

    if (idsToEnrich.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties to enrich',
        processed: 0
      })
    }

    const results = await enrichProperties(idsToEnrich)

    const summary = {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      avgRiskScore: 0,
      avgDataQuality: 0
    }

    // Calculate averages
    const successfulResults = results.filter(r => r.success)
    if (successfulResults.length > 0) {
      const riskScores = successfulResults
        .map(r => r.enrichments.riskScore?.overall)
        .filter((s): s is number => s !== undefined)
      
      const qualityScores = successfulResults
        .map(r => r.enrichments.dataQuality?.overallScore)
        .filter((s): s is number => s !== undefined)

      if (riskScores.length > 0) {
        summary.avgRiskScore = Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
      }
      if (qualityScores.length > 0) {
        summary.avgDataQuality = Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      results: results.slice(0, 20), // Return first 20 detailed results
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Enrichment error:', error)
    return NextResponse.json({
      error: 'Enrichment failed',
      message: errorMessage
    }, { status: 500 })
  }
}

// GET: Get enrichment data for a property
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('propertyId')

  if (!propertyId) {
    return NextResponse.json({
      error: 'Missing propertyId parameter'
    }, { status: 400 })
  }

  try {
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()

    if (error || !property) {
      return NextResponse.json({
        error: 'Property not found',
        propertyId
      }, { status: 404 })
    }

    const result = await enrichProperty(property as Property)
    const matches = await findCrossSourceMatches(property as Property)

    return NextResponse.json({
      success: true,
      property: {
        id: property.id,
        name: property.name,
        city: property.city,
        state: property.state
      },
      enrichment: result.enrichments,
      crossSourceMatches: matches,
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: 'Failed to get enrichment data',
      message: errorMessage
    }, { status: 500 })
  }
}
