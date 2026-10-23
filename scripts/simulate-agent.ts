import worker from "../src/index";
import { Env } from "../src/types";

// Mock Cloudflare Worker Environment
const mockEnv: Env = {
  ENVIRONMENT: "development",
  NETWORK: "base",
  TREASURY_WALLET_BASE: "0x3e6441ce005b8D575C6Ae045e53CeEEe800968EB",
  DEFAULT_ARBITRAGE_PRICE_USDC: "0.05",
  DEFAULT_WHALE_PULSE_PRICE_USDC: "0.10"
};

const mockCtx: any = {
  waitUntil: () => {},
  passThroughOnException: () => {}
};

async function runAgentSimulation() {
  console.log("================================================================================");
  console.log("🤖 SIMULATING AI AGENT (Claude / Custom Agent) CONNECTING TO MCP & x402 GATEWAY");
  console.log("================================================================================\n");

  // Step 1: Discover Tools (Free)
  console.log("1️⃣ [Agent Discovery] Requesting MCP tools/list (Free endpoint)...");
  const listReq = new Request("https://gateway.local/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "req_1",
      method: "tools/list"
    })
  });

  const listRes = await worker.fetch(listReq, mockEnv, mockCtx);
  const listData = await listRes.json();
  console.log("✅ MCP Tools Discovered:", (listData as any).result?.tools?.map((t: any) => t.name));
  console.log("--------------------------------------------------------------------------------\n");

  // Step 2: Agent attempts to call tool WITHOUT paying (Expect HTTP 402)
  console.log("2️⃣ [Unpaid Call] Agent calls 'get_prediction_arbitrage' without payment proof...");
  const unpaidReq = new Request("https://gateway.local/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "req_2",
      method: "tools/call",
      params: {
        name: "get_prediction_arbitrage",
        arguments: { limit: 5, minEdgePercentage: 2.0 }
      }
    })
  });

  const unpaidRes = await worker.fetch(unpaidReq, mockEnv, mockCtx);
  console.log(`📡 Response Status: ${unpaidRes.status} ${unpaidRes.statusText}`);
  console.log(`🔐 x402 Challenge Headers:`);
  console.log(`   - x402-protocol: ${unpaidRes.headers.get("x402-protocol")}`);
  console.log(`   - x402-price: ${unpaidRes.headers.get("x402-amount")} ${unpaidRes.headers.get("x402-token")}`);
  console.log(`   - x402-recipient: ${unpaidRes.headers.get("x402-recipient")}`);
  console.log(`   - x402-nonce: ${unpaidRes.headers.get("x402-nonce")}`);

  const challengeBody = await unpaidRes.json();
  console.log("📄 Challenge Message:", (challengeBody as any).message);
  console.log("--------------------------------------------------------------------------------\n");

  // Step 3: Agent signs microtransaction and re-submits with proof
  console.log("3️⃣ [Paid Call] Agent executes microtransaction on Base and presents payment proof...");
  const paymentProof = {
    txHash: "0x8f4c82b3d1490234a9b6910a2f4c9a87d12f10b7498c1928014e7a83d9921bc4",
    payer: "0xAgentWallet_Base_0x42",
    amount: "0.05",
    isTestSimulation: true,
    nonce: unpaidRes.headers.get("x402-nonce")
  };

  const paidReq = new Request("https://gateway.local/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-402-payment-proof": JSON.stringify(paymentProof)
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "req_3",
      method: "tools/call",
      params: {
        name: "get_prediction_arbitrage",
        arguments: { limit: 5, minEdgePercentage: 2.0 }
      }
    })
  });

  const paidRes = await worker.fetch(paidReq, mockEnv, mockCtx);
  console.log(`📡 Response Status: ${paidRes.status} ${paidRes.statusText}`);
  console.log(`💰 Payment Verified: ${paidRes.headers.get("x-payment-verified")}`);
  console.log(`👤 Payer: ${paidRes.headers.get("x-payer")}`);

  const paidData: any = await paidRes.json();
  const resultText = paidData.result?.content?.[0]?.text;
  if (resultText) {
    const parsed = JSON.parse(resultText);
    console.log("📊 Summary:", parsed.summary);
    console.log("🎯 Top Arbitrage Opportunities Found:");
    console.dir(parsed.opportunities?.slice(0, 2), { depth: null });
  } else {
    console.log("Payload:", paidData);
  }

  console.log("\n================================================================================");
  console.log("🎉 SUCCESS: End-to-end MCP + x402 Monetization flow successfully verified!");
  console.log("================================================================================");
}

runAgentSimulation().catch((err) => {
  console.error("Simulation error:", err);
});
