import { HeroSection } from "./HeroSection";
import { Navbar } from "./Navbar";
import { ProblemSection } from "./ProblemSection";
import { SolutionSection } from "./SolutionSection";
import { CtaSection } from "./CtaSection";
import { useScrollReveal } from "../../hooks/useScrollReveal";

interface Props {
  onConnect: () => void;
  loading: boolean;
}

export function LandingPage({ onConnect, loading }: Props) {
  useScrollReveal();

  return (
    <div>
      <Navbar onConnect={onConnect} loading={loading} />
      <HeroSection onConnect={onConnect} loading={loading} />
      <ProblemSection />
      <SolutionSection />
      <CtaSection onConnect={onConnect} loading={loading} />
    </div>
  );
}
