import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { ShippingService } from "../../src/ShippingService.js";
import { CarrierRegistry } from "../../src/carriers/CarrierRegistry.js";
import { UpsCarrier } from "../../src/carriers/ups/UpsCarrier.js";
import { CarrierError } from "../../src/domain/models/Errors.js";
import {
  validTokenResponse,
  shopRateResponse,
  sampleRateRequest,
} from "../fixtures/ups-responses.js";

const UPS_BASE = "https://onlinetools.ups.com";

describe("ShippingService", () => {
  let service: ShippingService;
  let registry: CarrierRegistry;

  beforeEach(() => {
    registry = new CarrierRegistry();
    registry.register(
      new UpsCarrier({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        accountNumber: "A12B34",
        baseUrl: UPS_BASE,
      })
    );
    service = new ShippingService(registry);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("fetches rates through the carrier-agnostic interface", async () => {
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(200, validTokenResponse);
    nock(UPS_BASE)
      .post("/api/rating/v2403/Shop")
      .reply(200, shopRateResponse);

    const quotes = await service.getRates("UPS", sampleRateRequest);

    expect(quotes).toHaveLength(3);
    expect(quotes[0].carrier).toBe("UPS");
  });

  it("throws CARRIER_NOT_FOUND for unregistered carriers", async () => {
    await expect(
      service.getRates("FEDEX", sampleRateRequest)
    ).rejects.toMatchObject({
      code: "CARRIER_NOT_FOUND",
    });
  });

  it("getRatesFromAll returns results from all carriers without blocking on failures", async () => {
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(200, validTokenResponse);
    nock(UPS_BASE)
      .post("/api/rating/v2403/Shop")
      .reply(200, shopRateResponse);

    const results = await service.getRatesFromAll(sampleRateRequest);

    expect(results).toHaveLength(1);
    expect(results[0].carrier).toBe("UPS");
    expect(results[0].quotes).toHaveLength(3);
    expect(results[0].error).toBeUndefined();
  });

  it("getRatesFromAll handles individual carrier failures gracefully", async () => {
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(401, { error: "invalid_client" });

    const results = await service.getRatesFromAll(sampleRateRequest);

    expect(results).toHaveLength(1);
    expect(results[0].carrier).toBe("UPS");
    expect(results[0].quotes).toHaveLength(0);
    expect(results[0].error).toBeTruthy();
  });
});

describe("CarrierRegistry", () => {
  it("lists all registered carriers", () => {
    const registry = new CarrierRegistry();
    const ups = new UpsCarrier({
      clientId: "id",
      clientSecret: "secret",
      accountNumber: "123",
      baseUrl: UPS_BASE,
    });
    registry.register(ups);

    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].code).toBe("UPS");
  });

  it("throws CarrierError for unknown carrier codes", () => {
    const registry = new CarrierRegistry();
    expect(() => registry.get("UNKNOWN")).toThrow(CarrierError);
  });
});
