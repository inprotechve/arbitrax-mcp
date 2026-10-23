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

            const verification = x402Gateway.verifyPaymentProof(proofHeader, toolDef.priceUSDC.toString());

            if (!verification.valid) {
              // Return standard HTTP 402 Payment Required
              return x402Gateway.createPaymentRequiredResponse(
                toolName,
                toolDef.priceUSDC.toString(),
                url.origin
              );
            }

            // Valid payment proof: execute tool
            const result = await mcpServer.handleMCPRequest(body);
            return new Response(JSON.stringify(result, null, 2), {
              status: 200,
              headers: {
                ...defaultHeaders,
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

    // 4. Direct REST Arbitrage Endpoint (/v1/arbitrage)
    if (url.pathname === "/v1/arbitrage") {
      const priceUSDC = env.DEFAULT_ARBITRAGE_PRICE_USDC || "0.05";
      const proofHeader =
        request.headers.get("x-402-payment-proof") ||
        request.headers.get("x402-payment-proof");

      const verification = x402Gateway.verifyPaymentProof(proofHeader, priceUSDC);

      if (!verification.valid) {
        return x402Gateway.createPaymentRequiredResponse("get_prediction_arbitrage", priceUSDC, url.origin);
      }

      const limit = Number(url.searchParams.get("limit")) || 10;
      const minEdge = Number(url.searchParams.get("minEdge")) || 3.0;
      const category = url.searchParams.get("category") || undefined;

      const data = await mcpServer.executeTool("get_prediction_arbitrage", {
        limit,
        minEdgePercentage: minEdge,
        category
      });

      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          ...defaultHeaders,
          "x-payment-verified": "true",
          "x-payer": verification.payer || "anonymous"
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
 * High-end Dark Mode UI for human inspection and agent connection
 */
function renderTerminalLanding(env: Env, tools: any[], origin: string): string {
  const toolsHtml = tools
    .map(
      (t) => `
    <div class="tool-card">
      <div class="tool-header">
        <span class="tool-name">${t.name}</span>
        <span class="tool-price">$${t.priceUSDC} USDC</span>
      </div>
      <p class="tool-desc">${t.description}</p>
      <div class="badge-list">
        <span class="badge">Network: ${env.NETWORK || "Base"}</span>
        <span class="badge">Protocol: x402-v1</span>
        <span class="badge">HTTP 402</span>
      </div>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArbitraX | Autonomous Prediction Arbitrage & x402 Gateway</title>
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: #11141c;
      --border: #1f2638;
      --accent: #00f5a0;
      --text: #f0f3fa;
      --text-muted: #8b95a8;
      --mono: 'JetBrains Mono', 'Geist Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 2.5rem 1.5rem;
      max-width: 960px;
      margin: 0 auto;
      line-height: 1.5;
    }
    .header {
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-family: var(--mono);
      background: rgba(0, 245, 160, 0.1);
      color: var(--accent);
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 0.8rem;
      border: 1px solid rgba(0, 245, 160, 0.2);
    }
    .pill .dot {
      width: 6px;
      height: 6px;
      background: var(--accent);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent);
    }
    h1 {
      font-size: 2.4rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      margin-bottom: 0.5rem;
    }
    h1 span {
      color: var(--accent);
    }
    p.lead {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 680px;
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
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.85rem;
      border: 1px solid #2a3652;
    }
    .tool-desc {
      color: var(--text-muted);
      font-size: 0.92rem;
      margin-bottom: 0.8rem;
    }
    .badge-list {
      display: flex;
      gap: 0.5rem;
    }
    .badge {
      font-size: 0.75rem;
      font-family: var(--mono);
      background: #0d1017;
      border: 1px solid var(--border);
      padding: 2px 7px;
      border-radius: 4px;
      color: #9ab;
    }
    .terminal-box {
      background: #06070a;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem;
      margin-top: 1.5rem;
    }
    .terminal-header {
      font-family: var(--mono);
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
      display: flex;
      justify-content: space-between;
    }
    pre {
      font-family: var(--mono);
      color: #7ee787;
      font-size: 0.85rem;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="pill"><span class="dot"></span> LIVE ON EDGE • BASE L2 ACTIVE</div>
    <h1>Arbitra<span>X</span></h1>
    <p class="lead">
      Autonomous MCP tool server and HTTP 402 Monetization Gateway. Delivers real-time Polymarket statistical arbitrage (+EV) and macro whale telemetry directly to AI agents.
    </p>
  </div>

  <h2 style="font-size: 1.2rem; margin-bottom: 1rem; color: #fff;">Available MCP Monetized Tools</h2>
  <div class="grid">
    ${toolsHtml}
  </div>

  <div class="terminal-box">
    <div class="terminal-header">
      <span>AI AGENT CONFIGURATION (Claude Desktop / Cursor)</span>
      <span>TRANSPORT: SSE / HTTP</span>
    </div>
    <pre>{
  "mcpServers": {
    "prediction-alpha": {
      "url": "${origin}/mcp",
      "headers": {
        "x-402-payment-proof": "{YOUR_USDC_TX_OR_AGENT_WALLET}"
      }
    }
  }
}</pre>
  </div>
</body>
</html>`;
}
