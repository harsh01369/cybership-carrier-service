import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Validates required environment variables at startup.
// Fails fast on bad config so we never start with missing values.
const EnvSchema = z.object({
  // UPS credentials
  UPS_CLIENT_ID: z.string().min(1, "UPS_CLIENT_ID is required"),
  UPS_CLIENT_SECRET: z.string().min(1, "UPS_CLIENT_SECRET is required"),
  UPS_ACCOUNT_NUMBER: z.string().min(1, "UPS_ACCOUNT_NUMBER is required"),
  UPS_BASE_URL: z
    .string()
    .url()
    .default("https://onlinetools.ups.com"),

  // General
  REQUEST_TIMEOUT_MS: z.coerce.number().positive().default(10_000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getConfig(): Env {
  if (cached) return cached;

  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${formatted}`);
  }

  cached = result.data;
  return cached;
}

// For testing: inject env overrides without polluting process.env.
export function getConfigFromValues(overrides: Record<string, string>): Env {
  const result = EnvSchema.parse(overrides);
  return result;
}
