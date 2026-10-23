export interface Env {
  ENVIRONMENT: string;
  NETWORK: string;
  TREASURY_WALLET_BASE: string;
  DEFAULT_ARBITRAGE_PRICE_USDC: string;
  DEFAULT_WHALE_PULSE_PRICE_USDC: string;
}

// Model Context Protocol (MCP) JSON-RPC 2.0 Interfaces
export interface MCPRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  priceUSDC: number;
}

// Market Data & Arbitrage Types
export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId?: string;
  slug?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  volume?: string | number;
  liquidity?: string | number;
  active?: boolean;
  closed?: boolean;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  description?: string;
  slug?: string;
  volume?: number;
  liquidity?: number;
  startDate?: string;
  endDate?: string;
  markets: PolymarketMarket[];
}

export interface ArbitrageOpportunity {
  eventId: string;
  eventTitle: string;
  marketQuestion: string;
  outcomes: {
    name: string;
    polymarketProbability: number;
    benchmarkProbability: number;
    discrepancyDelta: number;
    edgeRating: "+EV" | "NEUTRAL" | "-EV";
  }[];
  maxEdgePercentage: number;
  liquidityUSD: number;
  detectedAt: string;
  recommendedAction: string;
}

export interface WhalePulseSignal {
  symbol: string;
  signalType: "BULLISH_DIVERGENCE" | "BEARISH_LIQUIDATION" | "WHALE_ACCUMULATION" | "MACRO_BREAKOUT";
  confidenceScore: number; // 0 - 100
  whaleVolumeUSDC: number;
  catalyst: string;
  timestamp: string;
}

export interface PaymentChallenge {
  status: 402;
  protocol: "x402-v1";
  network: string;
  token: "USDC";
  amount: string;
  recipient: string;
  nonce: string;
  expiresAt: number;
  message: string;
}
