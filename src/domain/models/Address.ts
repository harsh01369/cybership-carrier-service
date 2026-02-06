// Carrier-agnostic address. Each adapter maps to/from this shape.
export interface Address {
  name: string;
  streetLines: string[];
  city: string;
  stateCode: string;
  postalCode: string;
  countryCode: string; // ISO 3166-1 alpha-2
  phone?: string;
  email?: string;
}
