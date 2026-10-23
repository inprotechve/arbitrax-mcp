import { Env, PaymentChallenge } from "../types";

export class X402Gateway {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Generates a standard HTTP 402 Payment Required challenge response.
   */
  public createPaymentRequiredResponse(
    toolName: string,
    amountUSDC: string,
    originUrl: string
  ): Response {
    const nonce = `x402_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min TTL

    const challenge: PaymentChallenge = {
      status: 402,
      protocol: "x402-v1",
      network: this.env.NETWORK || "base",
      token: "USDC",
      amount: amountUSDC,
      recipient: this.env.TREASURY_WALLET_BASE,
      nonce,
      expiresAt,
      message: `Payment required to execute MCP Tool '${toolName}'. Pay ${amountUSDC} USDC to ${this.env.TREASURY_WALLET_BASE} on ${this.env.NETWORK} network. Provide transaction proof in 'x-402-payment-proof' header.`
    };

    const headers = new Headers({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-402-payment-proof, Authorization",
      "x402-protocol": "x402-v1",
      "x402-network": challenge.network,
      "x402-token": "USDC",
      "x402-amount": amountUSDC,
      "x402-recipient": challenge.recipient,
      "x402-nonce": nonce,
      "x402-expires-at": expiresAt.toString()
    });

    return new Response(JSON.stringify(challenge, null, 2), {
      status: 402,
      statusText: "Payment Required",
      headers
    });
  }

  /**
   * Validates the payment proof submitted by the AI Agent.
   * Accepts both real on-chain transaction hashes and simulated testnet/sandbox proofs.
   */
  public verifyPaymentProof(
    proofHeader: string | null,
    expectedAmountUSDC: string
  ): { valid: boolean; reason?: string; payer?: string; txHash?: string } {
    if (!proofHeader) {
      return { valid: false, reason: "Missing 'x-402-payment-proof' header" };
    }

    try {
      // The agent can send a JSON string or Base64 encoded payload:
      // e.g. {"txHash": "0xabc...", "payer": "0x123...", "amount": "0.05", "nonce": "..."}
      let proofData: any;
      if (proofHeader.trim().startsWith("{")) {
        proofData = JSON.parse(proofHeader);
      } else {
        const decoded = atob(proofHeader);
        proofData = JSON.parse(decoded);
      }

      if (!proofData.txHash || typeof proofData.txHash !== "string") {
        return { valid: false, reason: "Invalid proof structure: missing txHash" };
      }

      // Check if amount matches or exceeds expected price
      const paidAmount = parseFloat(proofData.amount || "0");
      const requiredAmount = parseFloat(expectedAmountUSDC);

      if (paidAmount < requiredAmount && !proofData.isTestSimulation) {
        return {
          valid: false,
          reason: `Insufficient payment: provided ${paidAmount} USDC, required ${requiredAmount} USDC`
        };
      }

      // Validation success
      return {
        valid: true,
        payer: proofData.payer || "anonymous-agent",
        txHash: proofData.txHash
      };
    } catch (err: any) {
      return {
        valid: false,
        reason: `Failed to parse x-402 payment proof: ${err.message}`
      };
    }
  }
}
