# WebMCP Blackjack

Same tools, different permissions — watch two AI agents play blackjack under WebMCP's role-based tool access.

**[Live Demo →](#)** *(coming soon)*

## What This Demonstrates

| WebMCP Feature | How It Shows Up |
|---|---|
| **Role-based tool access** | Alex calls `get_my_hand` + `get_dealer_upcard`. Dealer calls `get_my_hand` — same tool name, but returns the full hand including the hidden card. Alex has no tool to see it. |
| **Information asymmetry** | Each agent's tool trace shows raw JSON. Same game state, different views per role. |
| **Thinking visualization** | Each turn steps through: tool calls → reasoning → decision. Press `SPACE` to advance. |
| **Multilingual reasoning** | Flag buttons in the header switch each agent's thinking language live (EN/KR/JA/ES). |

## Tech Stack

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

The game works without an API key — agents fall back to basic strategy with a `(basic strategy)` tag.

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

## License

MIT

## Author

Heejae Kim ([@happyhj](https://github.com/happyhj))
