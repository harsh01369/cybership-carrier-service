// Normalized rate quote returned by any carrier adapter.
export interface RateQuote {
  carrier: string;
  serviceCode: string;
  serviceName: string;
  totalCost: number;
  currency: string;
  transitDays?: number;
  guaranteedDelivery: boolean;
  // Base rate vs surcharges breakdown, when the carrier provides it.
  charges?: ChargeBreakdown[];
}

export interface ChargeBreakdown {
  description: string;
  amount: number;
  currency: string;
}
