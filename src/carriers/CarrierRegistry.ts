import { CarrierError } from "../domain/models/Errors.js";
import type { Carrier } from "./Carrier.js";

// Stores carrier adapters by code. The service layer looks
// up carriers here without knowing the concrete implementations.
export class CarrierRegistry {
  private carriers = new Map<string, Carrier>();

  register(carrier: Carrier): void {
    this.carriers.set(carrier.code, carrier);
  }

  get(code: string): Carrier {
    const carrier = this.carriers.get(code);
    if (!carrier) {
      throw new CarrierError("CARRIER_NOT_FOUND", `No carrier registered for code "${code}"`);
    }
    return carrier;
  }

  list(): Carrier[] {
    return Array.from(this.carriers.values());
  }
}
