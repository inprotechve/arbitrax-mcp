#!/usr/bin/env node
import readline from "node:readline";

const GATEWAY_URL = process.env.ARBITRAX_URL || "https://arbitrax-gateway.inprotechve.workers.dev/mcp";
const PAYMENT_PROOF = process.env.X_402_PAYMENT_PROOF || "";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const headers = { "Content-Type": "application/json" };
    if (PAYMENT_PROOF) {
      headers["x-402-payment-proof"] = PAYMENT_PROOF;
    }

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers,
      body: trimmed
    });

    const result = await response.text();
    console.log(result);
  } catch (err) {
    console.log(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: `ArbitraX Bridge Error: ${err.message}` }
      })
    );
  }
});
