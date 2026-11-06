import { API_BASE_URL } from "../config";

/**
 * "Get help": the request becomes one email to the support inbox, answered by
 * a normal reply. Nothing is stored, so a failure has to be shown — the page
 * then offers the address instead.
 */

export type HelpTopic = "upload" | "sign-in" | "remove" | "hymn" | "feedback" | "other";

export interface HelpRequest {
  topic: HelpTopic;
  message: string;
  email: string;
  name?: string;
  recording_ref?: string;
  page?: string;
  signed_in: boolean;
  turnstile_token: string;
}

export class HelpError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "HelpError";
    this.status = status;
  }
}

/** Sends the request; resolves to the support reference shown to the person. */
export async function sendHelpRequest(req: HelpRequest): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch {
    throw new HelpError("Couldn't reach the server. Check your connection and try again.");
  }

  if (res.status === 403) {
    throw new HelpError("Verification failed. Please complete the check and try again.", 403);
  }
  if (res.status === 429) {
    throw new HelpError("You've sent a few requests in a short time — please wait a minute, then try again.", 429);
  }
  if (res.status === 400) {
    throw new HelpError("Something in the form wasn't accepted. Please check it and try again.", 400);
  }
  if (!res.ok) {
    throw new HelpError("We couldn't send that just now.", res.status);
  }
  const body = (await res.json()) as { reference: string };
  return body.reference;
}
