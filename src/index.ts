import { Env, MCPRequest } from "./types";
import { MCPServer } from "./mcp/server";
import { X402Gateway } from "./gateway/x402";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const mcpServer = new MCPServer(env);
    const x402Gateway = new X402Gateway(env);

    // Global CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-402-payment-proof, x402-payment-proof",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    const defaultHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Server": "ArbitraX-Gateway/1.0.0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    };

    // 1. Healthcheck
    if (url.pathname === "/v1/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          server: "ArbitraX Gateway",
          timestamp: new Date().toISOString(),
          network: env.NETWORK || "base",
          environment: env.ENVIRONMENT || "production"
        }),
        { status: 200, headers: defaultHeaders }
      );
    }

    // 2. Interactive Terminal Landing Page (HTML UI for humans & agents)
    if (url.pathname === "/" && request.method === "GET") {
      const tools = mcpServer.getToolDefinitions();
      return new Response(renderTerminalLanding(env, tools, url.origin), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Content-Security-Policy": "default-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src *;"
        }
      });
    }

    // 3. MCP JSON-RPC Endpoint (/mcp or POST /)
    if (url.pathname === "/mcp" || (url.pathname === "/" && request.method === "POST")) {
      if (request.method === "GET") {
        // Return tool manifest for quick inspection
        return new Response(
          JSON.stringify({
            name: "arbitrax-mcp",
            description: "ArbitraX: High-Stakes Prediction Arbitrage (+EV) & Macro Whale Signals MCP Gateway with x402 Micropayments",
            version: "1.0.0",
            protocol: "mcp-2024-11-05",
            x402: {
              enabled: true,
              network: env.NETWORK || "base",
              token: "USDC",
              treasury: env.TREASURY_WALLET_BASE
            },
            tools: mcpServer.getToolDefinitions()
          }, null, 2),
          { status: 200, headers: defaultHeaders }
        );
      }

      if (request.method === "POST") {
        try {
          const body = (await request.json()) as MCPRequest;

          // Free discovery methods: initialize, tools/list
          if (body.method === "initialize" || body.method === "tools/list") {
            const result = await mcpServer.handleMCPRequest(body);
            return new Response(JSON.stringify(result, null, 2), {
              status: 200,
              headers: defaultHeaders
            });
          }

          // Protected execution method: tools/call
          if (body.method === "tools/call") {
            const toolName = body.params?.name;
            const toolDef = mcpServer.getToolDefinitions().find((t) => t.name === toolName);

            if (!toolDef) {
              return new Response(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: body.id,
                  error: { code: -32601, message: `Tool '${toolName}' not found.` }
                }),
                { status: 404, headers: defaultHeaders }
              );
            }

            // Inspect x-402 payment proof header
            const proofHeader =
              request.headers.get("x-402-payment-proof") ||
              request.headers.get("x402-payment-proof");

            // 1. FREE TOOL (Lead Magnet: price = 0)
            if (toolDef.priceUSDC === 0) {
              const result = await mcpServer.handleMCPRequest(body, true);
              return new Response(JSON.stringify(result, null, 2), {
                status: 200,
                headers: {
                  ...defaultHeaders,
                  "x-tier": "free-lead-magnet"
                }
              });
            }

            const verification = x402Gateway.verifyPaymentProof(proofHeader, toolDef.priceUSDC.toString());

            // 2. FREEMIUM TOOL: get_prediction_arbitrage
            if (toolName === "get_prediction_arbitrage") {
              if (verification.valid) {
                // Paid Pro Access
                const result = await mcpServer.handleMCPRequest(body, true);
                return new Response(JSON.stringify(result, null, 2), {
                  status: 200,
                  headers: {
                    ...defaultHeaders,
                    "x-tier": "pro-unlocked",
                    "x-payment-verified": "true",
                    "x-payer": verification.payer || "unknown",
                    "x-tx-hash": verification.txHash || "0x"
                  }
                });
              } else {
                // Unpaid Freemium Preview: returns 1 live opportunity + locked count + unlock info
                const result = await mcpServer.handleMCPRequest(body, false);
                return new Response(JSON.stringify(result, null, 2), {
                  status: 200,
                  headers: {
                    ...defaultHeaders,
                    "x-tier": "freemium-preview",
                    "x402-protocol": "x402-v1",
                    "x402-amount": toolDef.priceUSDC.toString(),
                    "x402-token": "USDC",
                    "x402-recipient": env.TREASURY_WALLET_BASE,
                    "x402-network": env.NETWORK || "base"
                  }
                });
              }
            }

            // 3. STRICT PAID TOOLS (e.g. get_whale_macro_signals)
            if (!verification.valid) {
              return x402Gateway.createPaymentRequiredResponse(
                toolName,
                toolDef.priceUSDC.toString(),
                url.origin
              );
            }

            // Valid payment proof: execute tool in Pro mode
            const result = await mcpServer.handleMCPRequest(body, true);
            return new Response(JSON.stringify(result, null, 2), {
              status: 200,
              headers: {
                ...defaultHeaders,
                "x-tier": "pro-unlocked",
                "x-payment-verified": "true",
                "x-payer": verification.payer || "unknown",
                "x-tx-hash": verification.txHash || "0x"
              }
            });
          }

          // Fallback for other MCP methods
          const res = await mcpServer.handleMCPRequest(body);
          return new Response(JSON.stringify(res, null, 2), {
            status: 200,
            headers: defaultHeaders
          });
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32700, message: `Parse error: ${err.message}` }
            }),
            { status: 400, headers: defaultHeaders }
          );
        }
      }
    }

    // 4. Live Interactive Demo Scanner Endpoint (/v1/demo)
    if (url.pathname === "/v1/demo" && request.method === "GET") {
      try {
        const limit = Number(url.searchParams.get("limit")) || 10;
        const minEdge = Number(url.searchParams.get("minEdge")) || 2.5;
        const category = url.searchParams.get("category") || undefined;

        // Execute in freemium mode (1 free live opportunity + teaser of locked alpha)
        const demoData = await mcpServer.executeTool(
          "get_prediction_arbitrage",
          { limit, minEdgePercentage: minEdge, category },
          false
        );

        return new Response(JSON.stringify(demoData, null, 2), {
          status: 200,
          headers: {
            ...defaultHeaders,
            "x-tier": "freemium-demo",
            "Cache-Control": "no-store, max-age=0"
          }
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: `Demo scanner error: ${err.message}` }),
          { status: 500, headers: defaultHeaders }
        );
      }
    }

    // 5. Direct REST Arbitrage Endpoint (/v1/arbitrage)
    if (url.pathname === "/v1/arbitrage") {
      const priceUSDC = env.DEFAULT_ARBITRAGE_PRICE_USDC || "0.05";
      const proofHeader =
        request.headers.get("x-402-payment-proof") ||
        request.headers.get("x402-payment-proof");

      const verification = x402Gateway.verifyPaymentProof(proofHeader, priceUSDC);
      const isPaid = verification.valid;

      const limit = Number(url.searchParams.get("limit")) || 10;
      const minEdge = Number(url.searchParams.get("minEdge")) || 3.0;
      const category = url.searchParams.get("category") || undefined;

      const data = await mcpServer.executeTool(
        "get_prediction_arbitrage",
        { limit, minEdgePercentage: minEdge, category },
        isPaid
      );

      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          ...defaultHeaders,
          "x-tier": isPaid ? "pro-unlocked" : "freemium-preview",
          ...(isPaid
            ? {
                "x-payment-verified": "true",
                "x-payer": verification.payer || "anonymous",
                "x-tx-hash": verification.txHash || "0x"
              }
            : {
                "x402-protocol": "x402-v1",
                "x402-amount": priceUSDC,
                "x402-token": "USDC",
                "x402-recipient": env.TREASURY_WALLET_BASE,
                "x402-network": env.NETWORK || "base"
              })
        }
      });
    }

    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: defaultHeaders
    });
  }
};

