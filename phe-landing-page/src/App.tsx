import { useState } from "react";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { NotifySection } from "./components/NotifySection";
import { UploadForm } from "./components/UploadForm";
import { Footer } from "./components/Footer";
// import { AudioGallery } from "./components/AudioGallery";
// import { Contact } from "./components/Contact";

export interface AudioFile {
  id: string;
  title: string;
  artist: string;
  uploadedAt: string;
  fileUrl: string;
}

export default function App() {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([
    {
      id: "1",
      title: "Summer Vibes",
      artist: "Anonymous",
      uploadedAt: "2025-11-20",
      fileUrl: "#",
    },
    {
      id: "2",
      title: "Jazz Evening",
      artist: "John M.",
      uploadedAt: "2025-11-18",
      fileUrl: "#",
    },
    {
      id: "3",
      title: "Electronic Dreams",
      artist: "Sarah K.",
      uploadedAt: "2025-11-15",
      fileUrl: "#",
    },
  ]);

  const handleUpload = (file: Omit<AudioFile, "id" | "uploadedAt">) => {
    const newFile: AudioFile = {
      ...file,
      id: Date.now().toString(),
      uploadedAt: new Date().toISOString().split("T")[0],
    };
    setAudioFiles([newFile, ...audioFiles]);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--ink)' }}>
      <Nav />
      <Hero />
      <About />
      <NotifySection />
      <UploadForm onUpload={handleUpload} />
      {/* <AudioGallery audioFiles={audioFiles} /> */}
      {/* <Contact /> */}
      <Footer />
    </div>
  );
}
