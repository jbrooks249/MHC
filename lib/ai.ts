import { createOpenAI } from '@ai-sdk/openai'

/**
 * Centralized AI configuration for the chatbot feature.
 *
 * Credentials are read from environment variables so the integration can be
 * swapped to a real ChatGPT/OpenAI API key with ZERO code changes:
 *
 *   OPENAI_API_KEY     (required) — your ChatGPT/OpenAI secret key
 *   OPENAI_CHAT_MODEL  (optional) — model id, defaults to "gpt-4o-mini"
 *
 * When OPENAI_API_KEY is not set, `isAiConfigured()` returns false and the AI
 * routes respond with a clear, non-throwing "disabled" payload. As soon as the
 * key is added to the environment, the assistant works immediately.
 */

export const AI_DISABLED_MESSAGE =
  'The AI assistant is not configured yet. Add an OPENAI_API_KEY environment variable to enable it.'

export const DEFAULT_CHAT_MODEL = 'gpt-4o-mini'

/** True only when a non-empty OpenAI API key is present in the environment. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0)
}

/** The model id to use, overridable via OPENAI_CHAT_MODEL. */
export function getChatModelId(): string {
  return process.env.OPENAI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL
}

/**
 * Returns a configured OpenAI language model bound to OPENAI_API_KEY.
 * Throws if the key is missing — callers MUST guard with `isAiConfigured()`
 * first and return `aiDisabledResponse()` when it is not configured.
 */
export function getChatModel() {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  const openai = createOpenAI({ apiKey })
  return openai(getChatModelId())
}

/** Standard 503 response used by AI routes when the key is not configured. */
export function aiDisabledResponse(): Response {
  return Response.json({ error: AI_DISABLED_MESSAGE, aiConfigured: false }, { status: 503 })
}
