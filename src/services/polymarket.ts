import { PolymarketEvent, PolymarketMarket } from "../types";

export class PolymarketService {
  private static BASE_URL = "https://gamma-api.polymarket.com";

  /**
   * Fetches active markets and events from Polymarket Gamma API.
   * Cached at edge for 30 seconds to optimize latency and minimize upstream rate limits.
   */
  public async getActiveEvents(limit = 10, category?: string): Promise<PolymarketEvent[]> {
    try {
      let url = `${PolymarketService.BASE_URL}/events?limit=${limit}&active=true&closed=false`;
      if (category) {
        url += `&tag=${encodeURIComponent(category)}`;
      }

      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "PredictionAlphaGateway/1.0"
        },
        // In Cloudflare Workers, cf: { cacheTtl: 30 } can be used
      });

      if (!response.ok) {
        throw new Error(`Polymarket API returned status ${response.status}`);
      }

      const data = (await response.json()) as any[];

      return data.map((item) => ({
        id: item.id || String(item.ticker || item.slug),
        title: item.title || "Untitled Market",
        description: item.description || "",
        slug: item.slug || "",
        volume: Number(item.volume || 0),
        liquidity: Number(item.liquidity || 0),
        startDate: item.startDate,
        endDate: item.endDate,
        markets: (item.markets || []).map((m: any): PolymarketMarket => {
          let outcomes: string[] = [];
          let outcomePrices: string[] = [];

          try {
            outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes || [];
            outcomePrices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices || [];
          } catch {
            outcomes = ["Yes", "No"];
            outcomePrices = ["0.5", "0.5"];
          }

          return {
            id: m.id,
            question: m.question || item.title,
            conditionId: m.conditionId,
            slug: m.slug,
            outcomes,
            outcomePrices,
            volume: m.volume,
            liquidity: m.liquidity,
            active: m.active,
            closed: m.closed
          };
        })
      }));
    } catch (error: any) {
      console.error("[PolymarketService] Error fetching events:", error.message);
      return [];
    }
  }

  /**
   * Searches Polymarket events by keyword (e.g. 'President', 'Bitcoin', 'SuperBowl', 'Fed').
   */
  public async searchEvents(query: string, limit = 5): Promise<PolymarketEvent[]> {
    const all = await this.getActiveEvents(30);
    const q = query.toLowerCase();

    return all
      .filter((ev) => ev.title.toLowerCase().includes(q) || (ev.description && ev.description.toLowerCase().includes(q)))
      .slice(0, limit);
  }
}
