import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Export properties to CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const ids = searchParams.get('ids') // Optional: comma-separated IDs for selective export
    const status = searchParams.get('status')
    const state = searchParams.get('state')

    let query = supabase
      .from('properties')
      .select('*')
      .order('name')

    if (ids) {
      const idArray = ids.split(',').map(i => i.trim())
      query = query.in('id', idArray)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (state) {
      query = query.eq('state', state.toUpperCase())
    }

    const { data, error } = await query

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No properties found' },
        { status: 404 }
      )
    }

    // Log export activity
    await supabase.from('activity_log').insert({
      action: 'export',
      entity_type: 'properties',
      details: { format, count: data.length }
    })

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        properties: data,
        count: data.length
      })
    }

    // Generate CSV
    const headers = [
      'Name',
      'Address',
      'City',
      'State',
      'Zip Code',
      'Asking Price',
      'Units',
      'Lot Rent',
      'Cap Rate',
      'Occupancy',
      'Price Per Pad',
      'TOH',
      'POH',
      'Vacant',
      'Source',
      'Listing URL',
      'Contact Email',
      'Contact Phone',
      'Status',
      'Mom & Pop',
      'Notes',
      'Created At',
      'Updated At'
    ]

    const csvRows = [headers.join(',')]

    for (const property of data) {
      const row = [
        escapeCSV(property.name),
        escapeCSV(property.address),
        escapeCSV(property.city),
        escapeCSV(property.state),
        escapeCSV(property.zip_code),
        property.asking_price || '',
        property.units || '',
        property.lot_rent || '',
        property.cap_rate || '',
        property.occupancy || '',
        property.price_per_pad || '',
        property.toh || '',
        property.poh || '',
        property.vacant || '',
        escapeCSV(property.source),
        escapeCSV(property.listing_url),
        escapeCSV(property.contact_email),
        escapeCSV(property.contact_phone),
        escapeCSV(property.status),
        property.mom_pop ? 'Yes' : 'No',
        escapeCSV(property.notes),
        property.created_at || '',
        property.updated_at || ''
      ]
      csvRows.push(row.join(','))
    }

    const csv = csvRows.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="mhc-properties-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export properties' },
      { status: 500 }
    )
  }
}

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
