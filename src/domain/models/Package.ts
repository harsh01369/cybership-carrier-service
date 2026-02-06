// Carrier-agnostic package definition.
// The mapper handles any unit conversion a carrier needs.
export interface PackageDimensions {
  length: number;
  width: number;
  height: number;
  unit: "IN" | "CM";
}

export interface PackageWeight {
  value: number;
  unit: "LBS" | "KGS";
}

export interface ShipmentPackage {
  dimensions: PackageDimensions;
  weight: PackageWeight;
  description?: string;
  // Carrier-specific packaging type code. Defaults to customer-supplied.
  packagingType?: string;
}
