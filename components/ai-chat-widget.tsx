'use client'

import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai'
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Loader2,
  Check,
  Ban,
  Search,
  Wand2,
  FileText,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { SimpleMarkdown } from './simple-markdown'
import type { Property } from '@/lib/types'

interface AiChatWidgetProps {
  properties?: Property[]
  onListingUpdated?: (property: Property) => void
}

type ProposeInput = {
  listingId: string
  listingName: string
  changes: Record<string, string | number | boolean | null>
  reason: string
}

const SUGGESTIONS = [
  'Clean up the data for Woodbine Oaks',
  'Summarize the best mom & pop deal',
  'Which listings have a cap rate above 8%?',
]

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  address: 'Address',
  city: 'City',
  state: 'State',
  region: 'Region',
  units: 'Units',
  occupancy: 'Occupancy',
  cap_rate: 'Cap Rate',
  asking_price: 'Asking Price',
  noi: 'NOI',
  lot_rent: 'Lot Rent',
  mom_pop: 'Mom & Pop',
  toh: 'Tenant-Owned (TOH)',
  poh: 'Park-Owned (POH)',
  vacant: 'Vacant',
  notes: 'Notes',
  status: 'Status',
}

const MONEY_FIELDS = new Set(['asking_price', 'noi', 'lot_rent'])
const PERCENT_FIELDS = new Set(['occupancy', 'cap_rate'])

function fmtValue(field: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  if (field === 'mom_pop') return val ? 'Yes' : 'No'
  if (MONEY_FIELDS.has(field)) return '$' + Number(val).toLocaleString()
  if (PERCENT_FIELDS.has(field)) return `${val}%`
  return String(val)
}

