import type { RateRequest, RateQuote, ChargeBreakdown } from "../../domain/models/index.js";
import type {
  UpsRateRequest,
  UpsRateResponse,
  UpsRatedShipment,
  UpsPackage,
} from "./ups.types.js";
import { UPS_SERVICE_CODES } from "./ups.types.js";

// Translates between domain models and UPS API shapes.
// Only file that knows UPS JSON structure. If UPS changes
// their format, only this file changes.
export class UpsMapper {
  constructor(private readonly accountNumber: string) {}

  toUpsRateRequest(req: RateRequest): UpsRateRequest {
    const packages: UpsPackage[] = req.packages.map((pkg) => ({
      PackagingType: {
        Code: pkg.packagingType ?? "02", // 02 = Customer Supplied Package
        Description: "Package",
      },
      Dimensions: {
        UnitOfMeasurement: {
          Code: pkg.dimensions.unit,
          Description: pkg.dimensions.unit === "IN" ? "Inches" : "Centimeters",
        },
        Length: String(pkg.dimensions.length),
        Width: String(pkg.dimensions.width),
        Height: String(pkg.dimensions.height),
      },
      PackageWeight: {
        UnitOfMeasurement: {
          Code: pkg.weight.unit,
          Description: pkg.weight.unit === "LBS" ? "Pounds" : "Kilograms",
        },
        Weight: String(pkg.weight.value),
      },
    }));

    const upsRequest: UpsRateRequest = {
      RateRequest: {
        Request: {
          TransactionReference: {
            CustomerContext: "Cybership Rate Request",
          },
        },
        Shipment: {
          Shipper: {
            Name: req.origin.name,
            ShipperNumber: this.accountNumber,
            Address: {
              AddressLine: req.origin.streetLines,
              City: req.origin.city,
              StateProvinceCode: req.origin.stateCode,
              PostalCode: req.origin.postalCode,
              CountryCode: req.origin.countryCode,
            },
          },
          ShipTo: {
            Name: req.destination.name,
            Address: {
              AddressLine: req.destination.streetLines,
              City: req.destination.city,
              StateProvinceCode: req.destination.stateCode,
              PostalCode: req.destination.postalCode,
              CountryCode: req.destination.countryCode,
            },
          },
          ShipFrom: {
            Name: req.origin.name,
            Address: {
              AddressLine: req.origin.streetLines,
              City: req.origin.city,
              StateProvinceCode: req.origin.stateCode,
              PostalCode: req.origin.postalCode,
              CountryCode: req.origin.countryCode,
            },
          },
          Package: packages,
        },
      },
    };

    // When a specific service is requested, include it.
    // When omitted, UPS returns all available services (rate shop).
    if (req.serviceCode) {
      upsRequest.RateRequest.Shipment.Service = {
        Code: req.serviceCode,
        Description: UPS_SERVICE_CODES[req.serviceCode] ?? "Unknown",
      };
    }

    return upsRequest;
  }

  fromUpsRateResponse(upsResponse: UpsRateResponse): RateQuote[] {
    const rated = upsResponse.RateResponse.RatedShipment;

    // UPS returns a single object for one-service requests,
    // an array for rate shopping. Normalize to always be an array.
    const shipments: UpsRatedShipment[] = Array.isArray(rated)
      ? rated
      : [rated];

    return shipments.map((shipment) => this.mapRatedShipment(shipment));
  }

  private mapRatedShipment(shipment: UpsRatedShipment): RateQuote {
    const serviceCode = shipment.Service.Code;
    const serviceName =
      UPS_SERVICE_CODES[serviceCode] ??
      shipment.Service.Description ??
      `UPS Service ${serviceCode}`;

    // Negotiated rates reflect actual account pricing
    const totalCharges =
      shipment.NegotiatedRateCharges?.TotalCharge ?? shipment.TotalCharges;

    const charges: ChargeBreakdown[] = [
      {
        description: "Transportation",
        amount: parseFloat(shipment.TransportationCharges.MonetaryValue),
        currency: shipment.TransportationCharges.CurrencyCode,
      },
      {
        description: "Service Options",
        amount: parseFloat(shipment.ServiceOptionsCharges.MonetaryValue),
        currency: shipment.ServiceOptionsCharges.CurrencyCode,
      },
    ];

    return {
      carrier: "UPS",
      serviceCode,
      serviceName,
      totalCost: parseFloat(totalCharges.MonetaryValue),
      currency: totalCharges.CurrencyCode,
      transitDays: shipment.GuaranteedDelivery
        ? parseInt(shipment.GuaranteedDelivery.BusinessDaysInTransit, 10)
        : undefined,
      guaranteedDelivery: !!shipment.GuaranteedDelivery,
      charges,
    };
  }
}
