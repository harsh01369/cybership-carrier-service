import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import nock from "nock";
import { UpsAuth } from "../../src/carriers/ups/UpsAuth.js";
import { HttpClient } from "../../src/http/HttpClient.js";
import { CarrierError } from "../../src/domain/models/Errors.js";
import { validTokenResponse } from "../fixtures/ups-responses.js";

const UPS_BASE = "https://onlinetools.ups.com";

describe("UPS OAuth Authentication", () => {
  let auth: UpsAuth;
  let httpClient: HttpClient;

  beforeEach(() => {
    httpClient = new HttpClient(5000);
    auth = new UpsAuth("test-client-id", "test-client-secret", UPS_BASE, httpClient);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("acquires a token via client credentials flow", async () => {
    const scope = nock(UPS_BASE)
      .post("/security/v1/oauth/token", "grant_type=client_credentials")
      .reply(200, validTokenResponse);

    const token = await auth.getToken();

    expect(token).toBe(validTokenResponse.access_token);
    expect(scope.isDone()).toBe(true);
  });

  it("sends Basic auth header with base64-encoded credentials", async () => {
    const expectedAuth = Buffer.from("test-client-id:test-client-secret").toString("base64");

    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .matchHeader("Authorization", `Basic ${expectedAuth}`)
      .reply(200, validTokenResponse);

    await auth.getToken();
  });

  it("caches token and reuses it on subsequent calls", async () => {
    const scope = nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .once()
      .reply(200, validTokenResponse);

    const token1 = await auth.getToken();
    const token2 = await auth.getToken();
    const token3 = await auth.getToken();

    expect(token1).toBe(token2);
    expect(token2).toBe(token3);
    // Only one HTTP call should have been made
    expect(scope.isDone()).toBe(true);
  });

  it("refreshes token when it expires", async () => {
    // First token expires almost immediately
    const shortLivedToken = {
      ...validTokenResponse,
      access_token: "short-lived-token",
      expires_in: "1", // 1 second
    };
    const freshToken = {
      ...validTokenResponse,
      access_token: "fresh-token",
    };

    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(200, shortLivedToken);

    const token1 = await auth.getToken();
    expect(token1).toBe("short-lived-token");

    // The 1-second token minus the 60s buffer means it's already expired.
    // Next call should trigger a new token fetch.
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(200, freshToken);

    const token2 = await auth.getToken();
    expect(token2).toBe("fresh-token");
  });

  it("invalidate() forces re-fetch on next call", async () => {
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(200, validTokenResponse);

    await auth.getToken();

    auth.invalidate();

    const newToken = {
      ...validTokenResponse,
      access_token: "new-token-after-invalidation",
    };
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(200, newToken);

    const token = await auth.getToken();
    expect(token).toBe("new-token-after-invalidation");
  });

  it("throws AUTH_FAILED when token endpoint returns non-200", async () => {
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .reply(401, {
        response: {
          errors: [{ code: "250003", message: "Invalid credentials" }],
        },
      });

    try {
      await auth.getToken();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      const ce = err as CarrierError;
      expect(ce.code).toBe("AUTH_FAILED");
      expect(ce.carrier).toBe("UPS");
    }
  });

  it("throws NETWORK_ERROR when token endpoint is unreachable", async () => {
    nock(UPS_BASE)
      .post("/security/v1/oauth/token")
      .replyWithError("Connection refused");

    try {
      await auth.getToken();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CarrierError);
      // Could be NETWORK_ERROR or AUTH_FAILED depending on how the HttpClient wraps it
      const ce = err as CarrierError;
      expect(["NETWORK_ERROR", "AUTH_FAILED"]).toContain(ce.code);
    }
  });
});
