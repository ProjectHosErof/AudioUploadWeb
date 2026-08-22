import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { AUTH_ENABLED, API_BASE_URL } from "../config";
import { fetchIsAdmin } from "../services/moderation";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup settles — guards protected routes from flashing. */
  loading: boolean;
  /** False when Supabase env vars are absent; the UI degrades instead of crashing. */
  enabled: boolean;
  /**
   * Whether this user may moderate. Presentation only — it decides whether the
   * queue is *offered*. The Worker re-checks on every admin request, so a
   * tampered value here buys nothing but a 403.
   */
  isAdmin: boolean;
  /** True until the admin check settles, so AdminRoute doesn't bounce prematurely. */
  adminLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Tell the Worker this user just signed in: it creates the `contributors` row
 * and claims any prior anonymous uploads sharing their verified email address.
 * Best-effort — a failure here must never block sign-in, so it only logs.
 */
async function linkContributor(accessToken: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/me/link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("contributor link failed", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("contributor link request failed", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(AUTH_ENABLED);
  const [isAdmin, setIsAdmin] = useState(false);
  // Which user the isAdmin value describes. Deriving "still checking" from this
  // rather than from a separate boolean avoids a race: a plain flag is only set
  // inside an effect, so the first render after sign-in would briefly claim the
  // check had finished and report a false negative — enough for AdminRoute to
  // bounce a real admin to the dashboard.
  const [adminCheckedFor, setAdminCheckedFor] = useState<string | null>(null);
  // Link once per user per page-load; token refreshes also fire auth events.
  const linkedUserIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);

      const userId = nextSession?.user?.id;
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        userId &&
        nextSession?.access_token &&
        !linkedUserIds.current.has(userId)
      ) {
        linkedUserIds.current.add(userId);
        void linkContributor(nextSession.access_token);
      }
      if (event === "SIGNED_OUT") {
        linkedUserIds.current.clear();
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Ask the Worker whether this user may moderate. Re-runs when the identity
  // changes, not on every token refresh, since admin membership doesn't change
  // mid-session; a revoked admin is stopped by the Worker's 403 regardless.
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  useEffect(() => {
    if (!userId || !accessToken) {
      setIsAdmin(false);
      setAdminCheckedFor(null);
      return;
    }
    let active = true;
    fetchIsAdmin(accessToken)
      .then((result) => { if (active) setIsAdmin(result); })
      .catch(() => { if (active) setIsAdmin(false); })
      .finally(() => { if (active) setAdminCheckedFor(userId); });
    return () => { active = false; };
    // Keyed on the user, not the token: a refresh issues a new token but doesn't
    // change who they are, and re-checking on every refresh is pointless churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Still checking whenever we have a user whose answer hasn't landed yet.
  const adminLoading = Boolean(userId) && adminCheckedFor !== userId;

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error("Sign-in is not configured yet.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw error;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Sign-in is not configured yet.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        enabled: AUTH_ENABLED,
        isAdmin,
        adminLoading,
        signInWithGoogle,
        signInWithMagicLink,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
