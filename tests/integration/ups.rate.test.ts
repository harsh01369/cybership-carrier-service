import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { UpsCarrier } from "../../src/carriers/ups/UpsCarrier.js";
import { CarrierError } from "../../src/domain/models/Errors.js";
import {
  validTokenResponse,
  singleRateResponse,
  shopRateResponse,
  negotiatedRateResponse,
  invalidAddressError,
  sampleRateRequest,
} from "../fixtures/ups-responses.js";

const UPS_BASE = "https://onlinetools.ups.com";

const carrierConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  accountNumber: "A12B34",
  baseUrl: UPS_BASE,
  timeoutMs: 5000,
};

describe("UPS Rate Shopping", () => {
  let carrier: UpsCarrier;

  beforeEach(() => {
    carrier = new UpsCarrier(carrierConfig);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  function stubAuth() {
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(200, validTokenResponse);
  }

  // Request Building

  it("builds correct UPS request payload from domain model", async () => {
    stubAuth();

    let capturedBody: Record<string, unknown> | null = null;

    nock(UPS_BASE)
      .post("/api/rating/v2403/Shop", (body: Record<string, unknown>) => {
        capturedBody = body;
        return true;
      })
      .reply(200, shopRateResponse);

    await carrier.getRates(sampleRateRequest);

    // Verify the request was transformed correctly
    expect(capturedBody).toBeTruthy();
    const rateReq = (capturedBody as any).RateRequest;
    expect(rateReq.Shipment.Shipper.ShipperNumber).toBe("A12B34");
    expect(rateReq.Shipment.Shipper.Address.City).toBe("Atlanta");
    expect(rateReq.Shipment.Shipper.Address.PostalCode).toBe("30301");
    expect(rateReq.Shipment.ShipTo.Address.City).toBe("New York");
    expect(rateReq.Shipment.ShipTo.Address.PostalCode).toBe("10001");
    expect(rateReq.Shipment.Package).toHaveLength(1);
    expect(rateReq.Shipment.Package[0].PackageWeight.Weight).toBe("5");
    expect(rateReq.Shipment.Package[0].Dimensions.Length).toBe("12");
  });

  it("uses Shop endpoint when no service code is specified", async () => {
    stubAuth();

    const scope = nock(UPS_BASE)
      .post("/api/rating/v2403/Shop")
      .reply(200, shopRateResponse);

    await carrier.getRates(sampleRateRequest);
    expect(scope.isDone()).toBe(true);
  });

  it("uses Rate endpoint when a specific service code is provided", async () => {
    stubAuth();

    const scope = nock(UPS_BASE)
      .post("/api/rating/v2403/Rate")
      .reply(200, singleRateResponse);

    await carrier.getRates({ ...sampleRateRequest, serviceCode: "03" });
    expect(scope.isDone()).toBe(true);
  });

  // Response Parsing

  it("parses a single-service rate response correctly", async () => {
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Rate").reply(200, singleRateResponse);

    const quotes = await carrier.getRates({
      ...sampleRateRequest,
      serviceCode: "03",
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      carrier: "UPS",
      serviceCode: "03",
      serviceName: "UPS Ground",
      totalCost: 12.35,
      currency: "USD",
      transitDays: 5,
      guaranteedDelivery: true,
    });
  });

  it("parses rate-shop response with multiple services", async () => {
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Shop").reply(200, shopRateResponse);

    const quotes = await carrier.getRates(sampleRateRequest);

    expect(quotes).toHaveLength(3);

    // Should be sorted from cheapest to most expensive by the fixture data
    const ground = quotes.find((q) => q.serviceCode === "03");
    const secondDay = quotes.find((q) => q.serviceCode === "02");
    const nextDay = quotes.find((q) => q.serviceCode === "01");

    expect(ground).toBeDefined();
    expect(ground!.totalCost).toBe(12.35);
    expect(ground!.serviceName).toBe("UPS Ground");

    expect(secondDay).toBeDefined();
    expect(secondDay!.totalCost).toBe(24.50);
    expect(secondDay!.transitDays).toBe(2);

    expect(nextDay).toBeDefined();
    expect(nextDay!.totalCost).toBe(48.30);
    expect(nextDay!.transitDays).toBe(1);
  });

  it("prefers negotiated rates when available", async () => {
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Rate").reply(200, negotiatedRateResponse);

    const quotes = await carrier.getRates({
      ...sampleRateRequest,
      serviceCode: "03",
    });

    // Negotiated rate is $9.99, published is $12.35
    expect(quotes[0].totalCost).toBe(9.99);
  });

  it("includes charge breakdown in response", async () => {
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Shop").reply(200, shopRateResponse);

    const quotes = await carrier.getRates(sampleRateRequest);
    const nextDay = quotes.find((q) => q.serviceCode === "01")!;

    expect(nextDay.charges).toHaveLength(2);
    expect(nextDay.charges![0]).toMatchObject({
      description: "Transportation",
      amount: 45.80,
      currency: "USD",
    });
    expect(nextDay.charges![1]).toMatchObject({
      description: "Service Options",
      amount: 2.50,
    });
  });

  // Input Validation

  it("rejects request with missing origin fields", async () => {
    const badRequest = {
      ...sampleRateRequest,
      origin: { ...sampleRateRequest.origin, city: "" },
    };

    await expect(carrier.getRates(badRequest)).rejects.toThrow(CarrierError);
    await expect(carrier.getRates(badRequest)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects request with no packages", async () => {
    const badRequest = { ...sampleRateRequest, packages: [] };

    await expect(carrier.getRates(badRequest)).rejects.toThrow(CarrierError);
    await expect(carrier.getRates(badRequest)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects request with invalid package weight", async () => {
    const badRequest = {
      ...sampleRateRequest,
      packages: [
        {
          dimensions: { length: 12, width: 8, height: 6, unit: "IN" as const },
          weight: { value: -1, unit: "LBS" as const },
        },
      ],
    };

    await expect(carrier.getRates(badRequest)).rejects.toThrow(CarrierError);
  });

  // API Errors

  it("throws CARRIER_API_ERROR for 400-level responses", async () => {
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Shop").reply(400, invalidAddressError);

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      const ce = err as CarrierError;
      expect(ce.code).toBe("CARRIER_API_ERROR");
      expect(ce.statusCode).toBe(400);
      expect(ce.carrier).toBe("UPS");
    }
  });

  it("throws RATE_LIMIT for 429 responses", async () => {
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Shop").reply(429, {});

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      expect((err as CarrierError).code).toBe("RATE_LIMIT");
    }
  });

  it("throws MALFORMED_RESPONSE for non-JSON responses", async () => {
    stubAuth();
    nock(UPS_BASE)
      .post("/api/rating/v2403/Shop")
      .reply(200, "this is not json", { "Content-Type": "text/html" });

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      expect((err as CarrierError).code).toBe("MALFORMED_RESPONSE");
    }
  });

  it("throws CARRIER_API_ERROR for 500 server errors", async () => {
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Shop").reply(500, {
      response: { errors: [{ code: "500", message: "Internal Server Error" }] },
    });

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      expect((err as CarrierError).code).toBe("CARRIER_API_ERROR");
      expect((err as CarrierError).statusCode).toBe(500);
    }
  });
});
