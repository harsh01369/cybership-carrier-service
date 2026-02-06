import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { UpsCarrier } from "../../src/carriers/ups/UpsCarrier.js";
import { CarrierError } from "../../src/domain/models/Errors.js";
import { validTokenResponse, sampleRateRequest } from "../fixtures/ups-responses.js";

const UPS_BASE = "https://onlinetools.ups.com";

const carrierConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  accountNumber: "A12B34",
  baseUrl: UPS_BASE,
  timeoutMs: 5000,
};

describe("UPS Error Handling", () => {
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

  it("invalidates token and throws AUTH_FAILED on 401 from rate endpoint", async () => {
    // First request gets a valid token
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Shop").reply(401, {});

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      const ce = err as CarrierError;
      expect(ce.code).toBe("AUTH_FAILED");
      expect(ce.statusCode).toBe(401);
    }

    // After 401, the token should be invalidated.
    // Next call should request a new token.
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Shop").reply(200, {
      RateResponse: {
        Response: { ResponseStatus: { Code: "1", Description: "Success" } },
        RatedShipment: {
          Service: { Code: "03" },
          BillingWeight: { UnitOfMeasurement: { Code: "LBS" }, Weight: "5" },
          TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "10.00" },
          ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
          TotalCharges: { CurrencyCode: "USD", MonetaryValue: "10.00" },
        },
      },
    });

    const quotes = await carrier.getRates(sampleRateRequest);
    expect(quotes).toHaveLength(1);
  });

  it("propagates auth failure when token request itself fails", async () => {
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(401, { error: "invalid_client" });

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      expect((err as CarrierError).code).toBe("AUTH_FAILED");
    }
  });

  it("handles network errors gracefully", async () => {
    stubAuth();
    nock(UPS_BASE)
      .post("/api/rating/v2403/Shop")
      .replyWithError("ECONNRESET");

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      expect((err as CarrierError).code).toBe("NETWORK_ERROR");
    }
  });

  it("handles timeout errors", async () => {
    stubAuth();
    nock(UPS_BASE)
      .post("/api/rating/v2403/Shop")
      .delayConnection(6000) // exceeds 5000ms timeout
      .reply(200, {});

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      // Could be TIMEOUT or NETWORK_ERROR depending on nock's behavior
      const ce = err as CarrierError;
      expect(["TIMEOUT", "NETWORK_ERROR"]).toContain(ce.code);
    }
  });

  it("handles completely malformed JSON in response body", async () => {
    stubAuth();
    nock(UPS_BASE)
      .post("/api/rating/v2403/Shop")
      .reply(200, "<html>Gateway Error</html>");

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      expect((err as CarrierError).code).toBe("MALFORMED_RESPONSE");
    }
  });

  it("handles UPS API error response with structured error details", async () => {
    stubAuth();
    nock(UPS_BASE).post("/api/rating/v2403/Shop").reply(422, {
      response: {
        errors: [
          { code: "111100", message: "The shipment weight exceeds the maximum limit" },
          { code: "111101", message: "Additional validation error" },
        ],
      },
    });

    try {
      await carrier.getRates(sampleRateRequest);
      expect.fail("Should have thrown");
    } catch (err) {
      const ce = err as CarrierError;
      expect(ce.code).toBe("CARRIER_API_ERROR");
      expect(ce.message).toContain("weight exceeds");
      expect(ce.details?.errors).toHaveLength(2);
    }
  });

  it("CarrierError includes all diagnostic fields", () => {
    const err = new CarrierError("CARRIER_API_ERROR", "Test error", {
      carrier: "UPS",
      statusCode: 500,
      details: { requestId: "abc-123" },
    });

    expect(err.name).toBe("CarrierError");
    expect(err.code).toBe("CARRIER_API_ERROR");
    expect(err.message).toBe("Test error");
    expect(err.carrier).toBe("UPS");
    expect(err.statusCode).toBe(500);
    expect(err.details?.requestId).toBe("abc-123");
    expect(err).toBeInstanceOf(Error);
  });
});
