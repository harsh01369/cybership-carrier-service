// Every error carries a machine-readable code and a human-readable message.
// Callers switch on code to handle each failure without parsing strings.

export type CarrierErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_FAILED"
  | "RATE_LIMIT"
  | "CARRIER_API_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "CARRIER_NOT_FOUND"
  | "UNKNOWN";

export class CarrierError extends Error {
  public readonly code: CarrierErrorCode;
  public readonly carrier?: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: CarrierErrorCode,
    message: string,
    options?: {
      carrier?: string;
      statusCode?: number;
      details?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "CarrierError";
    this.code = code;
    this.carrier = options?.carrier;
    this.statusCode = options?.statusCode;
    this.details = options?.details;
  }
}
