import { HeroSection } from "./HeroSection";
import { GalleryArtefactsSection } from "./GalleryArtefactsSection";

interface Props {
  onConnect: () => void;
  loading: boolean;
}

export function LandingPage({ onConnect, loading }: Props) {
  return (
    <div className="bg-background">
      <HeroSection onConnect={onConnect} loading={loading} />
      <GalleryArtefactsSection />
    </div>
  );
}
