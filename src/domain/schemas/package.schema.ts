import { z } from "zod";

const positive = (field: string) =>
  z.number().positive(`${field} must be a positive number`);

export const PackageDimensionsSchema = z.object({
  length: positive("Length"),
  width: positive("Width"),
  height: positive("Height"),
  unit: z.enum(["IN", "CM"]),
});

export const PackageWeightSchema = z.object({
  value: positive("Weight"),
  unit: z.enum(["LBS", "KGS"]),
});

export const ShipmentPackageSchema = z.object({
  dimensions: PackageDimensionsSchema,
  weight: PackageWeightSchema,
  description: z.string().optional(),
  packagingType: z.string().optional(),
});
