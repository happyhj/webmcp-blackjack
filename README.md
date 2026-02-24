# WebMCP Blackjack

Three players, one table, different tools - a blackjack game built entirely on the W3C WebMCP standard API (`navigator.modelContext`).

**[Live Demo → webmcp-blackjack.pages.dev](https://webmcp-blackjack.pages.dev)**

![WebMCP Blackjack Screenshot](./docs/screenshot.png)

## Motivation

The WebMCP spec provides a single tool registry with uniform visibility - every registered tool is visible to any connected agent. There's no built-in concept of "this tool is for agent A, not agent B."

But what if multiple agents share the same page, each with a different role and different information access? This demo explores that question. The app controls `registerTool()` / `clearContext()` dynamically based on two things: **who currently has focus** (you, Alex, or the dealer) and **what the game state allows** (betting, playing, or settling). The result is a multi-agent experience where each participant - including the human player - interacts through the same standard WebMCP tool interface, but sees a different set of tools with different data.

No spec extension needed. Just `registerTool()`, `clearContext()`, and application logic.

## What This Demonstrates

| WebMCP Feature | How It Shows Up |
|---|---|
| **Standard API (`navigator.modelContext`)** | All tools registered via `registerTool()`. Native on Chrome 146+ with flag, polyfill fallback for older browsers. |
| **Dynamic tool lifecycle** | Tools register/unregister at each phase transition. The app decides who gets which tools, and when. |
| **Role-based tool access** | You and Alex get `get_my_hand` + `get_dealer_upcard` + `hit` + `stand`. Dealer gets `get_my_hand` (full hand) + `reveal_hidden` + `hit` + `stand`. Same tool name, different data per role. |
| **Information asymmetry** | Each agent's tool trace shows raw JSON. Same game state, different views per role. |
| **Inspector compatible** | On Chrome 146+ with the WebMCP flag, registered tools show in the WebMCP Inspector and can be called from there. |
| **Multilingual reasoning** | Flag buttons switch each agent's thinking language live (EN/KR/JA/ES). |

### Tool Sets Per Phase

| Phase | Registered Tools | Who |
|---|---|---|
| Betting | `place_bet(amount)` | You |
| Player Turn | `get_my_hand`, `get_dealer_upcard`, `hit`, `stand` | You |
| AI Turn | `get_my_hand`, `get_dealer_upcard`, `hit`, `stand` | Alex |
| Dealer Turn | `get_my_hand`, `reveal_hidden`, `hit`, `stand` | Dealer |

## Tech Stack

- **WebMCP**: `@mcp-b/webmcp-polyfill` + `@mcp-b/webmcp-types` (falls back when native API is unavailable)
- **Frontend**: React + TypeScript + Vite
- **AI**: Google Gemini (Gemma 3 27B) with rule-based fallback
- **Hosting**: Cloudflare Pages + Functions (API proxy)
- **Analytics**: GA4 (cookieless mode)

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your Gemini API key to .env

# Run dev server
npm run dev
```

The game works without an API key - agents fall back to basic strategy with a `(basic strategy)` tag.

### Testing with Chrome 146 Native WebMCP

1. Install Chrome Canary (or Beta)
2. Go to `chrome://flags`, search for "WebMCP", enable the flag
3. Relaunch - `navigator.modelContext` will be native and tools will appear in DevTools

Without the flag, the polyfill handles everything. The code detects native support automatically.

## Deployment (Cloudflare Pages)

```bash
# Build
npm run build

# Deploy via Cloudflare Pages
# Set GEMINI_API_KEY as an environment variable in Cloudflare dashboard
```

See `wrangler.toml` for configuration. The `functions/api/gemini.ts` proxy keeps the API key server-side.

## Controls

| Key | Action |
|---|---|
| `Enter` | Start game / Deal / Next round |
| `←` `→` | Select bet amount / Toggle Hit or Stand |
| `H` | Hit (instant) |
| `S` | Stand (instant) |
| `Space` | Advance thinking steps |
| `?` | Help |

On Chrome 146+ with the WebMCP flag, registered tools also appear in the WebMCP Inspector.

## References

- [WebMCP Specification](https://webmachinelearning.github.io/webmcp/) - W3C Community Group draft
- [WebMCP Proposal](https://github.com/webmachinelearning/webmcp/blob/main/docs/proposal.md) - Design rationale and API overview
- [WebMCP GitHub](https://github.com/webmachinelearning/webmcp) - Spec repo and discussions
- [Chrome WebMCP Early Preview](https://developer.chrome.com/blog/webmcp-epp) - Chrome 146 Canary implementation
- [`@mcp-b/webmcp-polyfill`](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill) - Polyfill for `navigator.modelContext`
- [WebMCP Inspector](https://github.com/mr-shitij/webmcp_inspector) - Chrome extension for inspecting and calling registered tools
- [Gemma 3](https://ai.google.dev/gemma) - Open model used for agent reasoning (free tier via Gemini API)

## License

MIT

## Author

Heejae Kim ([@happyhj](https://github.com/happyhj))
