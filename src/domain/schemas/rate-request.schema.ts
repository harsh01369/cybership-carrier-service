import { z } from "zod";
import { AddressSchema } from "./address.schema.js";
import { ShipmentPackageSchema } from "./package.schema.js";

export const RateRequestSchema = z.object({
  origin: AddressSchema,
  destination: AddressSchema,
  packages: z
    .array(ShipmentPackageSchema)
    .min(1, "At least one package is required"),
  serviceCode: z.string().optional(),
});
