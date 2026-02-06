import type { Carrier } from "../Carrier.js";
import type { RateRequest, RateQuote } from "../../domain/models/index.js";
import { CarrierError } from "../../domain/models/Errors.js";
import { RateRequestSchema } from "../../domain/schemas/index.js";
import { HttpClient } from "../../http/HttpClient.js";
import { UpsAuth } from "./UpsAuth.js";
import { UpsMapper } from "./UpsMapper.js";
import type { UpsRateResponse, UpsErrorResponse } from "./ups.types.js";

export interface UpsCarrierConfig {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  baseUrl: string;
  timeoutMs?: number;
}

// UPS adapter. Coordinates auth, payload mapping, and HTTP calls.
// The service layer uses this through the Carrier interface.
export class UpsCarrier implements Carrier {
  readonly name = "UPS";
  readonly code = "UPS";

  private readonly auth: UpsAuth;
  private readonly mapper: UpsMapper;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(config: UpsCarrierConfig) {
    this.baseUrl = config.baseUrl;
    this.httpClient = new HttpClient(config.timeoutMs);
    this.auth = new UpsAuth(
      config.clientId,
      config.clientSecret,
      config.baseUrl,
      this.httpClient
    );
    this.mapper = new UpsMapper(config.accountNumber);
  }

  async getRates(request: RateRequest): Promise<RateQuote[]> {
    // Validate input before making any external call
    const validation = RateRequestSchema.safeParse(request);
    if (!validation.success) {
      const issues = validation.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new CarrierError("VALIDATION_ERROR", `Invalid rate request: ${issues}`, {
        carrier: "UPS",
        details: { issues: validation.error.issues },
      });
    }

    const token = await this.auth.getToken();
    const upsRequest = this.mapper.toUpsRateRequest(request);

    // "Shop" for rate shopping, "Rate" for a specific service.
    const endpoint = request.serviceCode ? "Rate" : "Shop";

    const response = await this.httpClient.request<UpsRateResponse | UpsErrorResponse>({
      method: "POST",
      url: `${this.baseUrl}/api/rating/v2403/${endpoint}`,
      headers: {
        Authorization: `Bearer ${token}`,
        transId: crypto.randomUUID(),
        transactionSrc: "cybership",
      },
      body: upsRequest,
    });

    if (response.status === 401) {
      // Token expired or revoked between check and use. Clear it.
      this.auth.invalidate();
      throw new CarrierError("AUTH_FAILED", "UPS authentication expired or revoked", {
        carrier: "UPS",
        statusCode: 401,
      });
    }

    if (response.status === 429) {
      throw new CarrierError("RATE_LIMIT", "UPS rate limit exceeded, try again later", {
        carrier: "UPS",
        statusCode: 429,
      });
    }

    if (response.status >= 400) {
      const errorData = response.data as UpsErrorResponse;
      const message = errorData?.response?.errors?.[0]?.message ?? "UPS API error";
      throw new CarrierError("CARRIER_API_ERROR", message, {
        carrier: "UPS",
        statusCode: response.status,
        details: { errors: errorData?.response?.errors },
      });
    }

    // Normalize the response into domain objects
    try {
      return this.mapper.fromUpsRateResponse(response.data as UpsRateResponse);
    } catch (err) {
      throw new CarrierError(
        "MALFORMED_RESPONSE",
        "Failed to parse UPS rate response",
        {
          carrier: "UPS",
          cause: err,
          details: { response: response.data },
        }
      );
    }
  }
}
