// Demo: public API surface and validation behavior.
// Run with: npm run demo
// No live UPS credentials needed.

import { ShippingService } from "./ShippingService.js";
import { CarrierRegistry } from "./carriers/CarrierRegistry.js";
import { UpsCarrier } from "./carriers/ups/index.js";
import { CarrierError } from "./domain/models/Errors.js";
import type { RateRequest } from "./domain/models/RateRequest.js";

async function main() {
  // 1. Set up the carrier registry
  const registry = new CarrierRegistry();
  registry.register(
    new UpsCarrier({
      clientId: process.env.UPS_CLIENT_ID ?? "demo-client-id",
      clientSecret: process.env.UPS_CLIENT_SECRET ?? "demo-secret",
      accountNumber: process.env.UPS_ACCOUNT_NUMBER ?? "A12B34",
      baseUrl: process.env.UPS_BASE_URL ?? "https://onlinetools.ups.com",
    })
  );

  const service = new ShippingService(registry);

  // 2. Build a rate request
  const request: RateRequest = {
    origin: {
      name: "Cybership Warehouse",
      streetLines: ["123 Commerce Blvd"],
      city: "Atlanta",
      stateCode: "GA",
      postalCode: "30301",
      countryCode: "US",
    },
    destination: {
      name: "Jane Smith",
      streetLines: ["456 Oak Ave", "Apt 2B"],
      city: "Brooklyn",
      stateCode: "NY",
      postalCode: "11201",
      countryCode: "US",
    },
    packages: [
      {
        dimensions: { length: 12, width: 8, height: 6, unit: "IN" },
        weight: { value: 5.5, unit: "LBS" },
      },
    ],
  };

  console.log("Cybership Carrier Integration Service, Demo\n");
  console.log("Rate Request:");
  console.log(`  From: ${request.origin.city}, ${request.origin.stateCode}`);
  console.log(`  To:   ${request.destination.city}, ${request.destination.stateCode}`);
  console.log(`  Package: ${request.packages[0].weight.value} lbs\n`);

  // 3. Attempt to fetch rates (will fail without real credentials)
  try {
    const quotes = await service.getRates("UPS", request);
    console.log("Rates received:");
    for (const q of quotes) {
      console.log(`  ${q.serviceName}: $${q.totalCost} ${q.currency}`);
    }
  } catch (err) {
    if (err instanceof CarrierError) {
      console.log(`Expected error (no live API): [${err.code}] ${err.message}`);
    } else {
      console.error("Unexpected error:", err);
    }
  }

  // 4. Show validation in action
  console.log("\n--- Validation Demo ---");
  try {
    await service.getRates("UPS", {
      origin: { ...request.origin, postalCode: "" }, // invalid
      destination: request.destination,
      packages: [],                                   // invalid
    });
  } catch (err) {
    if (err instanceof CarrierError) {
      console.log(`Validation caught: [${err.code}] ${err.message}`);
    }
  }

  // 5. Show carrier-not-found handling
  try {
    await service.getRates("FEDEX", request);
  } catch (err) {
    if (err instanceof CarrierError) {
      console.log(`Carrier lookup: [${err.code}] ${err.message}`);
    }
  }
}

main().catch(console.error);
