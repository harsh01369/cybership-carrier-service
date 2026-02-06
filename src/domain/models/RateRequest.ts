import type { Address } from "./Address.js";
import type { ShipmentPackage } from "./Package.js";

export interface RateRequest {
  origin: Address;
  destination: Address;
  packages: ShipmentPackage[];
  // When set, fetch a rate for this service only.
  // When omitted, return all available services (rate shop).
  serviceCode?: string;
}
