import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MONDAY_LEADS, LeadData } from '@/lib/monday-leads-data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate listing URL based on property data
function generateListingUrl(lead: LeadData): string {
  const searchQuery = encodeURIComponent(`${lead.name} ${lead.city} ${lead.state} mobile home park for sale`)
  
  // Try common listing sites
  const sources = [
    `https://www.loopnet.com/search/mobile-home-parks/${lead.state}/for-sale/`,
    `https://www.crexi.com/properties?q=${searchQuery}`,
    `https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/${lead.state.toLowerCase()}/`,
  ]
  
  // Return a Google search URL as fallback
  return `https://www.google.com/search?q=${searchQuery}`
}

// Calculate similarity between two strings (for deduplication)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '')
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8
  
  // Simple character overlap
  const chars1 = new Set(s1.split(''))
  const chars2 = new Set(s2.split(''))
  const intersection = [...chars1].filter(c => chars2.has(c)).length
  const union = new Set([...chars1, ...chars2]).size
  
  return intersection / union
}

// GET: Preview what will be imported
export async function GET() {
  try {
    // Get existing properties for comparison
    const { data: existingProperties } = await supabase
      .from('properties')
      .select('id, name, address, city, state')

    const existing = existingProperties || []
    
    // Categorize leads
    const toInsert: LeadData[] = []
    const toUpdate: { lead: LeadData; existingId: string; existingName: string }[] = []
    const duplicates: { lead: LeadData; matches: { id: string; name: string; similarity: number }[] }[] = []

    for (const lead of MONDAY_LEADS) {
      // Find potential matches
      const matches = existing.filter(e => {
        const nameSimilarity = calculateSimilarity(lead.name, e.name || '')
        const citySame = (e.city || '').toLowerCase() === lead.city.toLowerCase()
        const stateSame = (e.state || '').toLowerCase() === lead.state.toLowerCase()
        
        // Match if name is similar AND same city/state
        return (nameSimilarity > 0.6 && citySame && stateSame) ||
               // Or if address matches
               (e.address && lead.address && calculateSimilarity(e.address, lead.address) > 0.8)
      }).map(e => ({
        id: e.id,
        name: e.name || '',
        similarity: calculateSimilarity(lead.name, e.name || '')
      }))

      if (matches.length === 0) {
        toInsert.push(lead)
      } else if (matches.length === 1 && matches[0].similarity > 0.8) {
        toUpdate.push({ lead, existingId: matches[0].id, existingName: matches[0].name })
      } else {
        duplicates.push({ lead, matches })
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalLeads: MONDAY_LEADS.length,
        toInsert: toInsert.length,
        toUpdate: toUpdate.length,
        duplicates: duplicates.length,
        existingProperties: existing.length
      },
      preview: {
        insert: toInsert.slice(0, 10).map(l => ({ name: l.name, city: l.city, state: l.state })),
        update: toUpdate.slice(0, 10).map(u => ({ 
          name: u.lead.name, 
          existingName: u.existingName,
          existingId: u.existingId 
        })),
        duplicates: duplicates.slice(0, 5).map(d => ({
          name: d.lead.name,
          potentialMatches: d.matches
        }))
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// POST: Actually import the leads
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { dryRun = false, updateExisting = true, skipDuplicates = true } = body

    // Get existing properties
    const { data: existingProperties } = await supabase
      .from('properties')
      .select('id, name, address, city, state')

    const existing = existingProperties || []
    
    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{ name: string; action: string; id?: string; error?: string }>
    }

    for (const lead of MONDAY_LEADS) {
      // Find potential matches
      const matches = existing.filter(e => {
        const nameSimilarity = calculateSimilarity(lead.name, e.name || '')
        const citySame = (e.city || '').toLowerCase() === lead.city.toLowerCase()
        const stateSame = (e.state || '').toLowerCase() === lead.state.toLowerCase()
        
        return (nameSimilarity > 0.6 && citySame && stateSame) ||
               (e.address && lead.address && calculateSimilarity(e.address, lead.address) > 0.8)
      })

      const bestMatch = matches.length > 0 ? matches[0] : null
      const matchSimilarity = bestMatch ? calculateSimilarity(lead.name, bestMatch.name || '') : 0

      // Prepare property data
      const propertyData = {
        name: lead.name,
        address: lead.address || null,
        city: lead.city,
        state: lead.state,
        asking_price: lead.price,
        units: lead.totalLots || 0,
        lot_rent: lead.lotRent,
        cap_rate: lead.pricePerPad && lead.lotRent ? ((lead.lotRent * 12 * (lead.totalLots || 0)) / lead.pricePerPad) * 100 : null,
        occupancy: lead.totalLots && lead.vacant !== null ? Math.round(((lead.totalLots - lead.vacant) / lead.totalLots) * 100) : null,
        source: lead.source,
        listing_url: generateListingUrl(lead),
        notes: lead.notes,
        contact_email: lead.email,
        status: 'active' as const,
        mom_pop: true, // These are targeted leads, likely mom & pop
        updated_at: new Date().toISOString()
      }

      if (dryRun) {
        if (bestMatch && matchSimilarity > 0.8) {
          results.details.push({ name: lead.name, action: 'would_update', id: bestMatch.id })
          results.updated++
        } else if (matches.length > 1) {
          results.details.push({ name: lead.name, action: 'would_skip_duplicate' })
          results.skipped++
        } else {
          results.details.push({ name: lead.name, action: 'would_insert' })
          results.inserted++
        }
        continue
      }

      // Actual insert/update
      if (bestMatch && matchSimilarity > 0.8 && updateExisting) {
        // Update existing property
        const { error } = await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', bestMatch.id)

        if (error) {
          results.failed++
          results.details.push({ name: lead.name, action: 'update_failed', error: error.message })
        } else {
          results.updated++
          results.details.push({ name: lead.name, action: 'updated', id: bestMatch.id })
        }
      } else if (matches.length > 1 && skipDuplicates) {
        results.skipped++
        results.details.push({ name: lead.name, action: 'skipped_duplicate' })
      } else {
        // Insert new property
        const { data: inserted, error } = await supabase
          .from('properties')
          .insert({
            ...propertyData,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single()

        if (error) {
          results.failed++
          results.details.push({ name: lead.name, action: 'insert_failed', error: error.message })
        } else {
          results.inserted++
          results.details.push({ name: lead.name, action: 'inserted', id: inserted?.id })
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return NextResponse.json({
      success: true,
      dryRun,
      results,
      summary: {
        total: MONDAY_LEADS.length,
        inserted: results.inserted,
        updated: results.updated,
        skipped: results.skipped,
        failed: results.failed
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
