import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

/**
 * Centralized AI configuration for the chatbot feature.
 *
 * Two ways to power the assistant — checked in this order:
 *
 *  1. Vercel AI Gateway (default, zero-config). When `AI_GATEWAY_API_KEY` (or a
 *     Vercel OIDC token in the Vercel runtime) is present, we pass a gateway
 *     model string like "openai/gpt-4o-mini" straight to the AI SDK. No API key
 *     handling in app code.
 *  2. A direct OpenAI key. If `OPENAI_API_KEY` is set it takes precedence and we
 *     talk to OpenAI directly. This lets you swap in your own ChatGPT key with
 *     zero code changes.
 *
 * Optional: `OPENAI_CHAT_MODEL` overrides the model id (default "gpt-4o-mini").
 *
 * When neither credential is available, `isAiConfigured()` returns false and the
 * AI routes respond with a clear, non-throwing "disabled" payload.
 */

export const AI_DISABLED_MESSAGE =
  'The AI assistant is not configured yet. Connect the Vercel AI Gateway (AI_GATEWAY_API_KEY) or add an OPENAI_API_KEY environment variable to enable it.'

export const DEFAULT_CHAT_MODEL = 'gpt-4o-mini'

/** True when a direct OpenAI key is present. */
function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0)
}

/** True when the Vercel AI Gateway is reachable (explicit key or OIDC runtime). */
function hasGateway(): boolean {
  return Boolean(
    (process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_API_KEY.trim().length > 0) ||
      (process.env.VERCEL_OIDC_TOKEN && process.env.VERCEL_OIDC_TOKEN.trim().length > 0),
  )
}

/** True when the assistant can run via EITHER the gateway or a direct key. */
export function isAiConfigured(): boolean {
  return hasOpenAiKey() || hasGateway()
}

/** The bare model id to use, overridable via OPENAI_CHAT_MODEL. */
export function getChatModelId(): string {
  return process.env.OPENAI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL
}

/**
 * Returns the language model for the assistant.
 * - Direct OpenAI key present  -> bound OpenAI provider model.
 * - Otherwise                  -> gateway model string ("openai/<model>").
 *
 * Callers MUST guard with `isAiConfigured()` first and return
 * `aiDisabledResponse()` when it is not configured.
 */
export function getChatModel(): LanguageModel {
  const modelId = getChatModelId()
  if (hasOpenAiKey()) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY!.trim() })
    return openai(modelId)
  }
  if (hasGateway()) {
    // Plain string routes through the Vercel AI Gateway using AI_GATEWAY_API_KEY / OIDC.
    return modelId.includes('/') ? modelId : `openai/${modelId}`
  }
  throw new Error('No AI credentials configured (set AI_GATEWAY_API_KEY or OPENAI_API_KEY)')
}

/** Standard 503 response used by AI routes when no credentials are configured. */
export function aiDisabledResponse(): Response {
  return Response.json({ error: AI_DISABLED_MESSAGE, aiConfigured: false }, { status: 503 })
}
