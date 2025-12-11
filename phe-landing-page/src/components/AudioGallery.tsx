import { Music} from 'lucide-react';
import type { AudioFile } from '../App';

interface AudioGalleryProps {
  audioFiles: AudioFile[];
}

export function AudioGallery({ audioFiles }: AudioGalleryProps) {
  return (
    <section id="gallery" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <h2 className="mb-4">Community Contributions</h2>
          <p className="text-gray-600 mb-8">
            Thank you to everyone who has shared their music with us
          </p>
          
          <div className="inline-flex items-center gap-6 bg-amber-50 rounded-2xl px-12 py-8 border border-amber-200 shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full">
              <Music className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <div className="text-5xl mb-1 text-amber-700">{audioFiles.length}</div>
              <div className="text-gray-600">Tracks Uploaded</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}