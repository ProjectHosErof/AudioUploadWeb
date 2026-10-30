import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { HowItWorks } from "./components/HowItWorks";
import { Faq } from "./components/Faq";
import { NotifySection } from "./components/NotifySection";
import { Footer } from "./components/Footer";
import { SubscriptionResultPage } from "./components/SubscriptionResultPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AdminRoute } from "./auth/AdminRoute";

// Pages most visitors never open — sign-in, the contributor dashboard, the
// review queue and the legal text (which pulls in a Markdown parser) — load
// on demand, keeping the landing page's bundle small.
const LoginPage = lazy(() => import("./components/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("./components/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const AdminPage = lazy(() => import("./components/AdminPage").then((m) => ({ default: m.AdminPage })));
const LegalPage = lazy(() => import("./components/LegalPage"));
// The upload form brings react-select and the full hymn catalogue (~290 KB of
// JSON). It sits at the bottom of the page, so load it after first paint.
const UploadForm = lazy(() => import("./components/UploadForm").then((m) => ({ default: m.UploadForm })));

/** A blank page in the site's background colour while a lazy page loads. */
function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--ink)" }} />}>
      {children}
    </Suspense>
  );
}

function LandingPage() {
  const { hash } = useLocation();

  // Arriving from another route (e.g. the dashboard's "Upload New Recording")
  // only changes history state, so the browser won't scroll to the anchor
  // itself — do it once the section has rendered.
  useEffect(() => {
    if (!hash) return;
    const target = document.querySelector(hash);
    if (target) target.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--ink)" }}>
      <Nav />
      <main id="main">
        {/* Ordered around the one action we want: understand it, then do it.
            Background (FAQ, About) and the fallback for people without a
            recording yet (Stay informed) come after the form. */}
        <Hero />
        <HowItWorks />
        {/* The placeholder keeps the #upload anchor (nav, hero button, the
            dashboard's "Upload New Recording") working while the form loads. */}
        <Suspense fallback={<section id="upload" style={{ minHeight: "100vh", backgroundColor: "var(--ink)" }} />}>
          <UploadForm />
        </Suspense>
        <Faq />
        <About />
        <NotifySection />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Loading><LoginPage /></Loading>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Loading><DashboardPage /></Loading>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Loading><AdminPage /></Loading>
          </AdminRoute>
        }
      />
      {/* Where the confirm / unsubscribe links in an email land. */}
      <Route path="/subscribed" element={<SubscriptionResultPage variant="confirmed" />} />
      <Route path="/unsubscribed" element={<SubscriptionResultPage variant="unsubscribed" />} />
      <Route path="/privacy" element={<Loading><LegalPage doc="privacy" /></Loading>} />
      <Route path="/terms" element={<Loading><LegalPage doc="terms" /></Loading>} />
      <Route path="/dmca" element={<Loading><LegalPage doc="dmca" /></Loading>} />
      {/* Unknown paths fall back to the landing page. */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
