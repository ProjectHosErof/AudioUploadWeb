import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { CounterSection } from "./components/CounterSection";
import { NotifySection } from "./components/NotifySection";
import { UploadForm } from "./components/UploadForm";
import { Footer } from "./components/Footer";
import { LoginPage } from "./components/LoginPage";
import { DashboardPage } from "./components/DashboardPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
// import { AudioGallery } from "./components/AudioGallery";
// import { Contact } from "./components/Contact";

export interface AudioFile {
  id: string;
  title: string;
  artist: string;
  uploadedAt: string;
  fileUrl: string;
}

function LandingPage() {
  const [, setAudioFiles] = useState<AudioFile[]>([]);

  const handleUpload = (file: Omit<AudioFile, "id" | "uploadedAt">) => {
    const newFile: AudioFile = {
      ...file,
      id: Date.now().toString(),
      uploadedAt: new Date().toISOString().split("T")[0],
    };
    setAudioFiles((prev) => [newFile, ...prev]);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--ink)" }}>
      <Nav />
      <Hero />
      <About />
      <CounterSection />
      <NotifySection />
      <UploadForm onUpload={handleUpload} />
      {/* <AudioGallery audioFiles={audioFiles} /> */}
      {/* <Contact /> */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      {/* Unknown paths fall back to the landing page. */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