function getText(message: UIMessage): string {
  if (!message.parts) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

const statusFetcher = (url: string) => fetch(url).then((r) => r.json())

export function AiChatWidget({ properties = [], onListingUpdated }: AiChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  // Is the assistant ready? (i.e. OPENAI_API_KEY is set on the server)
  const { data: aiStatus } = useSWR<{ configured: boolean; model: string | null }>(
    '/api/ai/status',
    statusFetcher,
  )
  // Treat as enabled until we know otherwise, so the UI doesn't flash disabled.
  const aiConfigured = aiStatus?.configured !== false

  const { messages, sendMessage, status, error, addToolOutput } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    // Auto-continue the conversation once a confirmation card has been answered
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  const isBusy = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isBusy || !aiConfigured) return
    sendMessage({ text: trimmed })
    setInput('')
  }

  async function applyUpdate(toolCallId: string, data: ProposeInput) {
    const payload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data.changes)) {
      if (v !== null && v !== undefined) payload[k] = v
    }
    if (Object.keys(payload).length === 0) {
      addToolOutput({
        tool: 'proposeListingUpdate',
        toolCallId,
        output: { applied: false, cancelled: true, note: 'No fields to update.' },
      })
      return
    }
    setPending((p) => ({ ...p, [toolCallId]: true }))
    try {
      const res = await fetch(`/api/properties/${data.listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(updated.error || 'Update failed')
      onListingUpdated?.(updated as Property)
      addToolOutput({
        tool: 'proposeListingUpdate',
        toolCallId,
        output: { applied: true, updatedFields: Object.keys(payload) },
      })
    } catch (e) {
      addToolOutput({
        tool: 'proposeListingUpdate',
        toolCallId,
        output: { applied: false, error: e instanceof Error ? e.message : 'Update failed' },
      })
    } finally {
      setPending((p) => {
        const next = { ...p }
        delete next[toolCallId]
        return next
      })
    }
  }

  function cancelUpdate(toolCallId: string) {
    addToolOutput({
      tool: 'proposeListingUpdate',
      toolCallId,
      output: { applied: false, cancelled: true },
    })
  }

  // Renders a confirmation card / status for a proposeListingUpdate tool part
  function renderProposal(
    toolCallId: string,
    state: string,
    input: ProposeInput | undefined,
    output: { applied?: boolean; cancelled?: boolean; error?: string } | undefined,
  ) {
    // While the tool input is still streaming, input or input.changes may be partial
    if (!input || !input.changes || typeof input.changes !== 'object') {
      return renderToolChip('Preparing proposal', <Wand2 className="w-3 h-3" />, false)
    }
    const current = properties.find((p) => p.id === input.listingId)
    const changedFields = Object.entries(input.changes).filter(
      ([, v]) => v !== null && v !== undefined,
    )

    // Resolved states
    if (state === 'output-available') {
      if (output?.applied) {
        return (
          <div className="rounded-lg border border-score-high/30 bg-score-high/10 px-3 py-2 text-sm text-score-high flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            Update applied to {input.listingName}.
          </div>
        )
      }
      if (output?.error) {
        return (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {output.error}
          </div>
        )
      }
      return (
        <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
          <Ban className="w-4 h-4 flex-shrink-0" />
          Change cancelled.
        </div>
      )
    }

    // Pending confirmation card
    const isApplying = pending[toolCallId]
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">
            Proposed update — {input.listingName}
          </p>
        </div>
        {input.reason && <p className="text-xs text-muted-foreground">{input.reason}</p>}

        <div className="space-y-1.5">
          {changedFields.map(([field, newVal]) => (
            <div key={field} className="text-xs flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground min-w-[90px]">
                {FIELD_LABELS[field] ?? field}
              </span>
              <span className="text-muted-foreground line-through">
                {fmtValue(field, current ? (current as Record<string, unknown>)[field] : undefined)}
              </span>
              <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="font-semibold text-primary">{fmtValue(field, newVal)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => applyUpdate(toolCallId, input)}
            disabled={isApplying}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isApplying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Apply
          </button>
          <button
            onClick={() => cancelUpdate(toolCallId)}
            disabled={isApplying}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            <Ban className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Small status chip for read-only / lookup tools
  function renderToolChip(label: string, icon: React.ReactNode, done: boolean) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
        {done ? icon : <Loader2 className="w-3 h-3 animate-spin" />}
        {label}
      </div>
    )
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col w-[calc(100vw-3rem)] max-w-md h-[600px] max-h-[calc(100vh-8rem)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Acquisition Assistant</h3>
              <p className="text-xs text-muted-foreground">Ask, analyze &amp; edit listings</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {!aiConfigured && (
              <div className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-muted-foreground flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                <span>
                  The assistant is not connected yet. Add an{' '}
                  <code className="font-mono text-xs text-foreground">OPENAI_API_KEY</code>{' '}
                  environment variable to enable chat, data cleanup, and deal summaries.
                </span>
              </div>
            )}

            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hi! I can analyze your portfolio, clean up listing data, write deal summaries, and
                  edit listings (with your confirmation). Try one of these:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="text-left text-sm px-3 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === 'user'
              if (isUser) {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-primary text-primary-foreground">
                      <p className="text-sm whitespace-pre-wrap">{getText(message)}</p>
                    </div>
                  </div>
                )
              }

              // Assistant message: render parts in order (text + tool cards)
              return (
                <div key={message.id} className="flex justify-start">
                  <div className="max-w-[90%] w-full space-y-2">
                    {message.parts?.map((part, i) => {
                      const key = `${message.id}-${i}`

                      if (part.type === 'text') {
                        if (!part.text) return null
                        return (
                          <div
                            key={key}
                            className="rounded-2xl px-4 py-2.5 bg-secondary text-foreground"
                          >
                            <SimpleMarkdown content={part.text} />
                          </div>
                        )
                      }

                      if (part.type === 'tool-proposeListingUpdate') {
                        const p = part as unknown as {
                          toolCallId: string
                          state: string
                          input?: ProposeInput
                          output?: { applied?: boolean; cancelled?: boolean; error?: string }
                        }
                        return (
                          <div key={key}>
                            {renderProposal(p.toolCallId, p.state, p.input, p.output)}
                          </div>
                        )
                      }

                      if (part.type === 'tool-findListings') {
                        const done = (part as { state: string }).state === 'output-available'
                        return (
                          <div key={key}>
                            {renderToolChip('Searched listings', <Search className="w-3 h-3" />, done)}
                          </div>
                        )
                      }

                      if (part.type === 'tool-cleanupListingData') {
                        const done = (part as { state: string }).state === 'output-available'
                        return (
                          <div key={key}>
                            {renderToolChip('Cleaned data', <Wand2 className="w-3 h-3" />, done)}
                          </div>
                        )
                      }

                      if (part.type === 'tool-generateDealSummary') {
                        const done = (part as { state: string }).state === 'output-available'
                        return (
                          <div key={key}>
                            {renderToolChip('Built summary', <FileText className="w-3 h-3" />, done)}
                          </div>
                        )
                      }

                      return null
                    })}

                    {/* Spinner if assistant has produced nothing yet */}
                    {(!message.parts || message.parts.every((p) => p.type === 'step-start')) && (
                      <div className="rounded-2xl px-4 py-2.5 bg-secondary inline-block">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {status === 'submitted' && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl px-4 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {/not configured|api[_ ]?key|401|unauthor/i.test(error.message)
                  ? 'The assistant could not authenticate. Check that OPENAI_API_KEY is set correctly, then try again.'
                  : /rate.?limit|429/i.test(error.message)
                    ? 'The assistant is rate-limited right now. Please wait a moment and try again.'
                    : error.message || 'Something went wrong. Please try again.'}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(input)
            }}
            className="flex items-center gap-2 p-3 border-t border-border bg-card"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!aiConfigured}
              placeholder={aiConfigured ? 'Ask, or request an edit...' : 'Add OPENAI_API_KEY to enable'}
              className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isBusy || !input.trim() || !aiConfigured}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
