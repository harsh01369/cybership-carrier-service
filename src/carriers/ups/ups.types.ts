// UPS Rating API types. Internal to the UPS adapter.
// Ref: https://developer.ups.com/api/reference/rating/api/Rate

// OAuth

export interface UpsTokenResponse {
  access_token: string;
  token_type: string;
  issued_at: string;
  client_id: string;
  expires_in: string; // UPS returns this as a string (seconds)
  status: string;
}

// Rating Request

export interface UpsRateRequest {
  RateRequest: {
    Request: {
      TransactionReference?: {
        CustomerContext?: string;
      };
    };
    Shipment: {
      Shipper: UpsShipper;
      ShipTo: UpsShipTo;
      ShipFrom: UpsShipFrom;
      Service?: {
        Code: string;
        Description?: string;
      };
      Package: UpsPackage[];
      ShipmentRatingOptions?: {
        NegotiatedRatesIndicator?: string;
      };
    };
  };
}

export interface UpsShipper {
  Name: string;
  ShipperNumber: string;
  Address: UpsAddress;
}

export interface UpsShipTo {
  Name: string;
  Address: UpsAddress;
}

export interface UpsShipFrom {
  Name: string;
  Address: UpsAddress;
}

export interface UpsAddress {
  AddressLine: string[];
  City: string;
  StateProvinceCode: string;
  PostalCode: string;
  CountryCode: string;
}

export interface UpsPackage {
  PackagingType: {
    Code: string;
    Description?: string;
  };
  Dimensions: {
    UnitOfMeasurement: { Code: string; Description?: string };
    Length: string;
    Width: string;
    Height: string;
  };
  PackageWeight: {
    UnitOfMeasurement: { Code: string; Description?: string };
    Weight: string;
  };
}

// Rating Response

export interface UpsRateResponse {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: string;
        Description: string;
      };
      Alert?: UpsAlert[];
      TransactionReference?: {
        CustomerContext?: string;
      };
    };
    RatedShipment: UpsRatedShipment | UpsRatedShipment[];
  };
}

export interface UpsRatedShipment {
  Service: {
    Code: string;
    Description?: string;
  };
  RatedShipmentAlert?: UpsAlert[];
  BillingWeight: {
    UnitOfMeasurement: { Code: string; Description?: string };
    Weight: string;
  };
  TransportationCharges: UpsCharge;
  ServiceOptionsCharges: UpsCharge;
  TotalCharges: UpsCharge;
  GuaranteedDelivery?: {
    BusinessDaysInTransit: string;
    DeliveryByTime?: string;
  };
  NegotiatedRateCharges?: {
    TotalCharge: UpsCharge;
  };
}

export interface UpsCharge {
  CurrencyCode: string;
  MonetaryValue: string;
}

export interface UpsAlert {
  Code: string;
  Description: string;
}

// Error Response

export interface UpsErrorResponse {
  response: {
    errors: UpsApiError[];
  };
}

export interface UpsApiError {
  code: string;
  message: string;
}

// Service Code Lookup

export const UPS_SERVICE_CODES: Record<string, string> = {
  "01": "UPS Next Day Air",
  "02": "UPS 2nd Day Air",
  "03": "UPS Ground",
  "07": "UPS Express",
  "08": "UPS Expedited",
  "11": "UPS Standard",
  "12": "UPS 3 Day Select",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early",
  "54": "UPS Express Plus",
  "59": "UPS 2nd Day Air A.M.",
  "65": "UPS Saver",
};
