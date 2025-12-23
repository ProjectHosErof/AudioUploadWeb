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
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || selectedLanguage.length === 0 || !file) {
      alert(
        "Please select a hymn title, at least one language, and an audio file"
      );
      return;
    }

    if (checked && (!email || !isValidEmail(email))) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError(""); // Clear error if validation passes

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
      setChecked(false);
      setEmail("");
      setEmailError("");
      setIsSubmitting(false);

      alert("Thank you for your submission!");
    }, 1000);
  };

  function isValidEmail(email: string): boolean {
    const MAX_EMAIL_LENGTH = 254;
    if (!email || email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
      return false;
    }
    const regexEmailCheck =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return regexEmailCheck.test(email);
  }

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
            you can choose “Unknown” or reach out to us! Please do NOT submit
            entire liturgies or service recordings.
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
          <div className="mb-6">
            <label
              style={{
                display: "flex",
                gap: "15px",
                cursor: "pointer",
                marginBottom: checked ? "10px" : "0",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                style={{ marginTop: "4px", marginBottom: "4px" }}
              />
              <div>
                <p style={{ margin: 0, fontWeight: 500 }}>
                  Get Updates and Become a Tester
                </p>
                <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                  Receive emails about project updates and sign up to become a
                  future tester!
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                  * If already signed up, there is no need to re-enter email *
                </p>
              </div>
            </label>
            {checked && (
              <div className="mt-4">
                <label htmlFor="email" className="block mb-2 text-gray-700">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Clear error when user starts typing
                    if (emailError) {
                      setEmailError("");
                    }
                  }}
                  onBlur={() => {
                    // Validate on blur if email is entered
                    if (email && !isValidEmail(email)) {
                      setEmailError("Please enter a valid email address");
                    }
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    emailError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-amber-500"
                  }`}
                  placeholder="your.email@example.com"
                  required={checked}
                />
                {emailError && (
                  <p className="mt-2 text-sm text-red-600">{emailError}</p>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#7A1C27] text-white py-3 rounded-lg hover:bg-[#D4AF37] hover:text-[#4A2E1E] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            {isSubmitting ? "Uploading..." : "Upload Track"}
          </button>
        </form>
      </div>
    </section>
  );
}
