import type { TranslationType } from "@/core/results/kinds";
import { RequestError } from "@/shared/errors";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function invalidResponse(type: TranslationType): RequestError {
  return new RequestError(type, "Invalid translation response", "INVALID_RESPONSE");
}
