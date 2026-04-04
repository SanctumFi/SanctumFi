import { HeroSection } from "./HeroSection";
import { GalleryArtefactsSection } from "./GalleryArtefactsSection";

export function LandingPage() {
  return (
    <div className="bg-background">
      <HeroSection />
      <GalleryArtefactsSection />
    </div>
  );
}
