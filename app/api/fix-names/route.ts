import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPropertyName, batchVerifyNames, calculateNameQuality } from '@/lib/name-verification'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Analyze name quality for all properties
export async function GET() {
  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('id, name, address, city, state')
      .limit(1000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({ 
        message: 'No properties found',
        stats: { total: 0, needsFix: 0 }
      })
    }

    // Verify all names
    const verifications = batchVerifyNames(properties)
    const quality = calculateNameQuality(verifications.map(v => v.verification))

    // Find properties that need fixing
    const needsFix = verifications.filter(v => 
      v.verification.confidence < 80 || 
      v.verification.source !== 'original'
    )

    return NextResponse.json({
      success: true,
      stats: {
        total: properties.length,
        needsFix: needsFix.length,
        averageConfidence: quality.averageConfidence,
        originalNames: quality.originalNames,
        generatedNames: quality.generatedNames
      },
      commonIssues: quality.commonIssues,
      sampleFixes: needsFix.slice(0, 10).map(v => ({
        id: v.id,
        original: v.verification.originalName,
        corrected: v.verification.correctedName,
        confidence: v.verification.confidence,
        source: v.verification.source,
        issues: v.verification.issues
      }))
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// POST: Fix property names
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { 
      propertyId, 
      fixAll = false, 
      dryRun = false,
      minConfidence = 50,
      limit = 200 
    } = body

    let properties: Array<{
      id: string
      name: string | null
      address: string | null
      city: string
      state: string
    }> = []

    if (propertyId) {
      // Fix single property
      const { data } = await supabase
        .from('properties')
        .select('id, name, address, city, state')
        .eq('id', propertyId)
        .single()

      if (data) properties = [data]
    } else if (fixAll) {
      // Fix all properties with generic names
      const { data } = await supabase
        .from('properties')
        .select('id, name, address, city, state')
        .or('name.is.null,name.ilike.%unnamed%,name.ilike.%unknown%,name.eq.Mobile Home Park,name.eq.MHP')
        .limit(limit)

      properties = data || []
    }

    if (properties.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No properties need name fixes',
        fixed: 0 
      })
    }

    const results = {
      processed: 0,
      fixed: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{
        id: string
        original: string
        corrected: string
        confidence: number
        action: 'fixed' | 'skipped' | 'failed'
      }>
    }

    for (const property of properties) {
      results.processed++

      const verification = verifyPropertyName(
        property.name,
        property.address,
        property.city,
        property.state
      )

      // Skip if confidence is too low
      if (verification.confidence < minConfidence) {
        results.skipped++
        results.details.push({
          id: property.id,
          original: verification.originalName,
          corrected: verification.correctedName,
          confidence: verification.confidence,
          action: 'skipped'
        })
        continue
      }

      // Skip if name didn't change
      if (verification.correctedName === verification.originalName) {
        results.skipped++
        continue
      }

      if (!dryRun) {
        // Update the property name
        const { error } = await supabase
          .from('properties')
          .update({
            name: verification.correctedName,
            updated_at: new Date().toISOString()
          })
          .eq('id', property.id)

        if (error) {
          results.failed++
          results.details.push({
            id: property.id,
            original: verification.originalName,
            corrected: verification.correctedName,
            confidence: verification.confidence,
            action: 'failed'
          })
          continue
        }
      }

      results.fixed++
      results.details.push({
        id: property.id,
        original: verification.originalName,
        corrected: verification.correctedName,
        confidence: verification.confidence,
        action: 'fixed'
      })
    }

    return NextResponse.json({
      success: true,
      dryRun,
      ...results,
      summary: {
        fixRate: results.processed > 0 ? Math.round((results.fixed / results.processed) * 100) : 0
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
