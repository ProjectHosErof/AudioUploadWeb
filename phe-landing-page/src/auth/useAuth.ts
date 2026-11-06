import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

/**
 * The auth context and its hook live apart from <AuthProvider> so that file
 * exports only a component (React Fast Refresh requires it).
 */

export interface AuthContextValue {
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

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
