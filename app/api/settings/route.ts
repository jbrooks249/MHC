import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Check API key status (without exposing actual keys)
export async function GET() {
  try {
    // Check which API keys are configured via environment variables
    const keyStatus = {
      firecrawl: !!process.env.FIRECRAWL_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      googleMaps: !!process.env.GOOGLE_MAPS_API_KEY
    }

    // Also check for keys in the settings table (if we store them there)
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['firecrawl_api_key', 'openai_api_key', 'google_maps_api_key'])

    if (settings) {
      for (const setting of settings) {
        if (setting.key === 'firecrawl_api_key' && setting.value) {
          keyStatus.firecrawl = true
        }
        if (setting.key === 'openai_api_key' && setting.value) {
          keyStatus.openai = true
        }
        if (setting.key === 'google_maps_api_key' && setting.value) {
          keyStatus.googleMaps = true
        }
      }
    }

    return NextResponse.json({ keyStatus })
  } catch (error) {
    console.error('Failed to check API key status:', error)
    return NextResponse.json({ 
      keyStatus: { firecrawl: false, openai: false, googleMaps: false } 
    })
  }
}

// POST - Save API keys to settings table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firecrawl_api_key, openai_api_key, google_maps_api_key } = body

    // Ensure settings table exists
    const { error: tableError } = await supabase.rpc('create_settings_table_if_not_exists')
    if (tableError) {
      // Table might already exist, continue anyway
      console.log('Settings table check:', tableError.message)
    }

    const updates = []

    if (firecrawl_api_key) {
      updates.push({
        key: 'firecrawl_api_key',
        value: firecrawl_api_key,
        updated_at: new Date().toISOString()
      })
    }

    if (openai_api_key) {
      updates.push({
        key: 'openai_api_key',
        value: openai_api_key,
        updated_at: new Date().toISOString()
      })
    }

    if (google_maps_api_key) {
      updates.push({
        key: 'google_maps_api_key',
        value: google_maps_api_key,
        updated_at: new Date().toISOString()
      })
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No API keys provided' }, { status: 400 })
    }

    // Upsert each setting
    for (const update of updates) {
      const { error } = await supabase
        .from('settings')
        .upsert(update, { onConflict: 'key' })

      if (error) {
        console.error(`Failed to save ${update.key}:`, error)
        return NextResponse.json({ error: `Failed to save ${update.key}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
