import { Env, MCPRequest, MCPResponse, MCPToolDefinition } from "../types";
import { PolymarketService } from "../services/polymarket";
import { ArbitrageEngine } from "../services/arbitrage";

export class MCPServer {
  private env: Env;
  private polymarket: PolymarketService;
  private arbitrage: ArbitrageEngine;

  constructor(env: Env) {
    this.env = env;
    this.polymarket = new PolymarketService();
    this.arbitrage = new ArbitrageEngine();
  }

  /**
   * Returns catalog of tools exposed by this MCP server along with their x402 prices.
   */
  public getToolDefinitions(): MCPToolDefinition[] {
    return [
      {
        name: "get_prediction_arbitrage",
        description:
          "Scans live Polymarket prediction markets (politics, elections, sports, crypto) and calculates +EV statistical discrepancies and arbitrage spreads against consensus models.",
        priceUSDC: parseFloat(this.env.DEFAULT_ARBITRAGE_PRICE_USDC || "0.05"),
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of high-liquidity events to analyze (default: 10, max: 25)"
            },
            minEdgePercentage: {
              type: "number",
              description: "Minimum discrepancy percentage to report (default: 3.0)"
            },
            category: {
              type: "string",
              description: "Filter category: 'politics', 'sports', 'crypto', 'pop-culture'"
            }
          }
        }
      },
      {
        name: "search_prediction_events",
        description:
          "Searches active prediction markets on Polymarket with live probability outcome pricing and liquidity volume.",
        priceUSDC: 0.02,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search keyword (e.g., 'Trump', 'Bitcoin', 'SuperBowl', 'Fed Rate')"
            },
            limit: {
              type: "number",
              description: "Maximum number of events to return (default: 5)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_whale_macro_signals",
        description:
          "Fetches real-time algorithmic whale accumulation and macro geopolitical momentum signals for Oil, Gold, and Crypto.",
        priceUSDC: parseFloat(this.env.DEFAULT_WHALE_PULSE_PRICE_USDC || "0.10"),
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ];
  }

  /**
   * Dispatches and handles standard MCP JSON-RPC 2.0 requests.
   */
  public async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "prediction-alpha-gateway",
              version: "1.0.0"
            },
            capabilities: {
              tools: { listChanged: false }
            }
          }
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: this.getToolDefinitions().map((t) => ({
              name: t.name,
              description: `${t.description} [Price: $${t.priceUSDC} USDC]`,
              inputSchema: t.inputSchema
            }))
          }
        };

      case "tools/call": {
        const toolName = params?.name;
        const toolArguments = params?.arguments || {};

        const executionResult = await this.executeTool(toolName, toolArguments);

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(executionResult, null, 2)
              }
            ]
          }
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method '${method}' not found on Prediction Alpha MCP Server`
          }
        };
    }
  }

  /**
   * Executes underlying alpha analytics tools.
   */
  public async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (toolName === "get_prediction_arbitrage") {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);
      const minEdge = (Number(args.minEdgePercentage) || 3.0) / 100;
      const category = args.category;

      const events = await this.polymarket.getActiveEvents(limit, category);
      const arbitrageDeals = this.arbitrage.calculateArbitrageOpportunities(events, minEdge);

      return {
        success: true,
        summary: `Scanned ${events.length} active Polymarket events. Found ${arbitrageDeals.length} arbitrage / +EV opportunities exceeding ${(minEdge * 100).toFixed(1)}% discrepancy.`,
        opportunities: arbitrageDeals,
        timestamp: new Date().toISOString()
      };
    }

    if (toolName === "search_prediction_events") {
      const query = String(args.query || "");
      const limit = Math.min(Number(args.limit) || 5, 10);

      const results = await this.polymarket.searchEvents(query, limit);

      return {
        success: true,
        query,
        count: results.length,
        events: results
      };
    }

    if (toolName === "get_whale_macro_signals") {
      const signals = this.arbitrage.generateWhalePulseSignals();
      return {
        success: true,
        count: signals.length,
        signals,
        riskDisclaimer: "Algorithmic data for autonomous agents. Always verify position sizing and stop-loss limits."
      };
    }

    throw new Error(`Unknown tool name: ${toolName}`);
  }
}
