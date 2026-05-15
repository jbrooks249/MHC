import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  runFullScrape, 
  updateAllStreetViewImages,
  scrapeSource,
  saveListings,
  createScrapeJob,
  updateScrapeJob,
} from '@/lib/scraper-service'
import { SCRAPE_SOURCES } from '@/lib/scraper-types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Trigger scraping
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // Parse body
    const body = await request.json().catch(() => ({}))
    
    // Allow cron jobs, admin requests, or if no secret is configured
    const isAuthorized = 
      !cronSecret || 
      authHeader === `Bearer ${cronSecret}` ||
      body.adminTrigger === true

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for Firecrawl API key
    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlKey) {
      return NextResponse.json({ 
        error: 'FIRECRAWL_API_KEY not configured',
        message: 'Please add your Firecrawl API key in Settings > Vars'
      }, { status: 500 })
    }

    // Determine scrape mode
    const {
      mode = 'full',           // 'full', 'single', 'streetview'
      source: sourceName,      // For single source mode
      deepCrawl = true,        // Follow pagination and state URLs
      maxPages = 20,           // Max pages per source
      priorityThreshold = 5,   // Minimum source priority to include
    } = body

    console.log(`[Scrape API] Starting ${mode} scrape`)

    let result: {
      totalFound?: number
      total_scraped?: number
      totalAdded?: number
      total_added?: number
      totalUpdated?: number
      total_updated?: number
      totalPages?: number
      sourcesProcessed?: number
      updated?: number
      failed?: number
      errors?: string[]
    }

    if (mode === 'streetview') {
      // Just update Street View images for existing properties
      const streetViewResult = await updateAllStreetViewImages(100)
      result = {
        updated: streetViewResult.updated,
        failed: streetViewResult.failed,
        errors: [],
      }
    } else if (mode === 'single' && sourceName) {
      // Scrape a single source
      const source = SCRAPE_SOURCES.find(s => s.name === sourceName)
      if (!source) {
        return NextResponse.json({ error: `Unknown source: ${sourceName}` }, { status: 400 })
      }

      const jobId = await createScrapeJob(source.name, `${source.base_url}${source.listing_pattern}`)
      
      if (jobId) {
        await updateScrapeJob(jobId, { status: 'running', started_at: new Date().toISOString() })
      }

      const { listings, pagesScraped, error } = await scrapeSource(source, {
        maxPages,
        deepCrawl,
        includeStateUrls: deepCrawl,
      })

      if (error) {
        if (jobId) {
          await updateScrapeJob(jobId, { 
            status: 'failed', 
            error_message: error,
            completed_at: new Date().toISOString() 
          })
        }
        return NextResponse.json({ error }, { status: 500 })
      }

      const saveResult = await saveListings(listings)

      if (jobId) {
        await updateScrapeJob(jobId, {
          status: 'completed',
          listings_found: listings.length,
          listings_added: saveResult.added,
          listings_updated: saveResult.updated,
          pages_scraped: pagesScraped,
          completed_at: new Date().toISOString(),
        })
      }

      result = {
        total_scraped: listings.length,
        total_added: saveResult.added,
        total_updated: saveResult.updated,
        totalPages: pagesScraped,
        errors: saveResult.errors,
      }
    } else {
      // Full aggressive scrape
      const scrapeResult = await runFullScrape({
        deepCrawl,
        maxPagesPerSource: maxPages,
        includeStateUrls: deepCrawl,
        priorityThreshold,
      })

      result = {
        total_scraped: scrapeResult.totalFound,
        total_added: scrapeResult.totalAdded,
        total_updated: scrapeResult.totalUpdated,
        totalPages: scrapeResult.totalPages,
        sourcesProcessed: scrapeResult.sourcesProcessed,
        errors: scrapeResult.errors,
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
      config: {
        mode,
        deepCrawl,
        maxPages,
        priorityThreshold,
      }
    })

  } catch (error: unknown) {
    console.error('[Scrape API] Error:', error)
    return NextResponse.json({ 
      error: 'Scrape failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Get scrape status and recent jobs
export async function GET() {
  try {
    // Get recent scrape jobs
    const { data: recentJobs } = await supabase
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    // Get property stats
    const { count: totalProperties } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })

    const { count: activeProperties } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { count: verifiedAddresses } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('address_verified', true)

    const { count: verifiedImages } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('image_verified', true)

    // Get source breakdown
    const { data: sourceBreakdown } = await supabase
      .from('properties')
      .select('source')
      .not('source', 'is', null)

    const sourceCounts: Record<string, number> = {}
    sourceBreakdown?.forEach((p: { source: string }) => {
      sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1
    })

    // Get available sources
    const availableSources = SCRAPE_SOURCES
      .filter(s => s.enabled)
      .map(s => ({
        name: s.name,
        priority: s.priority,
        hasStateUrls: !!s.state_urls?.length,
        maxPages: s.max_pages,
      }))

    return NextResponse.json({
      recentJobs: recentJobs || [],
      stats: {
        totalProperties,
        activeProperties,
        verifiedAddresses,
        verifiedImages,
        lastScrape: recentJobs?.[0]?.created_at,
      },
      sourceCounts,
      availableSources,
      config: {
        firecrawlConfigured: !!process.env.FIRECRAWL_API_KEY,
        googleMapsConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
        cronConfigured: !!process.env.CRON_SECRET,
      }
    })
  } catch (error: unknown) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
