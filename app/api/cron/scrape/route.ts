import { NextRequest, NextResponse } from 'next/server'

// This endpoint is called by Vercel Cron
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/scrape", "schedule": "0 4 * * *" }] }

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the base URL from the request
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`

    // Trigger the scrape endpoint
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`
      },
      body: JSON.stringify({ cronTrigger: true })
    })

    const result = await response.json()

    console.log('[Cron] Daily MHP scrape completed:', {
      timestamp: new Date().toISOString(),
      totalScraped: result.total_scraped,
      totalAdded: result.total_added,
      totalUpdated: result.total_updated,
      errors: result.errors?.length || 0
    })

    return NextResponse.json({
      success: true,
      message: 'Daily scrape completed',
      ...result
    })

  } catch (error: any) {
    console.error('[Cron] Scrape error:', error)
    return NextResponse.json({ 
      error: 'Cron scrape failed', 
      message: error.message 
    }, { status: 500 })
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
