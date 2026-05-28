import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET a single property by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH - Update a property
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate ID
    if (!id) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 })
    }

    // Define allowed fields for update
    const allowedFields = [
      'name',
      'address',
      'city',
      'state',
      'region',
      'units',
      'asking_price',
      'cap_rate',
      'lot_rent',
      'occupancy',
      'noi',
      'mom_pop',
      'notes',
      'contact_email',
      'listing_url',
      'price_per_pad',
      'toh',
      'poh',
      'vacant',
      'status',
      'sold_date',
      'sold_price',
      'buyer',
      'median_home_price',
      'avg_2br_rent',
      'avg_3br_rent',
    ]

    // Filter to only allowed fields
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        // Handle null values explicitly
        updateData[field] = body[field] === '' ? null : body[field]
      }
    }

    // Recalculate price per pad if units or asking_price changed
    if (updateData.units !== undefined || updateData.asking_price !== undefined) {
      // Get current property to calculate with current values
      const { data: current } = await supabase
        .from('properties')
        .select('units, asking_price')
        .eq('id', id)
        .single()

      if (current) {
        const units = updateData.units ?? current.units
        const price = updateData.asking_price ?? current.asking_price
        if (units && price) {
          updateData.price_per_pad = Math.round(price / units)
        }
      }
    }

    // Recalculate AI score if relevant fields changed
    const scoreFields = ['cap_rate', 'occupancy', 'units', 'asking_price']
    const needsScoreUpdate = scoreFields.some(f => f in updateData)
    
    if (needsScoreUpdate) {
      const { data: current } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (current) {
        const merged = { ...current, ...updateData }
        updateData.ai_score = calculateAIScore(merged)
      }
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString()

    // Perform the update
    const { data, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('API error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE - Remove a property
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Helper function to calculate AI score
function calculateAIScore(property: {
  cap_rate?: number | null
  occupancy?: number | null
  units?: number | null
  asking_price?: number | null
}): number {
  let score = 70 // Base score
  
  // Cap rate bonus (higher is better for value)
  if (property.cap_rate) {
    if (property.cap_rate >= 8) score += 15
    else if (property.cap_rate >= 7) score += 10
    else if (property.cap_rate >= 6) score += 5
  }
  
  // Occupancy bonus
  if (property.occupancy) {
    if (property.occupancy >= 95) score += 10
    else if (property.occupancy >= 90) score += 7
    else if (property.occupancy >= 85) score += 3
  }
  
  // Unit count sweet spot (50-150 is ideal)
  if (property.units) {
    if (property.units >= 50 && property.units <= 150) score += 5
    else if (property.units >= 30 && property.units <= 200) score += 2
  }
  
  // Price per unit analysis
  if (property.asking_price && property.units && property.units > 0) {
    const pricePerUnit = property.asking_price / property.units
    if (pricePerUnit < 50000) score += 10
    else if (pricePerUnit < 75000) score += 5
    else if (pricePerUnit > 150000) score -= 5
  }
  
  return Math.min(100, Math.max(0, score))
}
