import { API_BASE_URL } from "../config";

/**
 * The "Stay Informed" mailing list.
 *
 * Signing up is double opt-in: this call creates an unconfirmed record and
 * triggers a confirmation email. Nobody is mailable until they follow the link
 * in it, so the success copy must say "check your email", never "you're on the
 * list".
 */

export class SubscribeError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "SubscribeError";
    this.status = status;
  }
}

export async function subscribeEmail(email: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new SubscribeError("Couldn't reach the server. Check your connection and try again.");
  }

  if (res.status === 429) {
    throw new SubscribeError("Too many attempts. Please wait a moment and try again.", 429);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new SubscribeError(body?.error ?? "Couldn't sign you up just now. Please try again.", res.status);
  }

  const body = (await res.json()) as { message?: string };
  return body.message ?? "Check your email to confirm your subscription.";
}
