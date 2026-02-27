![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-tested-6E9F18?logo=vitest&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white)

# CyberShip Carrier Service

A carrier-agnostic shipping rate aggregation library. Send a rate request with origin, destination, and package details. Get back normalized quotes from multiple carriers through one interface.

UPS is fully implemented. Adding FedEx, USPS, or DHL requires zero changes to existing code.

## Quick Start

```bash
git clone https://github.com/harsh01369/cybership-carrier-service.git
cd cybership-carrier-service
npm install
cp .env.example .env    # Add UPS_CLIENT_ID and UPS_CLIENT_SECRET
npm test                # Run test suite (no API keys needed)
npm run demo            # Run the CLI demo
```

## Architecture

The library uses the Adapter Pattern. Each carrier implements a `Carrier` interface. `ShippingService` delegates to a `CarrierRegistry` that manages all registered carriers at runtime.

```
src/
  domain/
    models/              Address, RateQuote, RateRequest, Package, Errors
    schemas/             Zod validation schemas
  carriers/
    Carrier.ts           Carrier interface
    CarrierRegistry.ts   Runtime carrier lookup
    ups/
      UpsCarrier.ts      Implements Carrier interface
      UpsAuth.ts         OAuth 2.0 token lifecycle
      UpsMapper.ts       Domain <-> UPS API translation
      ups.types.ts       UPS-specific types (internal)
  http/
    HttpClient.ts        Fetch wrapper with timeout and error mapping
  config/
    env.ts               Environment validation
  ShippingService.ts     Entry point
  index.ts               Public exports
```

## Domain Models

**Address:** name, streetLines[], city, stateCode, postalCode, countryCode

**ShipmentPackage:** dimensions (length, width, height in IN or CM), weight (value in LBS or KGS)

**RateRequest:** origin Address, destination Address, packages[], optional serviceCode

**RateQuote:** carrier, serviceCode, serviceName, totalCost, currency, transitDays, charges breakdown

## Error Handling

Every error is a CarrierError with a machine-readable code. Callers match on the code, not on strings.

| Code | Meaning |
|------|---------|
| VALIDATION_ERROR | Input failed Zod schema |
| AUTH_FAILED | OAuth token acquisition failed |
| RATE_LIMIT | Carrier returned 429 |
| CARRIER_API_ERROR | Carrier business logic error (4xx/5xx) |
| NETWORK_ERROR | DNS failure, connection refused |
| TIMEOUT | Request exceeded deadline |
| MALFORMED_RESPONSE | Response was not valid JSON |
| CARRIER_NOT_FOUND | Carrier not registered |

## UPS Implementation

**UpsAuth:** OAuth 2.0 client credentials flow. Acquires a token, caches it in memory, tracks expiry with a 60-second buffer, and auto-refreshes before expiration.

**UpsMapper:** Translates domain RateRequest objects into UPS API payloads. Parses UPS responses back into RateQuote arrays. Handles UPS quirks like string-typed numbers.

**UpsCarrier:** Orchestrates auth, mapping, and HTTP calls behind the Carrier interface.

## Input Validation

Zod schemas validate every RateRequest before any network call fires. Catches bad addresses, missing packages, and negative weights early. Returns structured VALIDATION_ERROR instead of confusing carrier 400 responses.

## Testing

```bash
npm test           # Single run
npm run test:watch # Watch mode
```

Tests use Vitest and Nock for HTTP stubbing. No real API keys needed.

Coverage: request building, endpoint selection, response parsing, auth lifecycle, token refresh, error paths (400s, 401s, 429s, 500s, network failures, timeouts, malformed JSON), carrier registry, multi-carrier aggregation.

## Adding a New Carrier

1. Create `src/carriers/fedex/` directory.
2. Implement the Carrier interface (getRates method).
3. Create an auth handler, mapper, and types file.
4. Register in CarrierRegistry.

Zero changes to ShippingService, domain models, or any other carrier.

## Design Decisions

**Adapter pattern.** Carriers are plug-and-play. Each one owns its auth, mapping, and API logic behind a shared interface. Adding a new carrier is a self-contained change.

**Native fetch.** Node.js 18+ ships fetch. Zero HTTP client dependencies. The HttpClient wrapper adds timeout (AbortController) and consistent error mapping.

**Zod validation.** Catches bad input before expensive external API calls happen. Schemas co-locate with domain models. Runtime checks and TypeScript types stay in sync.

**Typed errors.** Every error has a code enum. Callers write switch statements on error codes instead of parsing strings or matching messages.

**Token caching with expiry buffer.** UpsAuth caches OAuth tokens and tracks their expiry with a 60-second safety margin. This avoids redundant token requests and prevents race conditions where a token expires mid-request.

## Tech Stack

| Tool | Purpose |
|------|---------|
| TypeScript (strict) | Type safety across the codebase |
| Node.js 18+ | Runtime with native fetch API |
| Zod 4 | Input validation |
| Vitest | Test runner |
| Nock | HTTP mocking |
| tsx | TypeScript execution |
