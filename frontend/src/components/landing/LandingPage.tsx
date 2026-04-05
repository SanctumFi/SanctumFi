import { HeroSection } from "./HeroSection";
import { Navbar } from "./Navbar";

interface Props {
  onConnect: () => void;
  loading: boolean;
}

export function LandingPage({ onConnect, loading }: Props) {
  return (
    <div className="bg-background">
      <Navbar onConnect={onConnect} loading={loading} />
      <HeroSection onConnect={onConnect} loading={loading} />
    </div>
  );
}
