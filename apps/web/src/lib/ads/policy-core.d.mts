export type ProviderReason = "policy_missing" | "policy_invalid" | "provider_unverified" | "evidence_missing" | "category_unconfirmed" | "ok";
export type CountryReason = Exclude<ProviderReason, "ok"> | "country_unknown" | "country_suppressed" | "eligible";

export function validatePolicy(p: unknown): string[];
export function providerStatus(p: unknown): { ok: boolean; reason: ProviderReason; detail?: string };
export function countryDecision(p: unknown, country: string | null): { eligible: boolean; reason: CountryReason };
export const OVERRIDE_TEST_VERIFIED: "test-verified";
export function resolveOverride(env: { override?: string; siteUrl?: string; adOrigin?: string }): boolean;
