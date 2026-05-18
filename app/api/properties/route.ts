import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch properties with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')
    const state = searchParams.get('state')
    const status = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'updated_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Single property fetch
    if (id) {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, property: data })
    }

    // List properties with filters
    let query = supabase
      .from('properties')
      .select('*', { count: 'exact' })

    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,address.ilike.%${search}%`)
    }

    if (state) {
      query = query.eq('state', state.toUpperCase())
    }

    if (status) {
      query = query.eq('status', status)
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      properties: data,
      total: count,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}

// POST - Create new property
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const propertyData = {
      name: body.name,
      address: body.address || null,
      city: body.city,
      state: body.state?.toUpperCase(),
      zip_code: body.zip_code || null,
      asking_price: body.asking_price || null,
      units: body.units || 1,
      lot_rent: body.lot_rent || null,
      cap_rate: body.cap_rate || null,
      occupancy: body.occupancy || null,
      price_per_pad: body.price_per_pad || null,
      source: body.source || 'Manual Entry',
      listing_url: body.listing_url || null,
      notes: body.notes || null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      status: body.status || 'active',
      mom_pop: body.mom_pop ?? true,
      toh: body.toh || null,
      poh: body.poh || null,
      vacant: body.vacant || null,
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      image_url: body.image_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('properties')
      .insert(propertyData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, property: data })
  } catch (error) {
    console.error('Error creating property:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create property' },
      { status: 500 }
    )
  }
}

// PUT - Update property
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Property ID is required' },
        { status: 400 }
      )
    }

    // Clean up the updates
    const cleanUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // Only include fields that are explicitly provided
    const allowedFields = [
      'name', 'address', 'city', 'state', 'zip_code',
      'asking_price', 'units', 'lot_rent', 'cap_rate', 'occupancy',
      'price_per_pad', 'source', 'listing_url', 'notes',
      'contact_email', 'contact_phone', 'status', 'mom_pop',
      'toh', 'poh', 'vacant', 'latitude', 'longitude',
      'image_url', 'ai_score', 'median_home_price', 'avg_2br_rent', 'avg_3br_rent'
    ]

    for (const field of allowedFields) {
      if (field in updates) {
        cleanUpdates[field] = updates[field]
      }
    }

    // Ensure state is uppercase
    if (cleanUpdates.state && typeof cleanUpdates.state === 'string') {
      cleanUpdates.state = cleanUpdates.state.toUpperCase()
    }

    const { data, error } = await supabase
      .from('properties')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, property: data })
  } catch (error) {
    console.error('Error updating property:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update property' },
      { status: 500 }
    )
  }
}

// DELETE - Delete property
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Property ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Property deleted' })
  } catch (error) {
    console.error('Error deleting property:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete property' },
      { status: 500 }
    )
  }
}
