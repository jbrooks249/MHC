import { isAiConfigured, getChatModelId } from '@/lib/ai'

// Lets the client know whether the assistant is ready (i.e. the API key is set)
// so the chat UI can render a clear disabled state instead of failing on send.
export async function GET() {
  const configured = isAiConfigured()
  return Response.json({
    configured,
    model: configured ? getChatModelId() : null,
  })
}
