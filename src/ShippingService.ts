import type { RateRequest, RateQuote } from "./domain/models/index.js";
import type { CarrierRegistry } from "./carriers/CarrierRegistry.js";

// Entry point for all shipping operations. Delegates to carrier
// adapters and returns normalized domain objects.
export class ShippingService {
  constructor(private readonly registry: CarrierRegistry) {}

  async getRates(carrierCode: string, request: RateRequest): Promise<RateQuote[]> {
    const carrier = this.registry.get(carrierCode);
    return carrier.getRates(request);
  }

  // Queries all registered carriers in parallel.
  // Individual carrier failures do not block other results.
  async getRatesFromAll(
    request: RateRequest
  ): Promise<{ carrier: string; quotes: RateQuote[]; error?: string }[]> {
    const carriers = this.registry.list();

    const results = await Promise.allSettled(
      carriers.map((c) => c.getRates(request))
    );

    return carriers.map((carrier, i) => {
      const result = results[i];
      if (result.status === "fulfilled") {
        return { carrier: carrier.code, quotes: result.value };
      }
      return {
        carrier: carrier.code,
        quotes: [],
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
      };
    });
  }
}
