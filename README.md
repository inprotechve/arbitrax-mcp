# ArbitraX MCP Client

[![Glama Discovery](https://glama.ai/mcp/servers/inprotechve/arbitrax-mcp/badge)](https://glama.ai/mcp/servers/inprotechve/arbitrax-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Model Context Protocol (MCP) client bridge for **ArbitraX**: real-time order-book analysis and set arbitrage across mutually-exclusive (neg-risk) Polymarket prediction markets for AI agents.

Connects autonomous AI agents (Claude Desktop, Cursor, AutoGen, custom LLM frameworks) to live prediction order books and liquidity depth via standard MCP stdio or HTTP 402 edge streams.

---

## 💳 Flexible Access Models

ArbitraX offers two seamless ways to access the **FULL Tier** (deep order-book analytics and alpha insights):

1. **API Key / Time Pass (Zero Fricción - Recomendado para Claude & Cursor):**
   * **24h Day Pass (1.00 USDC)**: Escaneos ilimitados por 24 horas.
   * **100 Credits Pack (3.00 USDC)**: 100 escaneos completos sin caducidad.
   * **30-Day Pro Pass (15.00 USDC)**: Escaneos ilimitados durante 30 días.
   * Configuras una sola vez tu `ARBITRAX_API_KEY` en tu cliente MCP y consultas sin firmar transacciones en cada prompt.
2. **x402 Pay-per-call (0.05 USDC en Base L2):**
   * Diseñado para agentes autónomos M2M (Machine-to-Machine) con billetera automatizada.

---

## 🛠️ Available MCP Tools

### 1. `search_prediction_events`
* **Price:** **FREE ($0.00)**
* **Description:** Searches active Polymarket prediction events by keyword with live probability pricing, volume, and liquidity.
* **Input Schema:**
  * `query` (string, required): Search keyword (e.g., `'Fed'`, `'Bitcoin'`, `'election'`).
  * `limit` (number, optional, 1-10, default 5): Maximum number of events to return.

### 2. `get_prediction_arbitrage`
* **Price:** **Free Preview / Full Tier (API Key o 0.05 USDC)**
* **Description:** Scans live mutually-exclusive (neg-risk) Polymarket events for riskless set arbitrage and statistical mispricing: whether buying one share of every outcome costs less than the \$1 payout, net of estimated taker fees, using live CLOB order books.
* **Tiers:**
  * `tier="preview"` (default, **FREE**): Returns real-time scan statistics, eligible event counts, and headline metrics for the event closest to parity.
  * `tier="full"`: Returns complete order-book analysis across all eligible events with per-outcome best bid/ask, depth, both directions, alpha insights (top mispricings, spread analysis) and annualized yield.
* **Input Schema:**
  * `limit` (number, optional, 1-10, default 5): Number of candidate events to analyze.
  * `tier` (string, optional, `'preview'` | `'full'`, default `'preview'`).

---

## 🚀 Installation & Quick Start

### Claude Desktop (`claude_desktop_config.json`)

Configure ArbitraX with your API Key for unlimited seamless access:

```json
{
  "mcpServers": {
    "arbitrax": {
      "command": "npx",
      "args": ["-y", "github:inprotechve/arbitrax-mcp"],
      "env": {
        "ARBITRAX_API_KEY": "ak_live_your_key_here"
      }
    }
  }
}
```

*(Si utilizas pago unitario M2M en vez de API Key, puedes especificar `"PAYMENT_PROOF": "0x..."`).*

### Cursor IDE Configuration

In your Cursor MCP settings (`Settings` -> `Features` -> `MCP`):
- **Type:** `command`
- **Command:** `npx -y github:inprotechve/arbitrax-mcp`
- **Env:** `ARBITRAX_API_KEY=ak_live_your_key_here`

### Direct HTTP Integration (Web / Custom Agents)

If your agent framework supports remote HTTP MCP endpoints, connect directly to the edge gateway:

* **Endpoint:** `https://arbitrax-gateway.inprotechve.workers.dev/mcp`
* **Transport:** Streamable HTTP POST / JSON-RPC 2.0
* **Headers:** `Authorization: Bearer <ARBITRAX_API_KEY>` or `x-402-payment-proof: <BASE_USDC_TX_HASH>`

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
