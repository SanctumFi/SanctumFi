import { HeroSection } from "./HeroSection";
import { Navbar } from "./Navbar";
import { ProblemSection } from "./ProblemSection";
import { SolutionSection } from "./SolutionSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { TiersSection } from "./TiersSection";
import { WhyFlareSection } from "./WhyFlareSection";
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
      {/* Content slides over the sticky hero */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <TiersSection />
        <WhyFlareSection />
        <CtaSection onConnect={onConnect} loading={loading} />
      </div>
    </div>
  );
}
