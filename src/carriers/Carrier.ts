import type { RateRequest, RateQuote } from "../domain/models/index.js";

// Every carrier (UPS, FedEx, USPS, DHL) implements this interface.
// The service layer works through this contract. It never imports
// carrier-specific code.
export interface Carrier {
  readonly name: string;
  readonly code: string;

  getRates(request: RateRequest): Promise<RateQuote[]>;

  // TODO: label purchase
  // purchaseLabel(request: LabelRequest): Promise<Label>;

  // TODO: tracking lookup
  // getTracking(trackingNumber: string): Promise<TrackingEvent[]>;

  // TODO: address validation
  // validateAddress(address: Address): Promise<AddressValidationResult>;
}
