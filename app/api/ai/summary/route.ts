import { generateText } from 'ai'
import type { Property } from '@/lib/types'

// Do NOT use edge runtime with the AI SDK
export const maxDuration = 30

const MODEL = 'openai/gpt-5.4-mini'

function buildPropertyContext(p: Property): string {
  const lines: string[] = [
    `Name: ${p.name}`,
    `Location: ${[p.address, p.city, p.state].filter(Boolean).join(', ')}`,
    `Region: ${p.region ?? 'Unknown'}`,
    `Status: ${p.status ?? 'active'}`,
    `Total Units / Pads: ${p.units ?? 'Unknown'}`,
    `Occupancy: ${p.occupancy != null ? p.occupancy + '%' : 'Unknown'}`,
    `Asking Price: ${p.asking_price != null ? '$' + p.asking_price.toLocaleString() : 'Unknown'}`,
    `Cap Rate: ${p.cap_rate != null ? p.cap_rate + '%' : 'Unknown'}`,
    `NOI: ${p.noi != null ? '$' + p.noi.toLocaleString() : 'Unknown'}`,
    `Price per Pad: ${p.price_per_pad != null ? '$' + p.price_per_pad.toLocaleString() : 'Unknown'}`,
    `Lot Rent: ${p.lot_rent != null ? '$' + p.lot_rent + '/mo' : 'Unknown'}`,
    `Tenant-Owned Homes (TOH): ${p.toh ?? 'Unknown'}`,
    `Park-Owned Homes (POH): ${p.poh ?? 'Unknown'}`,
    `Vacant: ${p.vacant ?? 'Unknown'}`,
    `Mom & Pop Owned: ${p.mom_pop ? 'Yes' : 'No'}`,
    `Median Home Price (area): ${p.median_home_price != null ? '$' + p.median_home_price.toLocaleString() : 'Unknown'}`,
    `Avg 2BR Rent (area): ${p.avg_2br_rent != null ? '$' + p.avg_2br_rent + '/mo' : 'Unknown'}`,
    `Avg 3BR Rent (area): ${p.avg_3br_rent != null ? '$' + p.avg_3br_rent + '/mo' : 'Unknown'}`,
    `Existing AI Score: ${p.ai_score ?? 'Unscored'}`,
  ]
  if (p.notes) lines.push(`Notes: ${p.notes}`)
  return lines.join('\n')
}

export async function POST(req: Request) {
  try {
    const { property } = (await req.json()) as { property: Property }

    if (!property) {
      return Response.json({ error: 'Missing property data' }, { status: 400 })
    }

    const { text } = await generateText({
      model: MODEL,
      system:
        'You are a senior acquisitions analyst specializing in manufactured housing communities (mobile home parks). ' +
        'You write concise, decision-oriented investment summaries for an acquisition team. ' +
        'Be direct and specific. Use the data provided; when a metric is unknown, note it as a diligence item rather than guessing. ' +
        'Never invent numbers that are not supported by the data.',
      prompt:
        `Write an investment summary for the following manufactured housing community.\n\n` +
        `${buildPropertyContext(property)}\n\n` +
        `Structure the response in markdown with these sections:\n` +
        `## Overview — 2-3 sentences on the deal at a glance.\n` +
        `## Strengths — bullet points of what makes this attractive.\n` +
        `## Risks & Diligence — bullet points of concerns and missing data to verify.\n` +
        `## Recommendation — a clear take (Pursue / Watch / Pass) with one sentence of reasoning.\n\n` +
        `Keep the whole summary under 250 words.`,
    })

    return Response.json({ summary: text })
  } catch (err) {
    console.error('[v0] AI summary error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to generate summary' },
      { status: 500 },
    )
  }
}
