# portfolio

Varun Lohade's site. The whole thing is a Claude Code-style terminal — visitors
type commands or ask questions in plain English.

```sh
npm install
npm run dev      # http://localhost:4321
```

## Layout

| Path | What it is |
| --- | --- |
| `src/data/site.ts` | **Single source of truth.** Identity, work, now, contact, and the offline keyword rules. |
| `src/data/prompt.ts` | Builds the model's system prompt from `site.ts`. |
| `src/scripts/terminal.ts` | The terminal: rendering, streaming, commands, history, slash menu. |
| `src/styles/terminal.css` | Dark-only terminal theme + post-page styles. |
| `src/pages/api/ask.ts` | The only server route. Everything else is prerendered. |
| `src/content/posts/` | Writing. Drop in an `.mdx` file and it appears in `writing`. |

Edit `site.ts` and the terminal, the model's knowledge, and the no-JS fallback
all update together.

## The `/api/ask` route

Free-form questions go to a small open-weights model
(`@cf/meta/llama-3.2-3b-instruct` on Cloudflare Workers AI). Commands
(`about`, `work`, `ls`, `cat`, …) stay local and never hit it.

Copy `.env.example` to `.env` and fill in `CF_ACCOUNT_ID` / `CF_API_TOKEN`.
**With no keys set the site still works** — the route returns 503 and the
terminal falls back to the keyword rules in `site.ts`.

It speaks the OpenAI-compatible chat-completions shape, so switching to Groq,
OpenRouter, or a local Ollama is two env vars — see `.env.example`.

### Guardrails

The endpoint is public and holds an API key, so it's layered:

1. **Rate limit** — 6 requests/min per IP, applied before parsing.
2. **Daily budget** — `AI_DAILY_LIMIT` (default 100) questions/day site-wide.
   Once spent, the route returns 503 and the terminal falls back to the keyword
   rules, so the site degrades instead of breaking.
3. **Input caps** — 300 chars in, 200 tokens out.
4. **Pattern filter** — classic injection openers ("ignore previous
   instructions", "you are now", "system prompt") are rejected with no model
   call at all.
5. **Guard model call** — a separate classification call decides ALLOW/BLOCK
   before the answering call runs. Blocked messages never reach the answering
   model. The message is passed as tagged, explicitly-untrusted data.
6. **Answering system prompt** — constrained to the facts in `site.ts`, told to
   say "I don't know" rather than guess.
7. **Rendering** — model output is inserted as text nodes, never HTML.

The guard **fails open** on an infrastructure error: an unreachable classifier
isn't evidence of an attack, and layer 6 still applies. An explicit `BLOCK`
always blocks.

### The actual spend ceiling

Layers 1–7 are best-effort and **in-process**. Serverless instances don't share
memory, so both the per-IP rate limit and the daily budget are per instance:
the real ceiling is `AI_DAILY_LIMIT × live instances`, and both counters reset
whenever an instance recycles. They're speed bumps, not walls.

For a genuinely global cap, put a **Cloudflare AI Gateway** in front and set the
rate limit there — it's enforced Cloudflare-side, so it holds no matter how many
Vercel instances exist. Change `AI_ENDPOINT` to the gateway URL:

```
https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway>/workers-ai/v1/chat/completions
```

That also gets you request logs and caching, so repeated questions stop costing
anything at all.

**The real ceiling is the Cloudflare Workers _Free_ plan.** It allows 10,000
Neurons/day, and once exhausted requests simply fail — there is no overage
billing. So the worst case of a determined attack is that free-form answers
stop working until the daily reset, and the terminal silently falls back to the
keyword rules. It cannot produce a bill.

Two rules follow from that:

- **Stay on the Workers Free plan for this.** On Workers Paid, usage past the
  same 10k/day allowance bills at $0.011/1k Neurons with no cap by default. If
  you ever move to Paid for unrelated reasons, add a durable global daily cap
  (Vercel KV / Upstash) before you do — the in-memory limiter here will not
  save you.
- **Scope the API token to Workers AI only**, so a leaked key can't touch
  anything else in the account.

`@cf/meta/llama-3.2-3b-instruct` is available on the free plan; a few larger
models (Kimi, GLM-5.2) require Paid, so don't swap `AI_MODEL` to one of those
without re-reading the paragraph above.

## Deploying

`output: 'hybrid'` — every page is prerendered static; only `/api/ask` is a
function. `engines.node` pins the build to Node 20 so the Vercel adapter emits
a supported runtime (it only knows 18/20, and falls back to the retired
`nodejs18.x` when built on anything newer).

Set `CF_ACCOUNT_ID` and `CF_API_TOKEN` in the host's environment.
