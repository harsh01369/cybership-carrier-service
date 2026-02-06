# Cybership Carrier Integration Service

Shipping carrier integration layer for rate shopping. UPS is the first supported carrier. Adding FedEx, USPS, or DHL requires zero changes to existing code.

## Quick Start

```bash
npm install
cp .env.example .env        # fill in your UPS credentials
npm test                     # run the full test suite (no API key needed)
npm run demo                 # run the CLI demo
npm run build                # compile TypeScript
```

## Architecture

### Carrier-agnostic domain

All domain models (RateRequest, RateQuote, Address, ShipmentPackage) live in `src/domain/` and are shared across every carrier. Callers interact with ShippingService and get back normalized objects. They never import carrier-specific code.

### Adapter pattern for carriers

Each carrier lives in its own folder under `src/carriers/` and implements the Carrier interface:

```
src/carriers/
├── Carrier.ts            # interface every carrier implements
├── CarrierRegistry.ts    # runtime carrier lookup by code
└── ups/
    ├── UpsCarrier.ts     # adapter: orchestrates auth, mapping, HTTP
    ├── UpsAuth.ts        # OAuth 2.0 token lifecycle
    ├── UpsMapper.ts      # domain to UPS payload translation
    └── ups.types.ts      # UPS-specific API types (internal only)
```

To add FedEx, create `src/carriers/fedex/` with the same structure and register it in the CarrierRegistry. Existing code stays untouched.

### Auth is invisible to callers

UpsAuth handles the full OAuth client-credentials flow: token acquisition, in-memory caching, expiry tracking with a 60-second safety buffer, and automatic re-fetch. UpsCarrier calls `auth.getToken()` before each request. Callers never deal with auth.

If a rate request gets a 401 back, the adapter invalidates the cached token so the next call gets a fresh one.

### Validation before external calls

Every RateRequest goes through Zod schemas before any network call. This catches bad input early (invalid addresses, missing packages, negative weights) and returns a structured VALIDATION_ERROR instead of a confusing 400 from the carrier.

## Error Handling

All errors are CarrierError instances with a machine-readable code:

| Code | Meaning |
|------|---------|
| VALIDATION_ERROR | Input failed schema validation |
| AUTH_FAILED | Token acquisition or refresh failed |
| RATE_LIMIT | Carrier returned 429 |
| CARRIER_API_ERROR | Carrier returned a business-logic error (4xx/5xx) |
| NETWORK_ERROR | DNS, connection refused, etc. |
| TIMEOUT | Request exceeded the configured deadline |
| MALFORMED_RESPONSE | Response body was not valid JSON |
| CARRIER_NOT_FOUND | Requested carrier is not registered |

Each CarrierError also carries optional carrier, statusCode, and details fields for diagnostics.

## Tests

The test suite stubs the HTTP layer with nock and feeds it realistic UPS payloads. No API key needed.

```bash
npm test              # single run
npm run test:watch    # watch mode
```

What the tests cover:

- Request building: verifies domain models translate correctly to UPS payload format
- Endpoint selection: Shop for rate shopping, Rate for a specific service
- Response parsing: single-service, multi-service, and negotiated rate responses
- Auth lifecycle: token acquisition, caching/reuse, expiry-driven refresh, invalidation after 401
- Error paths: 400s, 401s, 429s, 500s, network failures, timeouts, malformed JSON
- Service layer: carrier registry, carrier-not-found, multi-carrier aggregation

## Design Decisions

Zod over manual validation. External APIs and callers send unexpected data. Zod gives co-located schemas with automatic TypeScript type inference. Compile-time types and runtime checks stay in sync.

Separate mapper layer. UPS sends everything as strings ("12.35" instead of 12.35, dimensions as string fields). The mapper is the only place that deals with these quirks. If UPS changes their response format, one file changes.

Native fetch over axios. Node 18+ ships with fetch. One less dependency. The HttpClient wrapper adds timeout handling and consistent error mapping, which covers what we need.

No retry logic (for now). Retries with exponential backoff matter in production. They add complexity outside the scope of this assessment. The HttpClient is the right place to add them. A single change there gives retries to every carrier.

## What I Would Improve With More Time

- Retry with exponential backoff in HttpClient so every carrier benefits automatically
- Label purchase and tracking using the same adapter pattern (Carrier interface has placeholder methods)
- Circuit breaker to stop calling a carrier that is consistently failing
- Structured request/response logging with correlation IDs for production debugging
- Rate response caching with a short TTL to reduce API calls
- Concurrent token refresh guard so only one request fetches a new token while others wait

## Project Structure

```
src/
├── domain/
│   ├── models/          # carrier-agnostic types (Address, RateQuote, etc.)
│   └── schemas/         # Zod validation schemas
├── carriers/
│   ├── Carrier.ts       # interface + registry
│   └── ups/             # UPS adapter
├── http/
│   └── HttpClient.ts    # fetch wrapper with timeout + error mapping
├── config/
│   └── env.ts           # env validation (fails fast on bad config)
├── ShippingService.ts   # entry point
└── index.ts             # public API exports

tests/
├── fixtures/            # realistic UPS response payloads
└── integration/         # end-to-end tests with stubbed HTTP
```
