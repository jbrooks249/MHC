import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Log an activity
export async function logActivity(
  action: string,
  entityType: string,
  entityId: string | null,
  entityName: string | null,
  details?: Record<string, unknown>,
  changes?: Record<string, unknown>
) {
  try {
    await supabase.from('activity_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      details,
      changes
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

// GET - Fetch activity logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const entityId = searchParams.get('entityId')
    const action = searchParams.get('action')

    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entityId) {
      query = query.eq('entity_id', entityId)
    }

    if (action) {
      query = query.eq('action', action)
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      logs: data,
      total: count,
      limit,
      offset
    })
  } catch (error) {
    console.error('Activity log fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity logs' },
      { status: 500 }
    )
  }
}

// POST - Create activity log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, entityType, entityId, entityName, details, changes } = body

    const { data, error } = await supabase.from('activity_log').insert({
      action,
      entity_type: entityType || 'property',
      entity_id: entityId,
      entity_name: entityName,
      details,
      changes
    }).select().single()

    if (error) throw error

    return NextResponse.json({ success: true, log: data })
  } catch (error) {
    console.error('Activity log create error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create activity log' },
      { status: 500 }
    )
  }
}
