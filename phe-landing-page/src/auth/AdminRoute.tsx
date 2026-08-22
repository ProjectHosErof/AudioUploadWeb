import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * Gate for the moderation queue. Signed-out users go to /login; signed-in
 * non-admins go to their own dashboard rather than to a refusal page — from
 * their side the queue simply isn't part of the app.
 *
 * This is a routing convenience, not a security boundary: the Worker checks
 * admin membership on every request it serves.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { session, loading, isAdmin, adminLoading } = useAuth();
  const location = useLocation();

  if (loading || (session && adminLoading)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-ui)",
          fontSize: "0.75rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--gold-muted)",
        }}
      >
        Opening the codex…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
