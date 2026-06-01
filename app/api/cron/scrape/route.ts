import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vercel Cron Job endpoint - runs daily at 6 AM UTC
// Add to vercel.json: { "crons": [{ "path": "/api/cron/scrape", "schedule": "0 6 * * *" }] }
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = {
      timestamp: new Date().toISOString(),
      tasks: [] as Array<{ task: string; status: string; details?: unknown }>,
      newListings: 0,
      updatedListings: 0,
      errors: [] as string[]
    }

    // Task 1: Check if OpenAI is configured
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    
    if (hasOpenAI) {
      // Task 2: Search for new MHC listings using AI
      try {
        const searchResults = await searchForNewListings()
        results.tasks.push({ task: 'search_listings', status: 'completed', details: searchResults })
        results.newListings = searchResults.found || 0
      } catch (error) {
        results.errors.push(`Search listings failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        results.tasks.push({ task: 'search_listings', status: 'failed' })
      }

      // Task 3: Update missing data for existing properties
      try {
        const enrichResults = await enrichExistingProperties()
        results.tasks.push({ task: 'enrich_properties', status: 'completed', details: enrichResults })
        results.updatedListings = enrichResults.updated || 0
      } catch (error) {
        results.errors.push(`Enrich properties failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        results.tasks.push({ task: 'enrich_properties', status: 'failed' })
      }
    } else {
      results.tasks.push({ task: 'ai_tasks', status: 'skipped', details: 'OPENAI_API_KEY not configured' })
    }

    // Task 4: Check for stale listings (no update in 30+ days)
    try {
      const staleResults = await checkStaleListings()
      results.tasks.push({ task: 'check_stale', status: 'completed', details: staleResults })
    } catch (error) {
      results.errors.push(`Check stale failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      results.tasks.push({ task: 'check_stale', status: 'failed' })
    }

    // Task 5: Update stats
    try {
      const statsResults = await updateDailyStats()
      results.tasks.push({ task: 'update_stats', status: 'completed', details: statsResults })
    } catch (error) {
      results.errors.push(`Update stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      results.tasks.push({ task: 'update_stats', status: 'failed' })
    }

    // Log the cron run
    await supabase.from('activity_log').insert({
      action: 'cron_scrape',
      entity_type: 'system',
      details: results
    })

    console.log('[Cron] Daily MHP tasks completed:', results)

    return NextResponse.json({
      success: true,
      ...results
    })
  } catch (error) {
    console.error('Cron scrape error:', error)
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}

// Search for new MHC listings using AI
async function searchForNewListings() {
  const model = openai('gpt-4-turbo-preview')
  
  // Get states with fewest listings to prioritize
  const { data: stateCounts } = await supabase
    .from('properties')
    .select('state')
  
  const stateMap: Record<string, number> = {}
  stateCounts?.forEach(p => {
    stateMap[p.state] = (stateMap[p.state] || 0) + 1
  })
  
  // Find underrepresented states
  const allStates = ['TX', 'FL', 'CA', 'OH', 'MI', 'GA', 'NC', 'AZ', 'IN', 'MO', 'TN', 'WI', 'AL', 'SC', 'KY']
  const priorityStates = allStates
    .filter(s => (stateMap[s] || 0) < 10)
    .slice(0, 3)

  if (priorityStates.length === 0) {
    return { found: 0, message: 'All states have sufficient coverage' }
  }

  // Generate search suggestions for these states
  const { text } = await generateText({
    model,
    prompt: `Generate 5 specific mobile home park/manufactured housing community names that might be for sale in ${priorityStates.join(', ')}. 
    
Return only the names, one per line, in format: "Name - City, State"
Focus on smaller mom-and-pop communities between 20-150 spaces.`,
    maxOutputTokens: 500
  })

  const suggestions = text.split('\n').filter(s => s.trim()).slice(0, 5)
  
  return {
    found: suggestions.length,
    priorityStates,
    suggestions,
    message: `Generated ${suggestions.length} search suggestions for ${priorityStates.join(', ')}`
  }
}

// Enrich properties missing key data
async function enrichExistingProperties() {
  // Find properties missing important data
  const { data: incomplete } = await supabase
    .from('properties')
    .select('id, name, city, state, units, asking_price, lot_rent, cap_rate')
    .or('lot_rent.is.null,cap_rate.is.null')
    .eq('status', 'active')
    .limit(10)

  if (!incomplete || incomplete.length === 0) {
    return { updated: 0, message: 'No properties need enrichment' }
  }

  let updated = 0
  const model = openai('gpt-4-turbo-preview')

  for (const property of incomplete.slice(0, 5)) {
    try {
      const { text } = await generateText({
        model,
        prompt: `For a mobile home community called "${property.name}" in ${property.city}, ${property.state}:
- Current known data: ${property.units || 'unknown'} units, asking price: ${property.asking_price ? '$' + property.asking_price.toLocaleString() : 'unknown'}
- What would be a reasonable market lot rent estimate for this area?
- What would be a typical cap rate for this market?

Respond in JSON format only: { "estimated_lot_rent": number, "estimated_cap_rate": number, "confidence": "low"|"medium"|"high" }`,
        maxOutputTokens: 200
      })

      try {
        const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim()
        const estimates = JSON.parse(cleaned)
        
        if (estimates.confidence !== 'low') {
          const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
          if (!property.lot_rent && estimates.estimated_lot_rent) {
            updates.lot_rent = estimates.estimated_lot_rent
          }
          if (!property.cap_rate && estimates.estimated_cap_rate) {
            updates.cap_rate = estimates.estimated_cap_rate
          }
          
          if (Object.keys(updates).length > 1) {
            await supabase.from('properties').update(updates).eq('id', property.id)
            updated++
          }
        }
      } catch {
        // Skip if JSON parsing fails
      }
    } catch (error) {
      console.error(`Failed to enrich ${property.name}:`, error)
    }
  }

  return { updated, total: incomplete.length }
}

// Check for stale listings
async function checkStaleListings() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: stale, count } = await supabase
    .from('properties')
    .select('id, name, city, state, updated_at', { count: 'exact' })
    .eq('status', 'active')
    .lt('updated_at', thirtyDaysAgo.toISOString())
    .limit(20)

  // Mark very old listings as pending review
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const { data: veryStale } = await supabase
    .from('properties')
    .select('id')
    .eq('status', 'active')
    .lt('updated_at', sixtyDaysAgo.toISOString())

  let markedForReview = 0
  if (veryStale && veryStale.length > 0) {
    await supabase
      .from('properties')
      .update({ status: 'pending' })
      .in('id', veryStale.map(p => p.id))
    markedForReview = veryStale.length
  }

  return {
    staleCount: count || 0,
    markedForReview,
    samples: stale?.slice(0, 5).map(p => ({ name: p.name, city: p.city, state: p.state }))
  }
}

// Update daily statistics
async function updateDailyStats() {
  const { count: total } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })

  const { count: active } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { data: valueData } = await supabase
    .from('properties')
    .select('asking_price')
    .eq('status', 'active')
    .not('asking_price', 'is', null)

  const totalValue = valueData?.reduce((sum, p) => sum + (p.asking_price || 0), 0) || 0

  return {
    totalProperties: total,
    activeProperties: active,
    totalPortfolioValue: totalValue,
    timestamp: new Date().toISOString()
  }
}
