#!/usr/bin/env node
import readline from "node:readline";

const GATEWAY_URL = process.env.ARBITRAX_URL || "https://arbitrax-gateway.inprotechve.workers.dev/mcp";
const PAYMENT_PROOF = process.env["x-402-payment-proof"] || process.env.X_402_PAYMENT_PROOF || process.env.PAYMENT_PROOF || "";
const API_KEY = process.env.ARBITRAX_API_KEY || process.env.X_API_KEY || process.env.API_KEY || "";

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
    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
      headers["x-api-key"] = API_KEY;
    }
    if (PAYMENT_PROOF) {
      headers["x-402-payment-proof"] = PAYMENT_PROOF;
    }

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers,
      body: trimmed
    });

    const rawText = await response.text();

    // CRITICAL: MCP Stdio protocol (and mcp-proxy) strictly requires single-line JSON followed by \n
    try {
      const data = JSON.parse(rawText);
      process.stdout.write(JSON.stringify(data) + "\n");
    } catch {
      process.stdout.write(rawText.replace(/\r?\n/g, "") + "\n");
    }
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: `ArbitraX Bridge Error: ${err.message}` }
      }) + "\n"
    );
  }
});
