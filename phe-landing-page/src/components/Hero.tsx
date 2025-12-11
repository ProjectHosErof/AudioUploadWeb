import { Music } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F6F2E9] via-white to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#F6F2E9] text-[#7A1C27] text-sm border border-[#D4AF37]">
              Coming Soon
            </span>
          </div>
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-[#D4AF37] rounded-full blur-2xl opacity-20"></div>
              <div className="relative flex items-center justify-center w-24 h-24 bg-[#4A2E1E] rounded-full shadow-lg">
                <Music className="w-12 h-12 text-[#D4AF37]" />
              </div>
            </div>
          </div>
          <h1 className="mb-6 text-[#4A2E1E] text-5xl sm:text-6xl lg:text-7xl">
            Project Hos Erof
          </h1>
          <p className="text-lg sm:text-xl mb-10 text-gray-600 max-w-3xl mx-auto">
            Paving the future of Coptic Orthodox hymnology
          </p>
          <a
            href="#upload"
            className="inline-block bg-[#7A1C27] text-white px-8 py-3 rounded-lg hover:bg-[#D4AF37] hover:text-[#4A2E1E] transition-colors shadow-md hover:shadow-lg"
          >
            Upload Your Hymn Recording
          </a>
        </div>
      </div>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
    </section>
  );
}
