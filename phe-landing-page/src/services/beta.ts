import { API_BASE_URL } from "../config";

/**
 * Joining the beta. Double opt-in, as the mailing list: this sends a
 * confirmation email, and the request reaches us only once it's followed. The
 * answer is the same whether or not the address has applied before.
 */

export type BetaDevice = "iphone" | "android" | "tablet" | "computer";
export type BetaRole = "chanter" | "choir" | "parishioner" | "servant" | "other";
export type BetaAge = "under-25" | "25-44" | "45-64" | "65-plus";

export interface BetaApplication {
  name: string;
  email: string;
  parish?: string;
  device: BetaDevice;
  role?: BetaRole;
  age_range?: BetaAge;
  consent: true;
  turnstile_token: string;
}

export class BetaError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "BetaError";
    this.status = status;
  }
}

export async function applyForBeta(application: BetaApplication): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/beta/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(application),
    });
  } catch {
    throw new BetaError("Couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 403) throw new BetaError("Verification failed. Please complete the check and try again.", 403);
  if (res.status === 429) throw new BetaError("Too many tries in a short time — please wait a minute, then try again.", 429);
  if (res.status === 400) throw new BetaError("Something in the form wasn't accepted. Please check it and try again.", 400);
  if (!res.ok) throw new BetaError("We couldn't send your request just now. Please try again in a moment.", res.status);
}
