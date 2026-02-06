// Public API surface.

// Service
export { ShippingService } from "./ShippingService.js";

// Carrier abstractions
export type { Carrier } from "./carriers/Carrier.js";
export { CarrierRegistry } from "./carriers/CarrierRegistry.js";

// UPS adapter
export { UpsCarrier } from "./carriers/ups/index.js";
export type { UpsCarrierConfig } from "./carriers/ups/index.js";

// Domain models
export type {
  Address,
  PackageDimensions,
  PackageWeight,
  ShipmentPackage,
  RateRequest,
  RateQuote,
  ChargeBreakdown,
  CarrierErrorCode,
} from "./domain/models/index.js";
export { CarrierError } from "./domain/models/index.js";

// Validation schemas
export {
  AddressSchema,
  PackageDimensionsSchema,
  PackageWeightSchema,
  ShipmentPackageSchema,
  RateRequestSchema,
} from "./domain/schemas/index.js";

// Config
export { getConfig } from "./config/env.js";
