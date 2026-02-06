import { z } from "zod";

export const AddressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  streetLines: z
    .array(z.string().min(1))
    .min(1, "At least one street line is required")
    .max(3, "Maximum 3 street lines"),
  city: z.string().min(1, "City is required"),
  stateCode: z
    .string()
    .min(2, "State code must be at least 2 characters")
    .max(3),
  postalCode: z.string().min(1, "Postal code is required"),
  countryCode: z
    .string()
    .length(2, "Country code must be ISO 3166-1 alpha-2 (2 chars)"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
});
