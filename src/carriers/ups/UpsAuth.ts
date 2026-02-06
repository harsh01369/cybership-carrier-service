import { CarrierError } from "../../domain/models/Errors.js";
import { HttpClient } from "../../http/HttpClient.js";
import type { UpsTokenResponse } from "./ups.types.js";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// UPS OAuth 2.0 client-credentials flow.
// Caches tokens in memory with a 60s buffer before expiry.
// Callers call getToken() before each request. Caching prevents
// redundant token endpoint hits.
export class UpsAuth {
  private tokenCache: TokenCache | null = null;

  // Refresh 60s before actual expiry to avoid boundary failures
  private static readonly EXPIRY_BUFFER_MS = 60_000;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly baseUrl: string,
    private readonly httpClient: HttpClient
  ) {}

  async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }
    return this.fetchNewToken();
  }

  // Clear cached token. Called when a request gets a 401.
  invalidate(): void {
    this.tokenCache = null;
  }

  private async fetchNewToken(): Promise<string> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    try {
      const response = await this.httpClient.request<UpsTokenResponse>({
        method: "POST",
        url: `${this.baseUrl}/security/v1/oauth/token`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: "grant_type=client_credentials",
        rawBody: true,
      });

      if (response.status !== 200) {
        throw new CarrierError("AUTH_FAILED", "Failed to obtain UPS access token", {
          carrier: "UPS",
          statusCode: response.status,
          details: { response: response.data },
        });
      }

      const data = response.data;
      const expiresInMs = parseInt(data.expires_in, 10) * 1000;

      this.tokenCache = {
        accessToken: data.access_token,
        expiresAt: Date.now() + expiresInMs - UpsAuth.EXPIRY_BUFFER_MS,
      };

      return this.tokenCache.accessToken;
    } catch (err) {
      if (err instanceof CarrierError) throw err;

      throw new CarrierError(
        "AUTH_FAILED",
        "Unexpected error during UPS token acquisition",
        { carrier: "UPS", cause: err }
      );
    }
  }
}