/**
 * High-end Dark Mode UI with Interactive Live Alpha Scanner (Freemium Lead Magnet)
 */
function renderTerminalLanding(env: Env, tools: any[], origin: string): string {
  const toolsHtml = tools
    .map((t) => {
      const isFree = t.priceUSDC === 0;
      const isFreemium = t.name === "get_prediction_arbitrage";

      let badgeText = isFree
        ? "100% FREE • LEAD MAGNET"
        : isFreemium
        ? "FREEMIUM PREVIEW • 1 FREE +EV / $0.05 FULL"
        : "VIP PRO • HTTP 402";

      let priceBadge = isFree
        ? `<span class="tool-price free-badge">FREE ($0.00)</span>`
        : isFreemium
        ? `<span class="tool-price freemium-badge">FREEMIUM ($0.05)</span>`
        : `<span class="tool-price">$${t.priceUSDC} USDC</span>`;

      return `
    <div class="tool-card ${isFree ? "card-highlight" : ""}">
      <div class="tool-header">
        <span class="tool-name">${t.name}</span>
        ${priceBadge}
      </div>
      <p class="tool-desc">${t.description}</p>
      <div class="badge-list">
        <span class="badge tier-badge">${badgeText}</span>
        <span class="badge">Network: ${env.NETWORK || "Base"}</span>
        <span class="badge">Protocol: x402-v1</span>
      </div>
    </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArbitraX | Autonomous Prediction Arbitrage & x402 Gateway</title>
  <style>
    :root {
      --bg: #07090e;
      --card-bg: #0e121b;
      --card-highlight: #121824;
      --border: #1a2233;
      --border-accent: rgba(0, 245, 160, 0.35);
      --accent: #00f5a0;
      --accent-glow: rgba(0, 245, 160, 0.15);
      --accent-blue: #38bdf8;
      --text: #f0f3fa;
      --text-muted: #8b95a8;
      --mono: 'JetBrains Mono', 'Geist Mono', 'Fira Code', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 2.5rem 1.5rem;
      max-width: 980px;
      margin: 0 auto;
      line-height: 1.55;
    }
    .header {
      margin-bottom: 2.2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.75rem;
    }
    .pill-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 1rem;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-family: var(--mono);
      background: rgba(0, 245, 160, 0.1);
      color: var(--accent);
      padding: 4px 11px;
      border-radius: 9999px;
      border: 1px solid rgba(0, 245, 160, 0.25);
    }
    .pill-blue {
      background: rgba(56, 189, 248, 0.1);
      color: var(--accent-blue);
      border-color: rgba(56, 189, 248, 0.25);
    }
    .pill .dot {
      width: 6px;
      height: 6px;
      background: var(--accent);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent);
    }
    h1 {
      font-size: 2.6rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      margin-bottom: 0.6rem;
      line-height: 1.1;
    }
    h1 span {
      color: var(--accent);
      text-shadow: 0 0 20px rgba(0, 245, 160, 0.3);
    }
    p.lead {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 720px;
    }
    
    /* Interactive Scanner Lead Magnet Box */
    .scanner-box {
      background: linear-gradient(180deg, #101624 0%, #0c0f18 100%);
      border: 1px solid var(--border-accent);
      border-radius: 14px;
      padding: 1.75rem;
      margin-bottom: 2.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 24px var(--accent-glow);
    }
    .scanner-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 1.25rem;
    }
    .scanner-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .scanner-title .pulse {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      animation: scanner-pulse 1.8s infinite;
    }
    @keyframes scanner-pulse {
      0% { box-shadow: 0 0 0 0 rgba(0, 245, 160, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(0, 245, 160, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 245, 160, 0); }
    }
    .scanner-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn-scan {
      background: var(--accent);
      color: #07090e;
      font-weight: 700;
      font-size: 0.92rem;
      font-family: var(--mono);
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 12px rgba(0, 245, 160, 0.3);
    }
    .btn-scan:hover {
      background: #34ffb6;
      transform: translateY(-1px);
      box-shadow: 0 4px 18px rgba(0, 245, 160, 0.5);
    }
    .btn-scan:disabled {
      background: #2a3652;
      color: #8b95a8;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }
    .scan-status {
      font-family: var(--mono);
      font-size: 0.82rem;
      color: var(--text-muted);
    }
    .scan-results-box {
      margin-top: 1rem;
    }
    .placeholder-state {
      background: rgba(0, 0, 0, 0.3);
      border: 1px dashed var(--border);
      border-radius: 10px;
      padding: 2.2rem 1.5rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .placeholder-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      display: block;
    }
    .result-card {
      background: #090c13;
      border: 1px solid #232c40;
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1rem;
    }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
      gap: 12px;
    }
    .result-title {
      font-weight: 700;
      font-size: 1.08rem;
      color: #fff;
    }
    .edge-badge {
      background: rgba(0, 245, 160, 0.15);
      color: var(--accent);
      border: 1px solid var(--accent);
      font-family: var(--mono);
      font-size: 0.85rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      white-space: nowrap;
    }
    .market-q {
      font-size: 0.92rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }
    .market-q strong { color: #d0d7e6; }
    .outcomes-table {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 1rem;
    }
    .outcome-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #111624;
      border-radius: 6px;
      font-size: 0.86rem;
      font-family: var(--mono);
      gap: 8px;
      flex-wrap: wrap;
    }
    .outcome-name {
      font-weight: 600;
      color: #fff;
      flex: 1;
      min-width: 140px;
    }
    .outcome-poly, .outcome-bench {
      color: var(--text-muted);
    }
    .outcome-poly strong, .outcome-bench strong {
      color: #fff;
    }
    .edge-pos {
      color: var(--accent);
      font-weight: 700;
    }
    .result-footer {
      display: flex;
      justify-content: space-between;
      font-size: 0.82rem;
      color: var(--text-muted);
      border-top: 1px solid #1a2233;
      padding-top: 0.75rem;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    /* Locked VIP Preview Card */
    .locked-card {
      background: linear-gradient(135deg, rgba(30, 20, 45, 0.4) 0%, rgba(15, 20, 35, 0.6) 100%);
      border: 1px dashed #63408a;
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .locked-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .lock-icon {
      font-size: 1.8rem;
    }
    .locked-left strong {
      display: block;
      color: #e0d0f5;
      font-size: 0.98rem;
      margin-bottom: 2px;
    }
    .locked-left p {
      font-size: 0.84rem;
      color: #a69bb8;
    }
    .btn-copy-sm {
      background: #63408a;
      color: #fff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-family: var(--mono);
      font-size: 0.8rem;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
    }
    .btn-copy-sm:hover {
      background: #7a4faa;
    }

    /* Grid & Cards */
    .section-title {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .grid {
      display: grid;
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .tool-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      transition: border-color 0.2s;
    }
    .tool-card:hover {
      border-color: #2e3954;
    }
    .card-highlight {
      border-color: rgba(56, 189, 248, 0.35);
      background: #0f1523;
    }
    .tool-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .tool-name {
      font-family: var(--mono);
      font-weight: 600;
      color: var(--accent);
      font-size: 1.05rem;
    }
    .tool-price {
      font-family: var(--mono);
      background: #1a2233;
      padding: 3px 9px;
      border-radius: 6px;
      font-size: 0.82rem;
      border: 1px solid #2a3652;
    }
    .free-badge {
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent-blue);
      border-color: rgba(56, 189, 248, 0.4);
      font-weight: 700;
    }
    .freemium-badge {
      background: rgba(0, 245, 160, 0.15);
      color: var(--accent);
      border-color: rgba(0, 245, 160, 0.4);
      font-weight: 700;
    }
    .tool-desc {
      color: var(--text-muted);
      font-size: 0.92rem;
      margin-bottom: 0.8rem;
    }
    .badge-list {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 0.72rem;
      font-family: var(--mono);
      background: #090c13;
      border: 1px solid var(--border);
      padding: 2px 7px;
      border-radius: 4px;
      color: #9ab;
    }
    .tier-badge {
      color: var(--accent);
      border-color: rgba(0, 245, 160, 0.3);
    }
    
    /* Terminal Config Box */
    .terminal-box {
      background: #05070a;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      margin-top: 1.5rem;
    }
    .terminal-header {
      font-family: var(--mono);
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.85rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .btn-copy {
      background: #141b29;
      color: #d0d7e6;
      border: 1px solid #2a3652;
      padding: 4px 10px;
      border-radius: 6px;
      font-family: var(--mono);
      font-size: 0.76rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-copy:hover {
      background: #1c263a;
      color: #fff;
      border-color: var(--accent);
    }
    pre {
      font-family: var(--mono);
      color: #7ee787;
      font-size: 0.84rem;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.45;
    }
    
    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.82rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    footer a {
      color: var(--accent);
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="pill-group">
      <div class="pill"><span class="dot"></span> LIVE ON EDGE • BASE L2 ACTIVE</div>
      <div class="pill pill-blue">DUAL FREEMIUM FUNNEL READY</div>
      <div class="pill">MCP PROTOCOL 2024-11-05</div>
    </div>
    <h1>Arbitra<span>X</span></h1>
    <p class="lead">
      Autonomous Prediction Arbitrage (+EV) & Macro Whale Telemetry for AI Agents. Integrates directly into Claude Desktop, Cursor, and custom agentic frameworks via MCP and HTTP 402 micropayments.
    </p>
  </div>

  <!-- INTERACTIVE LIVE ALPHA SCANNER (LEAD MAGNET) -->
  <div class="scanner-box">
    <div class="scanner-top">
      <div>
        <div class="scanner-title">
          <span class="pulse"></span>
          Live Prediction Arbitrage Scanner (Free Real-Time Demo)
        </div>
        <p style="color: var(--text-muted); font-size: 0.86rem; margin-top: 4px;">
          Scans live orderbooks from Polymarket Gamma API, normalizes bookmaker vig, and extracts real-time +EV spreads.
        </p>
      </div>
      <div class="scanner-actions">
        <button id="scanBtn" class="btn-scan" onclick="runLiveScan()">⚡ Run Live Alpha Scan</button>
      </div>
    </div>
    <div style="margin-bottom: 0.75rem;">
      <span id="scanStatus" class="scan-status">System Ready • Click above to probe active prediction orderbooks</span>
    </div>
    <div id="scanResults" class="scan-results-box">
      <div class="placeholder-state">
        <span class="placeholder-icon">📡</span>
        <p>Polymarket Gamma Engine is idle. Click <strong>"⚡ Run Live Alpha Scan"</strong> to trigger edge calculations across active politics, crypto, and macro markets.</p>
      </div>
    </div>
  </div>

  <div class="section-title">Available MCP Monetized Tools</div>
  <div class="grid">
    ${toolsHtml}
  </div>

  <div class="terminal-box">
    <div class="terminal-header">
      <span>AI AGENT CONFIGURATION (Claude Desktop / Cursor)</span>
      <button id="copyBtn" class="btn-copy" onclick="copyAgentConfig()">📋 Copy MCP Config</button>
    </div>
    <pre>{
  "mcpServers": {
    "arbitrax": {
      "url": "${origin}/mcp",
      "headers": {
        "x-402-payment-proof": "{OPTIONAL_BASE_USDC_TX_FOR_FULL_VIP}"
      }
    }
  }
}</pre>
  </div>

  <footer>
    <div>
      ArbitraX Engine v1.0.0 • Treasury: 
      <a href="https://basescan.org/address/${env.TREASURY_WALLET_BASE}" target="_blank" rel="noopener">
        ${env.TREASURY_WALLET_BASE.slice(0, 6)}...${env.TREASURY_WALLET_BASE.slice(-4)} (Base L2)
      </a>
    </div>
    <div>
      <a href="https://glama.ai/mcp/servers/inprotechve/arbitrax-mcp" target="_blank" rel="noopener">Glama.ai Listing (83% Score)</a> • 
      <a href="https://github.com/inprotechve/arbitrax-mcp" target="_blank" rel="noopener">GitHub</a>
    </div>
  </footer>

  <script>
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    async function runLiveScan() {
      const btn = document.getElementById('scanBtn');
      const status = document.getElementById('scanStatus');
      const container = document.getElementById('scanResults');

      btn.disabled = true;
      btn.innerText = 'Scanning Live Markets...';
      status.innerHTML = '<span style="color: #00f5a0;">⚡ Fetching Polymarket Gamma API, normalizing 4.0% bookmaker vig...</span>';

      try {
        const res = await fetch('/v1/demo');
        const data = await res.json();

        if (!data.success || !data.opportunities || data.opportunities.length === 0) {
          status.innerText = 'Scan completed. No live markets with >2.5% edge at this second. Try again shortly.';
          btn.disabled = false;
          btn.innerText = '⚡ Run Live Alpha Scan';
          return;
        }

        const opp = data.opportunities[0];
        const lockedCount = data.freemiumTeaser ? data.freemiumTeaser.lockedOpportunitiesCount : 0;

        const outcomesHtml = (opp.outcomes || []).map(function(o) {
          const isEdge = o.edgeRating === '+EV';
          const deltaSign = o.discrepancyDelta > 0 ? '+' : '';
          return '<div class="outcome-row">' +
            '<span class="outcome-name">' + escapeHtml(o.name) + '</span>' +
            '<span class="outcome-poly">Polymarket: <strong>' + o.polymarketProbability + '%</strong></span>' +
            '<span class="outcome-bench">Consensus: <strong>' + o.benchmarkProbability + '%</strong></span>' +
            '<span class="' + (isEdge ? 'edge-pos' : '') + '">' + deltaSign + o.discrepancyDelta + '% (' + o.edgeRating + ')</span>' +
          '</div>';
        }).join('');

        container.innerHTML = 
          '<div class="result-card">' +
            '<div class="result-header">' +
              '<div class="result-title">' + escapeHtml(opp.eventTitle || opp.marketQuestion) + '</div>' +
              '<span class="edge-badge">+' + opp.maxEdgePercentage + '% +EV EDGE</span>' +
            '</div>' +
            '<p class="market-q"><strong>Market Question:</strong> ' + escapeHtml(opp.marketQuestion) + '</p>' +
            '<div class="outcomes-table">' + outcomesHtml + '</div>' +
            '<div class="result-footer">' +
              '<span>💧 Liquidity Volume: $' + Number(opp.liquidityUSD || 0).toLocaleString() + '</span>' +
              '<span>⚡ Action: <strong style="color: #00f5a0;">' + escapeHtml(opp.recommendedAction) + '</strong></span>' +
            '</div>' +
          '</div>' +
          '<div class="locked-card">' +
            '<div class="locked-left">' +
              '<span class="lock-icon">🔒</span>' +
              '<div>' +
                '<strong>' + lockedCount + ' Additional Arbitrage Spreads Available in Deep Orderbook</strong>' +
                '<p>Full cross-market spreads, Kelly sizing & execution routes streamable via ArbitraX MCP ($0.05 USDC).</p>' +
              '</div>' +
            '</div>' +
            '<button class="btn-copy-sm" onclick="copyAgentConfig()">⚡ Copy MCP Config for Agents</button>' +
          '</div>';

        status.innerHTML = '✅ <span style="color: #00f5a0;">Live Scan Completed.</span> 1 High-Conviction Opportunity Unlocked. ' + lockedCount + ' Deep Spreads Available.';
      } catch (err) {
        status.innerText = 'Error running scan: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = '⚡ Refresh Live Alpha Scan';
      }
    }

    function copyAgentConfig() {
      const config = JSON.stringify({
        "mcpServers": {
          "arbitrax": {
            "url": "${origin}/mcp",
            "headers": {
              "x-402-payment-proof": "Optional: Base USDC Tx Hash for Full Pro Orderbook"
            }
          }
        }
      }, null, 2);

      navigator.clipboard.writeText(config).then(function() {
        const btn = document.getElementById('copyBtn');
        if (btn) {
          const original = btn.innerText;
          btn.innerText = '✓ Copied to Clipboard!';
          btn.style.borderColor = '#00f5a0';
          btn.style.color = '#00f5a0';
          setTimeout(function() {
            btn.innerText = original;
            btn.style.borderColor = '';
            btn.style.color = '';
          }, 2500);
        }
      });
    }
  </script>
</body>
</html>`;
}
