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
        'You help the acquisition team explore their listing database AND edit/update listings end-to-end. ' +
        'Your job is to do as much of the work as possible for the user with minimal back-and-forth: be proactive, decisive, and complete the full request in one turn whenever you safely can. ' +
        'Answer analytical questions using the LISTING DATA below; if the answer is not in the data, say so plainly.\n\n' +
        'TOOLS:\n' +
        '- findListings(query): search by name, city, or state and resolve the listing id(s). Call this FIRST for any edit/clean/summary request that names a specific listing.\n' +
        '- generateDealSummary(listingId): read-only investment summary. Run it directly when asked.\n' +
        '- cleanupListingData(listingId): returns cleaned values AND a ready-to-use "proposedChanges" diff (only fields that differ). Does NOT save.\n' +
        '- proposeListingUpdate(listingId, listingName, changes, reason): the ONLY way changes are applied. It shows the user a confirmation card; the edit happens only after they click Apply. In "changes", include ONLY the fields to modify and set every other field to null.\n\n' +
        'OPERATING PROCEDURE — follow without asking for permission to use tools:\n' +
        '1) EDIT A FIELD ("set cap rate on Oak Park to 7.5", "mark X as sold", "rename Y to Z", "update the notes to ..."): call findListings, then immediately call proposeListingUpdate with just the requested field(s). Parse natural values yourself ($1.2M -> 1200000, "92%" -> 92).\n' +
        '2) CLEAN UP A LISTING: call findListings, then cleanupListingData, then — if hasChanges is true — immediately call proposeListingUpdate passing proposedChanges verbatim as "changes". If hasChanges is false, tell the user the data is already clean and do NOT propose anything.\n' +
        '3) DEAL SUMMARY: call findListings (if a name is given), then generateDealSummary, then present the summary.\n' +
        '4) BULK / "DO EVERYTHING" REQUESTS ("clean up all Texas parks", "mark these three as sold"): resolve the set with findListings, then emit a SEPARATE proposeListingUpdate for EACH affected listing in the same turn so the user gets one confirmation card per listing.\n\n' +
        'DECISION RULES:\n' +
        '- If exactly one listing matches, proceed without asking. Only ask the user to choose when findListings returns multiple plausible matches, or when a requested value is missing/unparseable.\n' +
        '- NEVER fabricate values. Only propose fields the user explicitly requested or values derived from cleanupListingData / clear arithmetic.\n' +
        '- NEVER claim a listing was updated unless a proposeListingUpdate result returns applied=true. Until then, say the change is "ready for your confirmation".\n' +
        '- After a change returns applied=true, confirm in one short sentence exactly what changed. If applied=false/cancelled, acknowledge it was not saved and offer to revise.\n' +
        '- Do not stop after a read-only/cleanup tool when the user asked for an edit — always continue to the proposeListingUpdate step.\n' +
        '- Keep replies concise; use markdown (tables, bullets) where helpful.\n\n' +
        `=== LISTING DATA ===\n${portfolioContext}`,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(12),
      tools: {
        findListings: tool({
          description:
            'Search the listing database by name, city, or state. Returns matching listings with their id and key fields. Call this first to resolve which listing the user means before editing, cleaning, or summarizing.',
          inputSchema: z.object({
            query: z.string().describe('A name, city, or state to search for'),
          }),
          execute: async ({ query }) => {
            try {
              const q = query.trim()
              if (q.length < 2) {
                return {
                  count: 0,
                  listings: [],
                  note: 'Query too short — ask the user for the listing name, city, or state.',
                }
              }
              // Escape characters that have special meaning inside a PostgREST ilike pattern.
              const safe = q.replace(/[%,()]/g, ' ')
              const supabase = await createClient()
              const { data } = await supabase
                .from('properties')
                .select(
                  'id, name, city, state, region, units, occupancy, cap_rate, asking_price, noi, lot_rent, mom_pop, status, ai_score',
                )
                .or(`name.ilike.%${safe}%,city.ilike.%${safe}%,state.ilike.%${safe}%`)
                .order('ai_score', { ascending: false })
                .limit(8)
              const listings = data ?? []
              return {
                count: listings.length,
                listings,
                note:
                  listings.length === 0
                    ? 'No matches. Ask the user to rephrase or check the name.'
                    : listings.length === 1
                      ? 'Exactly one match — proceed without asking.'
                      : 'Multiple matches — if the user was not specific, ask which one.',
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
            'Analyze a listing by id and return normalized/cleaned values. Does NOT save. ' +
            'The result includes "proposedChanges" — an object containing ONLY the fields that actually differ from the current values, ' +
            'already typed correctly for proposeListingUpdate. You MUST immediately call proposeListingUpdate and pass proposedChanges as its "changes" so the user can confirm. ' +
            'If proposedChanges is empty, tell the user the data is already clean and do NOT call proposeListingUpdate.',
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

              // Compute the exact diff so the model can pass it straight to proposeListingUpdate.
              // Only fields whose cleaned value is non-null AND actually differs from the
              // current stored value are included; everything else stays unchanged.
              const cleaned = experimental_output as Record<string, unknown>
              const proposedChanges: Record<string, unknown> = {}
              const diffFields = [
                'name', 'address', 'city', 'state', 'region', 'units', 'asking_price',
                'cap_rate', 'lot_rent', 'occupancy', 'noi', 'toh', 'poh', 'vacant', 'notes',
              ] as const
              for (const field of diffFields) {
                const next = cleaned[field]
                if (next === null || next === undefined) continue
                const currentVal = (prop as unknown as Record<string, unknown>)[field] ?? null
                const norm = (v: unknown) =>
                  typeof v === 'string' ? v.trim().toLowerCase() : v
                if (norm(next) !== norm(currentVal)) {
                  proposedChanges[field] = next
                }
              }

              return {
                listingId,
                listingName: prop.name,
                cleaned: experimental_output,
                proposedChanges,
                hasChanges: Object.keys(proposedChanges).length > 0,
              }
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
