import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { Property } from '@/lib/types'

export const maxDuration = 30

const MODEL = 'openai/gpt-5.4-mini'

// nullable() (not optional()) for OpenAI strict mode compatibility
const cleanedSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  region: z
    .enum([
      'Northeast',
      'Southeast',
      'Midwest',
      'Southwest',
      'Mountain',
      'Pacific',
      'Pacific NW',
    ])
    .nullable(),
  units: z.number().int().nullable(),
  asking_price: z.number().nullable(),
  cap_rate: z.number().nullable(),
  lot_rent: z.number().nullable(),
  occupancy: z.number().nullable(),
  noi: z.number().nullable(),
  toh: z.number().int().nullable(),
  poh: z.number().int().nullable(),
  vacant: z.number().int().nullable(),
  notes: z.string().nullable(),
  changes: z.array(z.string()),
})

export async function POST(req: Request) {
  try {
    const { property } = (await req.json()) as { property: Property }

    if (!property) {
      return Response.json({ error: 'Missing property data' }, { status: 400 })
    }

    const raw = {
      name: property.name,
      address: property.address,
      city: property.city,
      state: property.state,
      region: property.region,
      units: property.units,
      asking_price: property.asking_price,
      cap_rate: property.cap_rate,
      lot_rent: property.lot_rent,
      occupancy: property.occupancy,
      noi: property.noi,
      toh: property.toh,
      poh: property.poh,
      vacant: property.vacant,
      notes: property.notes,
    }

    const { experimental_output } = await generateText({
      model: MODEL,
      experimental_output: Output.object({ schema: cleanedSchema }),
      system:
        'You normalize messy scraped manufactured housing community (mobile home park) listing data into clean, consistent values. ' +
        'Rules: ' +
        '1) State must be a 2-letter US uppercase abbreviation (e.g. "TX"). ' +
        '2) Map the location to the correct US region from the allowed list based on the state. ' +
        '3) Convert price/financial fields to plain numbers (strip "$", commas, "k"/"M" suffixes — e.g. "$2.5M" => 2500000). ' +
        '4) cap_rate and occupancy are percentages as plain numbers (e.g. 7.5, 92). If occupancy is given as a fraction like 0.92, convert to 92. ' +
        '5) Title-case property name and city; trim extra whitespace. ' +
        '6) units/toh/poh/vacant are integers. If toh+poh+vacant should equal units but do not, leave them as-is and note it in changes. ' +
        '7) If a value is genuinely unknown or cannot be cleaned, return null for it — never fabricate data. ' +
        '8) In "changes", list every field you modified and why, in short human-readable bullets. If nothing changed, return an empty array.',
      prompt:
        `Clean and normalize this scraped listing data. Return cleaned values for every field plus a "changes" log.\n\n` +
        `Raw data (JSON):\n${JSON.stringify(raw, null, 2)}`,
    })

    return Response.json({ cleaned: experimental_output })
  } catch (err) {
    console.error('[v0] AI cleanup error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to clean data' },
      { status: 500 },
    )
  }
}
