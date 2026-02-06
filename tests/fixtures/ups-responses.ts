// UPS API response fixtures based on UPS Rating API documentation.
// Used to stub the HTTP layer in integration tests.

import type { UpsTokenResponse, UpsRateResponse, UpsErrorResponse } from "../../src/carriers/ups/ups.types.js";

// Auth Fixtures

export const validTokenResponse: UpsTokenResponse = {
  access_token: "eyJhbGciOiJSUzM4NCIsInR5cCI6IkpXVCJ9.mock-token-payload",
  token_type: "Bearer",
  issued_at: "1704067200000",
  client_id: "test-client-id",
  expires_in: "14399", // ~4 hours, matches real UPS behavior
  status: "approved",
};

export const expiredTokenResponse: UpsTokenResponse = {
  ...validTokenResponse,
  access_token: "eyJhbGciOiJSUzM4NCIsInR5cCI6IkpXVCJ9.expired-token",
  expires_in: "1", // expires almost immediately
};

// Rate Response Fixtures

export const singleRateResponse: UpsRateResponse = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: "1",
        Description: "Success",
      },
      TransactionReference: {
        CustomerContext: "Cybership Rate Request",
      },
    },
    RatedShipment: {
      Service: {
        Code: "03",
        Description: "UPS Ground",
      },
      BillingWeight: {
        UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
        Weight: "5.0",
      },
      TransportationCharges: {
        CurrencyCode: "USD",
        MonetaryValue: "12.35",
      },
      ServiceOptionsCharges: {
        CurrencyCode: "USD",
        MonetaryValue: "0.00",
      },
      TotalCharges: {
        CurrencyCode: "USD",
        MonetaryValue: "12.35",
      },
      GuaranteedDelivery: {
        BusinessDaysInTransit: "5",
      },
    },
  },
};

export const shopRateResponse: UpsRateResponse = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: "1",
        Description: "Success",
      },
      Alert: [
        {
          Code: "110971",
          Description: "Your invoice may vary from the displayed reference rates",
        },
      ],
    },
    RatedShipment: [
      {
        Service: { Code: "03", Description: "UPS Ground" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "12.35" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "12.35" },
        GuaranteedDelivery: { BusinessDaysInTransit: "5" },
      },
      {
        Service: { Code: "02", Description: "UPS 2nd Day Air" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "24.50" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "24.50" },
        GuaranteedDelivery: {
          BusinessDaysInTransit: "2",
          DeliveryByTime: "11:30 P.M.",
        },
      },
      {
        Service: { Code: "01", Description: "UPS Next Day Air" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "45.80" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "2.50" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "48.30" },
        GuaranteedDelivery: {
          BusinessDaysInTransit: "1",
          DeliveryByTime: "10:30 A.M.",
        },
      },
    ],
  },
};

export const negotiatedRateResponse: UpsRateResponse = {
  RateResponse: {
    Response: {
      ResponseStatus: { Code: "1", Description: "Success" },
    },
    RatedShipment: {
      Service: { Code: "03", Description: "UPS Ground" },
      BillingWeight: {
        UnitOfMeasurement: { Code: "LBS" },
        Weight: "5.0",
      },
      TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "12.35" },
      ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
      TotalCharges: { CurrencyCode: "USD", MonetaryValue: "12.35" },
      NegotiatedRateCharges: {
        TotalCharge: { CurrencyCode: "USD", MonetaryValue: "9.99" },
      },
    },
  },
};

// Error Response Fixtures

export const invalidAddressError: UpsErrorResponse = {
  response: {
    errors: [
      {
        code: "111210",
        message: "The requested service is unavailable between the selected locations.",
      },
    ],
  },
};

export const authFailedError = {
  response: {
    errors: [
      {
        code: "250003",
        message: "Invalid Access License number",
      },
    ],
  },
};

export const rateLimitError = {
  response: {
    errors: [
      {
        code: "429",
        message: "Rate limit exceeded. Please retry after some time.",
      },
    ],
  },
};

// Test Helpers

export const sampleRateRequest = {
  origin: {
    name: "Cybership Warehouse",
    streetLines: ["123 Sender St"],
    city: "Atlanta",
    stateCode: "GA",
    postalCode: "30301",
    countryCode: "US",
  },
  destination: {
    name: "John Doe",
    streetLines: ["456 Receiver Ave", "Suite 100"],
    city: "New York",
    stateCode: "NY",
    postalCode: "10001",
    countryCode: "US",
  },
  packages: [
    {
      dimensions: { length: 12, width: 8, height: 6, unit: "IN" as const },
      weight: { value: 5, unit: "LBS" as const },
    },
  ],
};
