# Production Migration Notes

The prototype is deliberately built so production migration is a swap of three thin adapters. The engine, database schema, prompt library, and journey content are all unchanged.

## 1. Meta Cloud API → Infobip

Infobip wraps the Meta WhatsApp Cloud API. They handle the channel registration and provide a normalised API surface.

**Migration steps:**

1. Create an Infobip account and connect your WhatsApp business number through their dashboard.
2. Update **`src/whatsapp/sender.ts`**:
   - Replace the `https://graph.facebook.com/v19.0/...` endpoint with Infobip's `https://<base-url>.api.infobip.com/whatsapp/1/message/...` endpoints (`text`, `interactive-buttons`, `interactive-list`).
   - Replace `Authorization: Bearer <token>` with `Authorization: App <INFOBIP_API_KEY>`.
   - Adapt the request bodies to Infobip's schema (the fields are similar: `from`, `to`, `content`).
3. Update **`src/whatsapp/parser.ts`** to consume Infobip's inbound payload shape:
   ```json
   {
     "results": [
       {
         "from": "639171234567",
         "to": "639XXXXXXXXX",
         "messageId": "string",
         "message": {
           "type": "TEXT",
           "text": "Hello coach"
         }
       }
     ]
   }
   ```
   The output of `parseWebhook` (`InboundMessage[]`) is unchanged — the engine consumes the same normalised shape.
4. Replace env vars: `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` → `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_SENDER_NUMBER`.
5. The mark-as-read flow can be removed; Infobip handles delivery receipts internally (or use their inbound delivery report webhook).

Nothing in `src/engine/`, `src/ai/`, `src/db/`, or `src/journeys/` should need to change.

## 2. Gemini → Claude

1. `npm install @anthropic-ai/sdk`
2. Replace **`src/ai/geminiClient.ts`** with a thin Anthropic client:

   ```ts
   import Anthropic from '@anthropic-ai/sdk';
   const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

   export async function generate(input: GenerateInput): Promise<string> {
     const res = await client.messages.create({
       model: 'claude-sonnet-4-6',
       system: systemPrompt,
       max_tokens: 1024,
       messages: [
         {
           role: 'user',
           content: `${modeGuidance(input.mode)}\n\nSTEP CONTEXT:\n${input.stepGuidance}\n\nTURN COUNT: ${input.turnCount}`,
         },
         ...input.history.map((t) => ({
           role: t.role === 'assistant' ? 'assistant' : ('user' as const),
           content: t.content,
         })),
         { role: 'user', content: input.latestUserMessage },
       ],
     });
     const block = res.content[0];
     return block.type === 'text' ? block.text : '';
   }
   ```

3. Replace `GEMINI_API_KEY` with `ANTHROPIC_API_KEY`.
4. The `GenerateInput` shape and the `parseAIResponse` consumer are unchanged.
5. Add prompt caching (`cache_control`) to the system prompt and stable history prefix for cost/latency wins.
6. Prompt files in `src/ai/prompts/` are unchanged.

## 3. In-Memory Sessions → Upstash Redis

1. `npm install @upstash/redis`
2. Replace the `Map` in **`src/engine/sessionManager.ts`** with an Upstash client:

   ```ts
   import { Redis } from '@upstash/redis';
   const redis = Redis.fromEnv();

   const KEY = (n: string) => `session:${n}`;
   const TTL = 1800; // 30 min

   export async function getSession(n: string) {
     return await redis.get<Session>(KEY(n));
   }
   export async function setSession(s: Session) {
     await redis.set(KEY(s.whatsappNumber), s, { ex: TTL });
   }
   // ... etc.
   ```

3. The function signatures become `async`. Callers in `flowRouter.ts` already use `await` patterns where the value is needed, so the change is mostly mechanical.
4. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars.
5. Remove the `startSessionSweeper` call from `src/index.ts` — Redis TTL handles expiry. If you still want an `onExpire` hook, subscribe to Redis keyspace notifications.

## 4. Other Production Considerations

- **Permanent Meta/Infobip credentials**: temporary tokens expire. For Meta, generate a system user token. For Infobip, the API key is already long-lived.
- **Voice notes**: integrate Whisper or Deepgram in `flowRouter.handleInbound` where unsupported types are currently rejected.
- **Observability**: ship the structured JSON logs to Datadog or Logflare. Each line already contains `session_id`, `step`, `mode`, masked number, and timestamp.
- **Rate limits**: Meta enforces per-number rate limits. The sender logs `429` warnings; in production add backoff and queueing.
- **Privacy**: only the last 4 digits of the WhatsApp number are logged. Apply the same redaction to error reporting and analytics.
