import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

/**
 * Centralized AI configuration for the chatbot feature.
 *
 * KEY-READY DESIGN
 * ----------------
 * The assistant is powered exclusively by the OpenAI (ChatGPT) API, read from
 * the `OPENAI_API_KEY` environment variable. There is intentionally NO coupling
 * to the Vercel AI Gateway or any other provider here — this keeps the
 * integration layer simple and predictable so a ChatGPT key can be dropped in
 * later with zero code changes.
 *
 * Behavior:
 *  - When `OPENAI_API_KEY` is set, the chatbot works immediately.
 *  - When it is not set, `isAiConfigured()` returns false and every AI route
 *    returns a clear, non-throwing "disabled" payload (see `aiDisabledResponse`).
 *    No network calls to OpenAI are attempted.
 *
 * Optional overrides:
 *  - `OPENAI_CHAT_MODEL` — model id to use (default "gpt-4o-mini").
 *  - `OPENAI_BASE_URL`   — custom/compatible endpoint, if ever needed.
 */

export const AI_DISABLED_MESSAGE =
  'The AI assistant is not configured yet. Add an OPENAI_API_KEY environment variable to enable it.'

export const DEFAULT_CHAT_MODEL = 'gpt-4o-mini'

/** The trimmed OpenAI API key, or an empty string when unset. */
function getOpenAiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? ''
}

/**
 * True when a usable OpenAI API key is present.
 * Callers MUST guard with this before calling `getChatModel()`.
 */
export function isAiConfigured(): boolean {
  return getOpenAiKey().length > 0
}

/** The bare model id to use, overridable via OPENAI_CHAT_MODEL. */
export function getChatModelId(): string {
  return process.env.OPENAI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL
}

/**
 * Returns the OpenAI language model for the assistant.
 *
 * Throws if no key is configured — this is a programming error, since callers
 * are required to short-circuit with `aiDisabledResponse()` when
 * `isAiConfigured()` is false. The throw is a safety net, never the disabled
 * path users actually hit.
 */
export function getChatModel(): LanguageModel {
  const apiKey = getOpenAiKey()
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Guard AI calls with isAiConfigured() and return aiDisabledResponse().',
    )
  }

  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined
  const openai = createOpenAI({ apiKey, baseURL })
  return openai(getChatModelId())
}

/** Standard 503 response used by AI routes when no API key is configured. */
export function aiDisabledResponse(): Response {
  return Response.json({ error: AI_DISABLED_MESSAGE, aiConfigured: false }, { status: 503 })
}
