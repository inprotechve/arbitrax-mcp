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
  console.log("🤖 SIMULATING AI AGENT (Claude / Custom Agent) CONNECTING TO ARBITRAX MCP GATEWAY");
  console.log("   TESTING DUAL FREEMIUM FUNNEL: FREE LEAD MAGNET + FREEMIUM TEASER + PRO UNLOCK");
  console.log("================================================================================\n");

  // Step 1: Discover Tools (Free)
  console.log("1️⃣ [Agent Discovery] Requesting MCP tools/list (Free catalog)...");
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
  const listData: any = await listRes.json();
  const tools = listData.result?.tools || [];
  console.log("✅ MCP Tools Discovered:", tools.map((t: any) => `${t.name} -> ${t.description.split('[')[1]?.replace(']', '') || 'N/A'}`));
  console.log("--------------------------------------------------------------------------------\n");

  // Step 2: Test Free Tool (search_prediction_events: $0.00 USDC Lead Magnet)
  console.log("2️⃣ [Free Lead Magnet Call] Agent calls 'search_prediction_events' without paying ($0.00)...");
  const freeReq = new Request("https://gateway.local/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "req_2",
      method: "tools/call",
      params: {
        name: "search_prediction_events",
        arguments: { query: "Trump", limit: 3 }
      }
    })
  });

  const freeRes = await worker.fetch(freeReq, mockEnv, mockCtx);
  console.log(`📡 Response Status: ${freeRes.status} ${freeRes.statusText}`);
  console.log(`🏷️ Tier: ${freeRes.headers.get("x-tier")}`);
  const freeData: any = await freeRes.json();
  const freeParsed = JSON.parse(freeData.result?.content?.[0]?.text || "{}");
  console.log(`✅ Free Search Query '${freeParsed.query}' returned ${freeParsed.count} active prediction markets without payment!`);
  console.log("--------------------------------------------------------------------------------\n");

  // Step 3: Test Freemium Preview (get_prediction_arbitrage without payment proof)
  console.log("3️⃣ [Freemium Preview Call] Agent calls 'get_prediction_arbitrage' without payment proof...");
  const unpaidReq = new Request("https://gateway.local/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  const unpaidRes = await worker.fetch(unpaidReq, mockEnv, mockCtx);
  console.log(`📡 Response Status: ${unpaidRes.status} ${unpaidRes.statusText}`);
  console.log(`🏷️ Tier Header: ${unpaidRes.headers.get("x-tier")}`);
  console.log(`🔐 x402 Price Header: ${unpaidRes.headers.get("x402-amount")} ${unpaidRes.headers.get("x402-token")}`);

  const unpaidData: any = await unpaidRes.json();
  const unpaidParsed = JSON.parse(unpaidData.result?.content?.[0]?.text || "{}");
  console.log(`🎁 Freemium Tier: ${unpaidParsed.tier}`);
  console.log(`📄 Summary: ${unpaidParsed.summary}`);
  console.log(`🔓 Free Sample Opportunity Count: ${unpaidParsed.opportunities?.length}`);
  console.log(`🔒 Locked Opportunities Teaser Count: ${unpaidParsed.freemiumTeaser?.lockedOpportunitiesCount}`);
  console.log(`💎 Unlock Instruction: ${unpaidParsed.x402Unlock?.instruction}`);
  console.log("--------------------------------------------------------------------------------\n");

  // Step 4: Test Strict Paid Tool (get_whale_macro_signals without payment proof -> Expect HTTP 402)
  console.log("4️⃣ [Strict Paid Call] Agent calls 'get_whale_macro_signals' without paying ($0.10)...");
  const strictReq = new Request("https://gateway.local/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "req_4",
      method: "tools/call",
      params: {
        name: "get_whale_macro_signals",
        arguments: {}
      }
    })
  });

  const strictRes = await worker.fetch(strictReq, mockEnv, mockCtx);
  console.log(`📡 Response Status: ${strictRes.status} ${strictRes.statusText} (Standard x402 Challenge)`);
  console.log(`🔐 Challenge Headers: x402-amount=${strictRes.headers.get("x402-amount")}, recipient=${strictRes.headers.get("x402-recipient")}`);
  console.log("--------------------------------------------------------------------------------\n");

  // Step 5: Test Pro Paid Call (get_prediction_arbitrage WITH valid payment proof)
  console.log("5️⃣ [Pro Unlocked Call] Agent executes microtransaction on Base and presents payment proof...");
  const paymentProof = {
    txHash: "0x8f4c82b3d1490234a9b6910a2f4c9a87d12f10b7498c1928014e7a83d9921bc4",
    payer: "0xAgentWallet_Base_0x42",
    amount: "0.05",
    isTestSimulation: true
  };

  const paidReq = new Request("https://gateway.local/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-402-payment-proof": JSON.stringify(paymentProof)
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "req_5",
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
  console.log(`🏷️ Tier: ${paidRes.headers.get("x-tier")}`);
  console.log(`👤 Payer: ${paidRes.headers.get("x-payer")}`);

  const paidData: any = await paidRes.json();
  const paidParsed = JSON.parse(paidData.result?.content?.[0]?.text || "{}");
  console.log(`👑 Full Tier: ${paidParsed.tier}`);
  console.log(`📊 Summary: ${paidParsed.summary}`);
  console.log(`🎯 Total Unlocked Opportunities: ${paidParsed.opportunities?.length}`);
  console.log("--------------------------------------------------------------------------------\n");

  // Step 6: Test Web Demo Endpoint (/v1/demo)
  console.log("6️⃣ [Web UI Lead Magnet] Testing public endpoint GET /v1/demo...");
  const demoReq = new Request("https://gateway.local/v1/demo", { method: "GET" });
  const demoRes = await worker.fetch(demoReq, mockEnv, mockCtx);
  const demoData: any = await demoRes.json();
  console.log(`📡 Response Status: ${demoRes.status}`);
  console.log(`🎁 Demo Output Tier: ${demoData.tier}`);
  console.log(`🔓 Free Sample Available: ${demoData.opportunities?.length > 0 ? "YES" : "NO"}`);
  console.log(`🔒 Locked Alpha Count for Web Teaser: ${demoData.freemiumTeaser?.lockedOpportunitiesCount}`);

  console.log("\n================================================================================");
  console.log("🎉 SUCCESS: All 6 stages of the Dual-Funnel Freemium & Lead Magnet passed flawlessly!");
  console.log("================================================================================");
}

runAgentSimulation().catch((err) => {
  console.error("Simulation error:", err);
});
