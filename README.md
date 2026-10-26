# ArbitraX MCP Client

[![Glama Discovery](https://glama.ai/mcp/servers/inprotechve/arbitrax-mcp/badge)](https://glama.ai/mcp/servers/inprotechve/arbitrax-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Model Context Protocol (MCP) client bridge for **ArbitraX**: real-time order-book analysis and set arbitrage across mutually-exclusive (neg-risk) Polymarket prediction markets for AI agents.

Connects autonomous AI agents (Claude Desktop, Cursor, AutoGen, custom LLM frameworks) to live prediction order books and liquidity depth via standard MCP stdio or HTTP 402 edge streams.

---

## 🛠️ Available MCP Tools

### 1. `search_prediction_events`
* **Price:** **FREE ($0.00)**
* **Description:** Searches active Polymarket prediction events by keyword with live probability pricing, volume, and liquidity.
* **Input Schema:**
  * `query` (string, required): Search keyword (e.g., `'Fed'`, `'Bitcoin'`, `'election'`).
  * `limit` (number, optional, 1-10, default 5): Maximum number of events to return.

### 2. `get_prediction_arbitrage`
* **Price:** **Free Preview / 0.05 USDC Full Tier (Base L2)**
* **Description:** Scans live mutually-exclusive (neg-risk) Polymarket events for riskless set arbitrage: whether buying one share of every outcome costs less than the \$1 payout, net of estimated taker fees, using live CLOB order books.
* **Tiers:**
  * `tier="preview"` (default, **FREE**): Returns real-time scan statistics, eligible event counts, and headline metrics for the event closest to parity.
  * `tier="full"` (**0.05 USDC**): Returns complete order-book analysis across all eligible events with per-outcome best bid/ask, depth, both directions, and annualized yield. Payment is verified on-chain on Base L2 via the HTTP 402 protocol.
* **Input Schema:**
  * `limit` (number, optional, 1-10, default 5): Number of candidate events to analyze.
  * `tier` (string, optional, `'preview'` | `'full'`, default `'preview'`).

---

## 🚀 Installation & Quick Start

### Option A: Run via NPX (Recommended for Claude Desktop & Cursor)

No installation required. Run directly with `npx`:

```bash
npx -y github:inprotechve/arbitrax-mcp
```

### Option B: Docker Container

```bash
docker run -i --rm ghcr.io/inprotechve/arbitrax-mcp:latest
```

---

## ⚙️ Client Configuration

### Claude Desktop (`claude_desktop_config.json`)

Add ArbitraX to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arbitrax": {
      "command": "npx",
      "args": ["-y", "github:inprotechve/arbitrax-mcp"],
      "env": {
        "X_402_PAYMENT_PROOF": "{OPTIONAL_BASE_USDC_TX_HASH_FOR_FULL_TIER}"
      }
    }
  }
}
```

### Cursor IDE Configuration

In your Cursor MCP settings:
- **Type:** `command`
- **Command:** `npx -y github:inprotechve/arbitrax-mcp`

### Direct HTTP Integration (Web / Custom Agents)

If your agent framework supports remote HTTP MCP endpoints, connect directly to the edge gateway:

* **Endpoint:** `https://arbitrax-gateway.inprotechve.workers.dev/mcp`
* **Transport:** Streamable HTTP POST / JSON-RPC 2.0
* **Payment Header:** `x-402-payment-proof: <BASE_USDC_TRANSACTION_HASH>`

---

## 🔒 Security & Verifiable Transparency

* **Client Wrapper:** This repository contains strictly the open-source client transport adapter.
* **Zero Front-Running:** Core order-book processing and settlement risk heuristics run in isolated edge workers behind atomic single-use on-chain verification.
* **Base Network Native:** Payments settle directly in native USDC on Base L2 (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).

---

## ⚠️ Disclaimer

Informational data derived from public Polymarket APIs at query time. Not financial or investment advice. Market prices fluctuate within milliseconds; fees are estimated based on published fee schedules. Execution slippage beyond top-of-book, gas costs, capital lock-up, and contract resolution/dispute risks are not included.

---

## 📄 License

MIT License © 2026 Inprotech.
