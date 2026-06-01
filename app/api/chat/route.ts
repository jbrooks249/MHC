import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import type { Property } from '@/lib/types'

export const maxDuration = 30

const MODEL = 'openai/gpt-5.4-mini'

function compactProperty(p: Property): string {
  return [
    p.name,
    [p.city, p.state].filter(Boolean).join(', '),
    p.region ?? '',
    `${p.units ?? '?'} units`,
    p.asking_price != null ? `$${p.asking_price.toLocaleString()}` : 'price N/A',
    p.cap_rate != null ? `${p.cap_rate}% cap` : 'cap N/A',
    p.occupancy != null ? `${p.occupancy}% occ` : 'occ N/A',
    p.ai_score != null ? `AI ${p.ai_score}` : '',
    p.mom_pop ? 'mom&pop' : '',
    p.status === 'sold' ? 'SOLD' : 'active',
  ]
    .filter(Boolean)
    .join(' | ')
}

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: UIMessage[] }

    // Pull live listing data so the assistant can answer questions about the portfolio
    let portfolioContext = 'No listing data available.'
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('properties')
        .select('*')
        .order('ai_score', { ascending: false })
        .limit(200)

      if (data && data.length > 0) {
        const properties = data as Property[]
        const lines = properties.map((p, i) => `${i + 1}. ${compactProperty(p)}`)
        portfolioContext =
          `There are ${properties.length} listings in the database (showing up to 200, sorted by AI score):\n` +
          lines.join('\n')
      }
    } catch (e) {
      console.error('[v0] chat: failed to load properties', e)
    }

    const result = streamText({
      model: MODEL,
      system:
        'You are the MHC Acquisition Intelligence assistant, an expert in manufactured housing community (mobile home park) investing. ' +
        'You help the acquisition team explore and analyze their listing database. ' +
        'Answer questions using ONLY the listing data provided below. When asked for rankings, comparisons, or filtering, reason over this data. ' +
        'Be concise and use markdown (tables and bullet lists) where helpful. ' +
        'If the answer is not in the data, say so plainly rather than guessing.\n\n' +
        `=== LISTING DATA ===\n${portfolioContext}`,
      messages: await convertToModelMessages(messages),
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error('[v0] chat error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 },
    )
  }
}
