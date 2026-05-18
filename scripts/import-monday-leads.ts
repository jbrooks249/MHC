// Script to import Monday leads into the database
import { createClient } from '@supabase/supabase-js'
import { MONDAY_LEADS, LeadData } from '../lib/monday-leads-data'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function generateListingUrl(lead: LeadData): string {
  const searchQuery = encodeURIComponent(`${lead.name} ${lead.city} ${lead.state} mobile home park for sale`)
  return `https://www.google.com/search?q=${searchQuery}`
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '')
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0
  if (s1.includes(s2) || s2.includes(s1)) return 0.8
  
  const chars1 = new Set(s1.split(''))
  const chars2 = new Set(s2.split(''))
  const intersection = [...chars1].filter(c => chars2.has(c)).length
  const union = new Set([...chars1, ...chars2]).size
  
  return intersection / union
}

async function importLeads() {
  console.log(`Starting import of ${MONDAY_LEADS.length} leads...`)

  // Get existing properties
  const { data: existingProperties, error: fetchError } = await supabase
    .from('properties')
    .select('id, name, address, city, state')

  if (fetchError) {
    console.error('Failed to fetch existing properties:', fetchError)
    return
  }

  const existing = existingProperties || []
  console.log(`Found ${existing.length} existing properties`)

  const results = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0
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

    // Prepare property data - handle edge cases
    const units = lead.totalLots || 1 // Minimum 1 unit to avoid constraint violation
    const capRate = lead.pricePerPad && lead.lotRent && units > 0 
      ? Math.min(((lead.lotRent * 12 * units) / lead.pricePerPad) * 100, 99.99) // Cap at 99.99%
      : null
    const pricePerPad = lead.pricePerPad && lead.pricePerPad < 10000000 ? lead.pricePerPad : null // Limit to reasonable range

    const propertyData = {
      name: lead.name,
      address: lead.address || null,
      city: lead.city,
      state: lead.state,
      asking_price: lead.price && lead.price < 1000000000 ? lead.price : null, // Cap at $1B
      units: units,
      lot_rent: lead.lotRent,
      cap_rate: capRate,
      price_per_pad: pricePerPad,
      occupancy: lead.totalLots && lead.vacant !== null ? Math.round(((lead.totalLots - lead.vacant) / lead.totalLots) * 100) : null,
      source: lead.source,
      listing_url: generateListingUrl(lead),
      notes: lead.notes,
      contact_email: lead.email,
      status: 'active' as const,
      mom_pop: true,
      toh: lead.toh,
      poh: lead.poh,
      vacant: lead.vacant,
      median_home_price: lead.medianHomePrice,
      avg_2br_rent: lead.avgRent2br,
      avg_3br_rent: lead.avgRent3br,
      updated_at: new Date().toISOString()
    }

    if (bestMatch && matchSimilarity > 0.8) {
      // Update existing property
      const { error } = await supabase
        .from('properties')
        .update(propertyData)
        .eq('id', bestMatch.id)

      if (error) {
        console.error(`Failed to update ${lead.name}:`, error.message)
        results.failed++
      } else {
        console.log(`Updated: ${lead.name}`)
        results.updated++
      }
    } else if (matches.length > 1) {
      console.log(`Skipped duplicate: ${lead.name}`)
      results.skipped++
    } else {
      // Insert new property
      const { error } = await supabase
        .from('properties')
        .insert({
          ...propertyData,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error(`Failed to insert ${lead.name}:`, error.message)
        results.failed++
      } else {
        console.log(`Inserted: ${lead.name}`)
        results.inserted++
      }
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  console.log('\n=== Import Complete ===')
  console.log(`Inserted: ${results.inserted}`)
  console.log(`Updated: ${results.updated}`)
  console.log(`Skipped: ${results.skipped}`)
  console.log(`Failed: ${results.failed}`)
}

importLeads().catch(console.error)
