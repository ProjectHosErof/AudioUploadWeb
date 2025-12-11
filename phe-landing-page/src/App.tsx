import { useState } from "react";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { UploadForm } from "./components/UploadForm";
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
    <div className="min-h-screen bg-white">
      <Hero />
      <About />
      <UploadForm onUpload={handleUpload} />
      {/* <AudioGallery audioFiles={audioFiles} /> */}
      {/* <Contact /> */}
    </div>
  );
}
