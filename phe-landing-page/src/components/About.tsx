import { Heart, Users, Music2 } from "lucide-react";

export function About() {
  return (
    <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F6F2E9]">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-center mb-4 text-[#4A2E1E]">
          <strong>About Project Hos Erof</strong>
        </h2>
        <p className="text-center text-[#7A1C27] mb-12 max-w-2xl mx-auto">
          Project Hos Erof is an initiative dedicated to preserving and sharing
          sacred hymns and responses from the Coptic Orthodox tradition. We're
          building something special, and we need your support (and your
          recordings).
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white border-2 border-[#D4AF37] rounded-full mb-4">
              <Heart className="w-8 h-8 text-[#7A1C27]" />
            </div>
            <h3 className="mb-2 text-[#4A2E1E]">Share Your Faith</h3>
            <p className="text-[#7A1C27]">
              Upload your hymns and responses to help this project grow and keep
              our Coptic heritage alive for everyone
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white border-2 border-[#D4AF37] rounded-full mb-4">
              <Users className="w-8 h-8 text-[#7A1C27]" />
            </div>
            <h3 className="mb-2 text-[#4A2E1E]">Join the Community</h3>
            <p className="text-[#7A1C27]">
              Your participation strengthens this project and brings our Coptic
              Orthodox community closer through shared hymnology and tradition
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white border-2 border-[#D4AF37] rounded-full mb-4">
              <Music2 className="w-8 h-8 text-[#7A1C27]" />
            </div>
            <h3 className="mb-2 text-[#4A2E1E]">Preserve Tradition</h3>
            <p className="text-[#7A1C27]">
              Every contribution helps the project develop and ensures our
              sacred faith continues to grow with the community
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
