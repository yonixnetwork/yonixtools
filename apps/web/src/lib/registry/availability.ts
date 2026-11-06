import { backendConfigured } from "../site";

/** Client-safe availability check (doesn't pull the registry content into bundles). */
export const isAvailable = (t: { status: string }) => t.status === "live" || backendConfigured;
