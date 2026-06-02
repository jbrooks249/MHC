import {
  streamText,
  convertToModelMessages,
  tool,
  stepCountIs,
  generateText,
  Output,
  type UIMessage,
} from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Property } from '@/lib/types'
import { getChatModel, isAiConfigured, aiDisabledResponse } from '@/lib/ai'

export const maxDuration = 30

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

// Region values the cleanup step is allowed to use
const REGIONS = [
  'Northeast',
  'Southeast',
  'Midwest',
  'Southwest',
  'Mountain',
  'Pacific',
  'Pacific NW',
] as const

// The editable fields the assistant may propose to change.
// All fields are nullable: null means "leave this field unchanged".
const updatableFields = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  region: z.string().nullable(),
  units: z.number().int().nullable(),
  occupancy: z.number().nullable(),
  cap_rate: z.number().nullable(),
  asking_price: z.number().nullable(),
  noi: z.number().nullable(),
  lot_rent: z.number().nullable(),
  mom_pop: z.boolean().nullable(),
  toh: z.number().int().nullable(),
  poh: z.number().int().nullable(),
  vacant: z.number().int().nullable(),
  notes: z.string().nullable(),
  status: z.enum(['active', 'sold', 'pending']).nullable(),
})

const cleanedSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  region: z.enum(REGIONS).nullable(),
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
  // Key-ready guard: no OpenAI key => respond with a clear disabled payload
  // instead of throwing. Works immediately once OPENAI_API_KEY is added.
  if (!isAiConfigured()) {
    return aiDisabledResponse()
  }

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
      model: getChatModel(),
      system:
        'You are the MHC Acquisition Intelligence assistant, an expert in manufactured housing community (mobile home park) investing. ' +
        'You help the acquisition team explore their listing database AND make edits to listing data. ' +
        'Answer analytical questions using the LISTING DATA provided below; if the answer is not in the data, say so plainly.\n\n' +
        'CAPABILITIES (use tools):\n' +
        '- To edit, clean, or summarize a SPECIFIC listing, FIRST call findListings to resolve the listing id. If multiple listings match, ask the user which one.\n' +
        '- generateDealSummary(listingId): read-only investment summary. Safe to run on request.\n' +
        '- cleanupListingData(listingId): returns normalized/cleaned values plus a change log. This does NOT save anything. After calling it, you MUST call proposeListingUpdate with the cleaned values so the user can confirm.\n' +
        '- proposeListingUpdate(listingId, listingName, changes, reason): proposes an edit. This shows the user a confirmation card and is the ONLY way changes get applied. Put ONLY the fields you want to change in "changes" and set every other field to null. Never fabricate values.\n\n' +
        'RULES:\n' +
        '1) NEVER claim a listing was updated unless a proposeListingUpdate tool result comes back with applied=true. The user must confirm first.\n' +
        '2) When the user asks to change a value (e.g. "set the cap rate to 7.5"), resolve the listing, then call proposeListingUpdate with just that field.\n' +
        '3) Keep replies concise; use markdown (tables, bullets) where helpful.\n' +
        '4) After a change is applied, briefly confirm what changed.\n\n' +
        `=== LISTING DATA ===\n${portfolioContext}`,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(8),
      tools: {
        findListings: tool({
          description:
            'Search the listing database by name, city, or state. Returns matching listings with their id and key fields. Call this first to resolve which listing the user means before editing, cleaning, or summarizing.',
          inputSchema: z.object({
            query: z.string().describe('A name, city, or state to search for'),
          }),
          execute: async ({ query }) => {
            try {
              const supabase = await createClient()
              const q = query.trim()
              const { data } = await supabase
                .from('properties')
                .select(
                  'id, name, city, state, region, units, occupancy, cap_rate, asking_price, noi, lot_rent, mom_pop, status, ai_score',
                )
                .or(`name.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
                .limit(8)
              return {
                count: data?.length ?? 0,
                listings: data ?? [],
              }
            } catch (e) {
              return { error: e instanceof Error ? e.message : 'Search failed', listings: [] }
            }
          },
        }),

        generateDealSummary: tool({
          description:
            'Generate a concise investment deal summary for a specific listing by id. Read-only — does not modify anything.',
          inputSchema: z.object({
            listingId: z.string().describe('The id of the listing to summarize'),
          }),
          execute: async ({ listingId }) => {
            try {
              const supabase = await createClient()
              const { data: p } = await supabase
                .from('properties')
                .select('*')
                .eq('id', listingId)
                .single()
              if (!p) return { error: 'Listing not found' }
              const prop = p as Property
              const { text } = await generateText({
                model: getChatModel(),
                system:
                  'You are a senior acquisitions analyst for manufactured housing communities. Write a concise, decision-oriented investment summary. Use only the data provided; flag unknowns as diligence items. Never invent numbers.',
                prompt:
                  `Write an investment summary for this listing in markdown with sections ## Overview, ## Strengths, ## Risks & Diligence, ## Recommendation (Pursue / Watch / Pass). Under 220 words.\n\n` +
                  JSON.stringify(prop, null, 2),
              })
              return { summary: text }
            } catch (e) {
              return { error: e instanceof Error ? e.message : 'Failed to generate summary' }
            }
          },
        }),

        cleanupListingData: tool({
          description:
            'Analyze a listing by id and return normalized/cleaned field values plus a list of proposed changes. Does NOT save. After calling this, call proposeListingUpdate with the cleaned values so the user can confirm.',
          inputSchema: z.object({
            listingId: z.string().describe('The id of the listing to clean'),
          }),
          execute: async ({ listingId }) => {
            try {
              const supabase = await createClient()
              const { data: p } = await supabase
                .from('properties')
                .select('*')
                .eq('id', listingId)
                .single()
              if (!p) return { error: 'Listing not found' }
              const prop = p as Property
              const raw = {
                name: prop.name,
                address: prop.address,
                city: prop.city,
                state: prop.state,
                region: prop.region,
                units: prop.units,
                asking_price: prop.asking_price,
                cap_rate: prop.cap_rate,
                lot_rent: prop.lot_rent,
                occupancy: prop.occupancy,
                noi: prop.noi,
                toh: prop.toh,
                poh: prop.poh,
                vacant: prop.vacant,
                notes: prop.notes,
              }
              const { experimental_output } = await generateText({
                model: getChatModel(),
                experimental_output: Output.object({ schema: cleanedSchema }),
                system:
                  'You normalize messy scraped mobile home park listing data into clean values. ' +
                  'Rules: state = 2-letter uppercase US abbreviation; region must be one of the allowed values based on the state; ' +
                  'prices/financials are plain numbers (strip $, commas, k/M suffixes); cap_rate and occupancy are percentages as plain numbers (convert 0.92 -> 92); ' +
                  'title-case name and city; units/toh/poh/vacant are integers; if a value is truly unknown return null (never fabricate); ' +
                  'in "changes", list every field you modified and why in short bullets, or return an empty array if nothing changed.',
                prompt: `Clean and normalize this listing data:\n${JSON.stringify(raw, null, 2)}`,
              })
              return { listingId, cleaned: experimental_output }
            } catch (e) {
              return { error: e instanceof Error ? e.message : 'Failed to clean data' }
            }
          },
        }),

        // No execute: this is handled client-side as a human-in-the-loop confirmation.
        proposeListingUpdate: tool({
          description:
            'Propose an update to a listing. Shows the user a confirmation card; the change is ONLY applied after the user confirms. Include ONLY the fields to change in "changes" (set all others to null) and a short reason.',
          inputSchema: z.object({
            listingId: z.string(),
            listingName: z.string(),
            changes: updatableFields,
            reason: z.string().describe('A short, human-readable reason for the change'),
          }),
        }),
      },
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
