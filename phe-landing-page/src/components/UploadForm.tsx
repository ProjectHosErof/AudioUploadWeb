import { useState } from "react";
import { Upload, Music } from "lucide-react";
import type { AudioFile } from "../App";
import Select, { type MultiValue, type SingleValue } from "react-select";
import {
  hymn_options,
  language_options,
  service_options,
  season_options,
} from "../options.data";
import type { SelectOption } from "../options.data";

interface UploadFormProps {
  onUpload: (file: Omit<AudioFile, "id" | "uploadedAt">) => void;
}

export function UploadForm({ onUpload }: UploadFormProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedService, setSelectedService] = useState<SelectOption | null>(
    null
  );
  const [selectedSeason, setSelectedSeason] = useState<SelectOption | null>(
    null
  );
  const [selectedHymn, setSelectedHymn] = useState<SelectOption | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<
    readonly SelectOption[]
  >([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || selectedLanguage.length === 0 || !file) {
      alert(
        "Please select a hymn title, at least one language, and an audio file"
      );
      return;
    }

    setIsSubmitting(true);

    // Simulate upload delay
    setTimeout(() => {
      onUpload({
        title,
        artist,
        fileUrl: URL.createObjectURL(file),
      });

      // Reset form
      setTitle("");
      setArtist("");
      setSelectedService(null);
      setSelectedSeason(null);
      setSelectedHymn(null);
      setSelectedLanguage([]);
      setFile(null);
      setIsSubmitting(false);

      alert("Thank you for your submission!");
    }, 1000);
  };

  return (
    <section id="upload" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="mb-4">
            <strong>Upload Your Recording</strong>
          </h2>
          <p className="text-gray-600">
            Share your hymns and sacred music with us. We are looking for
            recordings from:
            <br />
            <ul className="inline-list">
              <br />
              <li>St. Basil/St. Gregory/St. Cyril Divine Liturgy</li>
              <li>
                (Offering of Lamb, Liturgy of Word, Liturgy of Faithful,
                Distribution)
              </li>
              <li>Matins & Vespers</li>
              <li>Vesper Praises</li>
              <li>Morning & Midnight Praises</li>
              <li>Melodies</li>
              <li>Ceremonies (Baptism, Crowning, Ordination, etc.)</li>
              <li>Venerations</li>
              <li>...and more!</li>
              <br />
            </ul>
            We are looking for hymns & responses across different feasts,
            seasons, & different tunes. Please select the hymn/response and the
            season/tune of the audio file you are uploading. If you’re not sure,
            feel free to ask a servant, deacon, or clergy member for
            help—they’re always happy to guide you. And if it’s still unclear,
            you can choose “Unknown” or reach out to us!
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 rounded-xl p-8 border border-gray-200"
        >
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="service" className="block mb-2 text-gray-700">
                Service *
              </label>
              <Select<SelectOption>
                options={service_options}
                value={selectedService}
                onChange={(option: SingleValue<SelectOption>) => {
                  setSelectedService(option);
                }}
                placeholder="Select service"
                isClearable
              />
            </div>

            <div className="flex-1">
              <label htmlFor="season" className="block mb-2 text-gray-700">
                Season *
              </label>
              <Select<SelectOption>
                options={season_options}
                value={selectedSeason}
                onChange={(option: SingleValue<SelectOption>) => {
                  setSelectedSeason(option);
                }}
                placeholder="Select season"
                isClearable
              />
            </div>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="title" className="block mb-2 text-gray-700">
                Hymn/Response Title *
              </label>
              <Select<SelectOption>
                options={hymn_options}
                value={selectedHymn}
                onChange={(option: SingleValue<SelectOption>) => {
                  setSelectedHymn(option);
                  setTitle(option?.label ?? "");
                }}
                placeholder="Select the hymn/response"
                isClearable
              />
            </div>

            <div className="flex-1">
              <label htmlFor="language" className="block mb-2 text-gray-700">
                Language *
              </label>
              <Select<SelectOption, true>
                options={language_options}
                value={selectedLanguage}
                onChange={(option: MultiValue<SelectOption>) => {
                  setSelectedLanguage(option ?? []);
                }}
                placeholder="Select audio language(s)"
                isClearable
                isMulti
              />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="file" className="block mb-2 text-gray-700">
              Audio File (Accepted Formats: WAV, MP3, AIFF, FLAC, ALAC) *
            </label>
            <div className="relative">
              <input
                type="file"
                id="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept="audio/*"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100"
                required
              />
            </div>
            {file && (
              <div className="mt-2 flex items-center text-sm text-gray-600">
                <Music className="w-4 h-4 mr-2" />
                {file.name}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            {isSubmitting ? "Uploading..." : "Upload Track"}
          </button>
        </form>
      </div>
    </section>
  );
}
